// ip.service.ts
// export async function obtenerIPLocal(apiUrl: string): Promise<string> {
//   // 1. Intentar WebRTC primero (no necesita backend)
//   const webrtcIp = await obtenerIPWebRTC();
//   if (webrtcIp) return webrtcIp;

//   // 2. Fallback al backend
//   try {
//     const res = await fetch(`${apiUrl}mi-ip`);
//     if (!res.ok) return 'No disponible';
//     const json = await res.json();
//     return json.ip ?? 'No disponible';
//   } catch {
//     return 'No disponible';
//   }
// }



import { APP_CONFIG } from 'app/core/config/app-config';

export async function obtenerIPLocal(): Promise<string> {
  const webrtcIp = await obtenerIPWebRTC();
  if (webrtcIp && webrtcIp !== '127.0.0.1') return webrtcIp;

  // Fallback: llamar al backend por su IP de LAN (no localhost)
  // así el servidor ve la IP real del cliente
  try {
    const lanUrl = APP_CONFIG.apiLanUrl ?? APP_CONFIG.apiUrl;
    const res = await fetch(`${lanUrl}mi-ip`);
    if (!res.ok) return 'No disponible';
    const json = await res.json();
    const ip = json.ip;
    if (ip && ip !== '127.0.0.1' && esIPPrivada(ip)) return ip;
  } catch { /* sigue */ }

  return 'No disponible';
}


export async function obtenerIPWebRTC(): Promise<string | null> {
  return new Promise((resolve) => {
    // Sin STUN server — así solo genera candidatos de red local
    const pc = new RTCPeerConnection({ iceServers: [] });
    const ips = new Set<string>();

    pc.createDataChannel('');
    pc.createOffer().then(o => pc.setLocalDescription(o));

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        pc.close();
        const local = [...ips].find(esIPPrivada);
        resolve(local ?? null);
        return;
      }
      const match = e.candidate.candidate.match(/(\d{1,3}(\.\d{1,3}){3})/);
      if (match && esIPPrivada(match[1])) ips.add(match[1]);
    };

    setTimeout(() => {
      pc.close();
      const local = [...ips].find(esIPPrivada);
      resolve(local ?? null);
    }, 2000);
  });
}

function esIPPrivada(ip: string): boolean {
  return (
    ip.startsWith('192.168.') ||
    ip.startsWith('10.')      ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}


async function obtenerIPBackend(): Promise<string | null> {
  const res = await fetch('/api/mi-ip');
  if (!res.ok) return null;
  const json = await res.json();
  return json.ip ?? null;
}