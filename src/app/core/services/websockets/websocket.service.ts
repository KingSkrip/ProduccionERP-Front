import { Injectable } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { BehaviorSubject, Observable } from 'rxjs';
export interface WebSocketMessage {
  type: 'workorder.created' | 'mail.reply.created' | 'mailbox.updated';
  data: any;
}
@Injectable({
  providedIn: 'root',
})
export class WebsocketService {
  private echo: Echo<'reverb'> | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);
  private messages$ = new BehaviorSubject<WebSocketMessage | null>(null);

  private currentIdentityId: number | null = null;
  constructor() {
    (window as any).Pusher = Pusher;
  }
  connect(identityId: number, authToken: string): void {
    if (this.echo) {
      this.echo.disconnect();
      this.echo = null;
    }
    this.currentIdentityId = identityId;
    this.echo = new Echo({
      broadcaster: 'reverb',
      key: 'skihewaszkyxb28di1za',
      wsHost: 'localhost',
      wsPort: 8080,
      wssPort: 8080,
      forceTLS: false,
      enabledTransports: ['ws', 'wss'],
      authEndpoint: 'http://localhost:8000/broadcasting/auth',
      auth: {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
        },
      },
    });
    const channelName = `user.${identityId}`;

    this.echo
      .private(channelName)
      .listen('.workorder.created', (event: any) => {
     
        this.messages$.next({
          type: 'workorder.created',
          data: event,
        });
      })

      .listen('.mail.reply.created', (event: any) => {
    
        this.messages$.next({
          type: 'mail.reply.created',
          data: event,
        });
      })
      .listen('.mailbox.updated', (event: any) => {
      
        this.messages$.next({
          type: 'mailbox.updated',
          data: event,
        });
      });



    this.echo.connector.pusher.connection.bind('connected', () => {
      this.connected$.next(true);
  
    });

    this.echo.connector.pusher.connection.bind('disconnected', () => {
      this.connected$.next(false);
    });
  }
  disconnect(): void {
    if (this.echo) {
      if (this.currentIdentityId) {
        this.echo.leave(`user.${this.currentIdentityId}`);
      }
      this.echo.disconnect();
      this.echo = null;
      this.connected$.next(false);
   
    }
  }
  isConnected(): Observable<boolean> {
    return this.connected$.asObservable();
  }
  getMessages(): Observable<WebSocketMessage | null> {
    return this.messages$.asObservable();
  }
  joinWorkorder(workorderId: number): void {
    if (!this.echo) {
      console.warn('Echo no está conectado');
      return;
    }
    this.echo
      .join(`workorder.${workorderId}`)
      .here((users: any[]) => {
      
      })
      .joining((user: any) => {
      
      })
      .leaving((user: any) => {
   
      });
  }
  leaveWorkorder(workorderId: number): void {
    if (!this.echo) return;
    this.echo.leave(`workorder.${workorderId}`);
  }
}
