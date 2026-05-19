import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ZebraScannerService implements OnDestroy {
  private lastKeyTime = 0;
  private buffer = '';
  private bufferTimer: any = null;

  private readonly THRESHOLD_MS = 50;   // delta máximo entre teclas del escáner
  private readonly MIN_LENGTH = 4;       // mínimo de chars para considerar válido
  private readonly BUFFER_TIMEOUT = 100; // limpiar buffer si no llega Enter

  readonly scan$ = new Subject<string>();

  private boundHandler = (e: KeyboardEvent) => this.handleKey(e);

  constructor(private _zone: NgZone) {}

  init(): void {
    document.addEventListener('keydown', this.boundHandler);
  }

  private handleKey(e: KeyboardEvent): void {
    const now = Date.now();
    const delta = now - this.lastKeyTime;
    this.lastKeyTime = now;

    // Ignorar teclas modificadoras
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;

    if (e.key === 'Enter') {
      clearTimeout(this.bufferTimer);

      if (this.buffer.length >= this.MIN_LENGTH) {
        const codigo = this.buffer.trim();
        this._zone.run(() => this.scan$.next(codigo));
      }

      this.buffer = '';
      return;
    }

    // Si el delta es mayor al threshold Y el buffer está vacío → es tipado manual, ignorar
    if (delta > this.THRESHOLD_MS && this.buffer === '') {
      return;
    }

    this.buffer += e.key;

    // Safety: limpiar buffer si nunca llega el Enter (escáner raro o error)
    clearTimeout(this.bufferTimer);
    this.bufferTimer = setTimeout(() => {
      this.buffer = '';
    }, this.BUFFER_TIMEOUT);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.boundHandler);
    clearTimeout(this.bufferTimer);
  }
}