// import { Injectable } from '@angular/core';
// import { APP_CONFIG } from 'app/core/config/app-config';
// import Echo from 'laravel-echo';
// import Pusher from 'pusher-js';

// declare global {
//   interface Window {
//     Pusher: any;
//     Echo: any;
//   }
// }

// @Injectable({ providedIn: 'root' })
// export class ResumenWebsocketService {
//   private echo: Echo<any> | null = null;

//   constructor() {
//     this.initializeEcho();
//   }

//   private initializeEcho() {
//     window.Pusher = Pusher;

//     const { key, host, port, scheme } = APP_CONFIG.reverb;
//     const forceTLS = scheme === 'https';

//     this.echo = new Echo({
//       broadcaster: 'reverb',
//       key,
//       wsHost: host,
//       wsPort: port,
//       wssPort: port,
//       // wsPath: `/app/${key}`,
//       wsPath: '', // o '/'
//       forceTLS,
//       enabledTransports: forceTLS ? ['wss'] : ['ws'],
//       disableStats: true,
//       authEndpoint: `${APP_CONFIG.apiBase}/broadcasting/auth`,
//     });

//     window.Echo = this.echo;
//     console.log('✅ Laravel Echo (Reverb) inicializado', {
//       host,
//       port,
//       scheme,
//       authEndpoint: `${APP_CONFIG.apiBase}/broadcasting/auth`,
//     });
//   }

//   private listening = false;

//   listenReportesActualizados(callback: (data: any) => void) {
//     if (!this.echo) return;

//     if (this.listening) {
//       console.warn('⚠️ Ya estaba escuchando reportes-produccion');
//       return;
//     }
//     this.listening = true;

//     this.echo.channel('reportes-produccion').listen('.reportes.actualizados', (event: any) => {
//       callback(event);
//     });
//   }

//   stopListening() {
//     this.echo?.leave('reportes-produccion');
//     this.listening = false;
//     console.log('🔕 Dejó de escuchar canal');
//   }

//   disconnect() {
//     this.echo?.disconnect();
//     this.echo = null;
//     console.log('❌ Echo desconectado');
//   }
// }
