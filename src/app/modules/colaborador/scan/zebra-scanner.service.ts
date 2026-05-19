import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ZebraScannerService implements OnDestroy {
  private bufferTimer: any = null;
  private readonly BUFFER_TIMEOUT = 300;
  private readonly MIN_LENGTH = 4;

  readonly scan$ = new Subject<string>();

  private inputEl: HTMLInputElement | null = null;
  private boundInput  = () => this.onInput();
  private boundKeydown = (e: KeyboardEvent) => this.onKeydown(e);

  constructor(private _zone: NgZone) {}

  init(inputEl?: HTMLInputElement): void {
    if (inputEl) {
      this.inputEl = inputEl;
    } else {
      const el = document.createElement('input');
      el.style.cssText = 'position:fixed;opacity:0;width:1px;height:1px;top:0;left:0;';
      document.body.appendChild(el);
      this.inputEl = el;
    }
  
    // Re-enfocar cada vez que el input pierde foco
    this.inputEl.addEventListener('blur', () => {
      console.warn('🔵 Input perdió foco, re-enfocando en 50ms...');
      setTimeout(() => this.inputEl?.focus(), 50);
    });
  
    // Re-enfocar cuando la app vuelve a primer plano
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // console.log('👁️ App visible, re-enfocando input...');
        setTimeout(() => this.inputEl?.focus(), 100);
      }
    });
  
    // Polling de seguridad
    setInterval(() => {
      if (document.activeElement !== this.inputEl) {
        this.inputEl?.focus();
      }
    }, 800);
  
    this.inputEl.addEventListener('input', this.boundInput);
    this.inputEl.addEventListener('keydown', this.boundKeydown);
    this.inputEl.focus();
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
  
    if (!esSufijo) return;
  
    e.preventDefault(); // evita que Tab cambie el foco
  
    const valor = this.inputEl?.value?.trim() ?? '';
    this.inputEl!.value = '';
  
   // console.log('🎯 Sufijo detectado, valor capturado:', valor);
  
    if (valor.length >= this.MIN_LENGTH) {
      clearTimeout(this.bufferTimer);
      this._zone.run(() => this.scan$.next(valor));
    } else {
      console.warn('⚠️ Valor muy corto, ignorado:', valor, 'length:', valor.length);
    }
  }

  private onInput(): void {
    // Safety timeout: si en 300ms no llega Enter, limpiar
    clearTimeout(this.bufferTimer);
    this.bufferTimer = setTimeout(() => {
      if (this.inputEl) this.inputEl.value = '';
    }, this.BUFFER_TIMEOUT);
  }

  focusInput(): void {
    this.inputEl?.focus();
  }

  ngOnDestroy(): void {
    this.inputEl?.removeEventListener('input', this.boundInput);
    this.inputEl?.removeEventListener('keydown', this.boundKeydown);
    clearTimeout(this.bufferTimer);
  }



}