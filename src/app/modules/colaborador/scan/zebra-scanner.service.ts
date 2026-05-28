import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ZebraScannerService implements OnDestroy {
  private bufferTimer: any = null;
  private readonly BUFFER_TIMEOUT = 300;
  private readonly MIN_LENGTH = 4;
  readonly scan$ = new Subject<string>();
  private paused = false;
  private inputEl: HTMLInputElement | null = null;
  // private boundInput  = () => this.onInput();
  // private boundKeydown = (e: KeyboardEvent) => this.onKeydown(e);

  private buffer = '';
  private boundKeydown = (e: KeyboardEvent) => this.onKeydown(e);

  constructor(private _zone: NgZone) {}

  init(inputEl?: HTMLInputElement): void {
    if (inputEl) {
      this.inputEl = inputEl;
    } else {
      const el = document.createElement('input');
      el.setAttribute('readonly', 'true');
      el.setAttribute('inputmode', 'none');
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'position:fixed;opacity:0;width:1px;height:1px;top:0;left:0;pointer-events:none;';
      document.body.appendChild(el);
      this.inputEl = el;
    }

    this.inputEl.addEventListener('blur', (e: FocusEvent) => {
      if (this.paused) return;
      const dest = e.relatedTarget as HTMLElement | null;
      if (dest && (dest.tagName === 'INPUT' || dest.tagName === 'TEXTAREA')) return;
      setTimeout(() => {
        if (!this.paused) this.inputEl?.focus();
      }, 50);
    });

    // Re-enfocar cuando la app vuelve a primer plano
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // console.log('👁️ App visible, re-enfocando input...');
        setTimeout(() => this.inputEl?.focus(), 100);
      }
    });

    setInterval(() => {
      if (this.paused) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      if (active !== this.inputEl) this.inputEl?.focus();
    }, 800);

   this.inputEl.addEventListener('keydown', this.boundKeydown);
    this.inputEl.focus();
  }

  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
    setTimeout(() => this.inputEl?.focus(), 100);
  }

  private onKeydown(e: KeyboardEvent): void {

      // console.log('🔑 keydown:', JSON.stringify({
    //   key: e.key,
    //   keyCode: e.keyCode,
    //   value: this.inputEl?.value,
    //   focused: document.activeElement === this.inputEl,
    // }));
  const esSufijo = e.key === 'Enter' || e.key === 'Tab'
                || e.keyCode === 13   || e.keyCode === 9;
  if (esSufijo) {
    e.preventDefault();
    const valor = this.buffer.trim();
    this.buffer = '';
    clearTimeout(this.bufferTimer);
    if (valor.length >= this.MIN_LENGTH) {
      this._zone.run(() => this.scan$.next(valor));
    } else {
      console.warn('⚠️ Valor muy corto, ignorado:', valor, 'length:', valor.length);
    }
    return;
  }
  if (e.key.length === 1) {
    this.buffer += e.key;
    clearTimeout(this.bufferTimer);
    this.bufferTimer = setTimeout(() => { this.buffer = ''; }, this.BUFFER_TIMEOUT);
  }
}

  private onInput(): void {
    // Safety timeout: si en 300ms no llega Enter, limpiar
    // clearTimeout(this.bufferTimer);
    // this.bufferTimer = setTimeout(() => {
    //   if (this.inputEl) this.inputEl.value = '';
    // }, this.BUFFER_TIMEOUT);
  }

  focusInput(): void {
    if (!this.paused) {
      this.inputEl?.focus();
    }
  }

  ngOnDestroy(): void {
 this.inputEl?.removeEventListener('keydown', this.boundKeydown);
    clearTimeout(this.bufferTimer);
  }
}
