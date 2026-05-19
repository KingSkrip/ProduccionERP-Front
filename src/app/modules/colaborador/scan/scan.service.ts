import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { UserService } from 'app/core/user/user.service';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ScanEmbarque } from './scan-embarques.types';

@Injectable({ providedIn: 'root' })
export class ScanService implements OnDestroy {
  private apiUrl = APP_CONFIG.apiUrl;
  private reverb  = APP_CONFIG.reverb;

  private _scans$   = new BehaviorSubject<ScanEmbarque[]>([]);
  private _loading$ = new BehaviorSubject<boolean>(false);

  private echo: Echo<'reverb'> | null = null;
  private initialized = false;

  constructor(
    private _http: HttpClient,
    private _zone: NgZone,
    private _userService: UserService  // 👈
  ) {}

  get scans$():   Observable<ScanEmbarque[]> { return this._scans$.asObservable(); }
  get loading$(): Observable<boolean>        { return this._loading$.asObservable(); }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.cargarScans();
    this.conectarWebSocket();
  }

  cargarScans(): void {
    this._loading$.next(true);
    this._http
      .get<{ data: ScanEmbarque[] }>(`${this.apiUrl}scanner/embarques`)
      .pipe(tap(() => this._loading$.next(false)))
      .subscribe({
        next:  (res) => this._scans$.next(res.data),
        error: ()    => this._loading$.next(false),
      });
  }

  // 👈 Nuevo: Angular manda el escaneo a Laravel
  enviarScan(barcode: string): Observable<any> {
    return this._http.post(`${this.apiUrl}scanner/embarques`, { barcode });
  }

  private conectarWebSocket(): void {
    if (this.echo) return;

    const userId = this._userService.user?.firebird_user_id;
    (window as any).Pusher = Pusher;

    this.echo = new Echo({
      broadcaster: 'reverb',
      key:         this.reverb.key,
      wsHost:      this.reverb.host,
      wsPort:      this.reverb.port,
      wssPort:     this.reverb.port,
      forceTLS:    this.reverb.scheme === 'https',
      enabledTransports: ['ws', 'wss'],
    });

    // 👈 Canal privado por usuario
    this.echo
      .private(`scanner-embarques.${userId}`)
      .listen('.scan.creado', (event: any) => {
        const normalizado: ScanEmbarque = {
          CODIGO:     event.codigo     ?? event.CODIGO,
          CODIGOENT:  event.codigoEnt  ?? event.CODIGOENT,
          FECHAYHORA: event.fechaYHora ?? event.FECHAYHORA,
          PROCESADO:  event.procesado  ?? event.PROCESADO,
        };
        this._zone.run(() => {
          this._scans$.next([normalizado, ...this._scans$.getValue()]);
        });
      });
  }

  ngOnDestroy(): void {
    this.echo?.disconnect();
    this.echo = null;
    this.initialized = false;
  }
}