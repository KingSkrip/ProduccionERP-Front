import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { BehaviorSubject, Observable, Subscription, interval, switchMap, tap } from 'rxjs';
import { ScanEmbarque } from './scan-embarques.types';

@Injectable({ providedIn: 'root' })
export class ScanService implements OnDestroy {
  private apiUrl = APP_CONFIG.apiUrl;

  private _scans$ = new BehaviorSubject<ScanEmbarque[]>([]);
  private _loading$ = new BehaviorSubject<boolean>(false);

  private echo: Echo<'reverb'> | null = null;
  private pollingSubscription: Subscription | null = null;
  private usingWebSocket = false;

  readonly POLL_INTERVAL = 2000; // reducido a 2s para fallback más ágil

  constructor(
    private _http: HttpClient,
    private _zone: NgZone, // ← inyectar NgZone aquí
  ) {}

  get scans$(): Observable<ScanEmbarque[]> {
    return this._scans$.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this._loading$.asObservable();
  }

  init(): void {
    this.cargarScans();
    this.conectarWebSocket();
  }

  cargarScans(): void {
    this._loading$.next(true);
    this._http
      .get<{ data: ScanEmbarque[] }>(`${this.apiUrl}scanner/embarques`)
      .pipe(tap(() => this._loading$.next(false)))
      .subscribe({
        next: (res) => this._scans$.next(res.data),
        error: () => this._loading$.next(false),
      });
  }

  private conectarWebSocket(): void {
    try {
      (window as any).Pusher = Pusher;

      this.echo = new Echo({
        broadcaster: 'reverb',
        key: 'skihewaszkyxb28di1za',
        wsHost: 'localhost',
        wsPort: 8080,
        wssPort: 8080,
        forceTLS: false,
        enabledTransports: ['ws'],
      });

      this.echo.channel('scanner-embarques').listen('.scan.creado', (event: any) => {
        const normalizado: ScanEmbarque = {
          CODIGO:     event.codigo     ?? event.CODIGO,
          CODIGOENT:  event.codigoEnt  ?? event.CODIGOENT,
          FECHAYHORA: event.fechaYHora ?? event.FECHAYHORA,
          PROCESADO:  event.procesado  ?? event.PROCESADO,
        };

        // ← CLAVE: forzar ejecución dentro de NgZone
        this._zone.run(() => {
          const actual = this._scans$.getValue();
          this._scans$.next([normalizado, ...actual]);
        });
      });

      this.echo.connector.pusher.connection.bind('connected', () => {
        this.usingWebSocket = true;
        this.detenerPolling();
      });

      this.echo.connector.pusher.connection.bind('failed', () => {
        this.iniciarPolling();
      });

      this.echo.connector.pusher.connection.bind('unavailable', () => {
        this.iniciarPolling();
      });

      setTimeout(() => {
        if (!this.usingWebSocket) {
          this.iniciarPolling();
        }
      }, 5000);

    } catch (e) {
      this.iniciarPolling();
    }
  }

  private iniciarPolling(): void {
    if (this.pollingSubscription) return;
    this.pollingSubscription = interval(this.POLL_INTERVAL)
      .pipe(
        switchMap(() =>
          this._http.get<{ data: ScanEmbarque[] }>(`${this.apiUrl}scanner/embarques`),
        ),
      )
      .subscribe({
        next: (res) => this._zone.run(() => this._scans$.next(res.data)),
      });
  }

  private detenerPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = null;
  }

  ngOnDestroy(): void {
    this.detenerPolling();
    this.echo?.disconnect();
  }
}