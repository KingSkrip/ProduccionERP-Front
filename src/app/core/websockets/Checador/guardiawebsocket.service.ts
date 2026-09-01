import { Injectable } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

import { AuthService } from 'app/core/auth/auth.service';
import { APP_CONFIG } from 'app/core/config/app-config';

declare global {
  interface Window {
    Pusher: any;
    Echo: any;
  }
}

export interface ChecadaRegistradaEvent {
  identity_id: number;
  nombre: string | null;
  foto: string | null;
  tipo: 'entrada' | 'salida' | 'Inicio de permiso' | 'Fin de permiso';
  hora: string;
  firebird_empresa: string | null;
  metodo: string;
}

@Injectable({
  providedIn: 'root',
})
export class GuardiaWebsocketService {
  private echo: Echo<any> | null = null;

  private listening = false;

  constructor(private authService: AuthService) {
    this.initializeEcho();
  }

  // ============================================================
  // Inicialización de Laravel Echo + Reverb
  // ============================================================

  private initializeEcho(): void {
    window.Pusher = Pusher;

    const { key, host, port, scheme } = APP_CONFIG.reverb;

    const forceTLS = scheme === 'https';
    const authEndpoint = `${APP_CONFIG.apiBase}/broadcasting/auth`;

    this.echo = new Echo({
      broadcaster: 'reverb',

      key,

      wsHost: host,
      wsPort: port,
      wssPort: port,

      // Reverb maneja el path internamente.
      wsPath: '',

      forceTLS,

      enabledTransports: forceTLS ? ['wss'] : ['ws'],

      disableStats: true,

      authEndpoint,

      // 👇 Nuestro backend usa JWT propio (bearerToken), no cookies/Sanctum.
      // Por eso Echo necesita un authorizer custom que mande el header
      // Authorization en cada request a /broadcasting/auth, leyendo
      // siempre el token más reciente de AuthService (por si se refrescó).
      authorizer: (channel: any) => {
        return {
          authorize: (socketId: string, callback: (error: Error | null, data: any) => void) => {
            const token = this.authService.encrypt;

            fetch(authEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                socket_id: socketId,
                channel_name: channel.name,
              }),
            })
              .then((res) => {
                if (!res.ok) {
                  return res.json().then((body) => {
                    throw new Error(body?.message ?? `HTTP ${res.status}`);
                  });
                }
                return res.json();
              })
              .then((data) => callback(null, data))
              .catch((error) => {
                console.error('❌ Error autorizando canal Echo:', error);
                callback(error instanceof Error ? error : new Error(String(error)), null);
              });
          },
        };
      },
    });

    window.Echo = this.echo;

    console.log('🟢 GuardiaWebsocketService inicializado', {
      host,
      port,
      scheme,
      channel: 'guardia',
      authEndpoint,
    });
  }

  // ============================================================
  // Escuchar checadas
  // ============================================================

  listenChecadas(callback: (data: ChecadaRegistradaEvent) => void): void {
    if (!this.echo) {
      console.error('❌ Echo no está inicializado');
      return;
    }

    if (this.listening) {
      console.warn('⚠️ Ya estaba escuchando el canal guardia');
      return;
    }

    this.listening = true;

    console.log('👂 Suscribiendo al canal privado: guardia');

    this.echo.private('guardia').listen('.checada.registrada', (event: ChecadaRegistradaEvent) => {
      console.log('🚨 CHECADA RECIBIDA POR GUARDIA', event);

      callback(event);
    });
  }

  // ============================================================
  // Dejar de escuchar
  // ============================================================

  stopListening(): void {
    if (!this.echo) {
      return;
    }

    this.echo.leave('guardia');

    this.listening = false;

    console.log('🔕 Guardia dejó de escuchar el canal');
  }

  // ============================================================
  // Desconectar Echo completamente
  // ============================================================

  disconnect(): void {
    if (!this.echo) {
      return;
    }

    this.echo.disconnect();

    this.echo = null;

    this.listening = false;

    console.log('❌ Echo desconectado');
  }
}
