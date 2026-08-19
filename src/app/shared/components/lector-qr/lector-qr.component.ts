import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export type EstadoLectorQr =
  | 'iniciando'
  | 'escaneando'
  | 'procesando'
  | 'error-camara'
  | 'sin-camara';

let contadorInstancias = 0;

@Component({
  selector: 'app-lector-qr',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './lector-qr.component.html',
})
export class LectorQrComponent implements AfterViewInit, OnDestroy {
  /** Id único por instancia, por si hay más de un lector en la misma vista alguna vez. */
  readonly lectorId = `qr-reader-${++contadorInstancias}`;

  /** Mientras esté en true (ej. petición al backend en curso), ignora nuevas lecturas. */
  @Input() bloqueado = false;

  @Output() codigoDetectado = new EventEmitter<string>();

  estado: EstadoLectorQr = 'iniciando';
  mensajeError: string | null = null;

  private lector: Html5Qrcode | null = null;
  private ultimoToken: string | null = null;
  private ultimaLecturaTs = 0;
  /** Evita procesar el mismo QR dos veces si sigue en cuadro. */
  private readonly COOLDOWN_MISMO_TOKEN_MS = 2000;

  // --- Lector USB tipo pistola ---
  private bufferScanner = '';
  private scannerResetTimeout: ReturnType<typeof setTimeout> | null = null;
  private ultimaTeclaTs = 0;
  private readonly SCANNER_INTERVALO_MAX_MS = 50;
  private readonly SCANNER_TOKEN_MIN_LARGO = 6;

  ngAfterViewInit(): void {
    void this.iniciarCamara();
  }

  ngOnDestroy(): void {
    if (this.scannerResetTimeout) clearTimeout(this.scannerResetTimeout);
    void this.detenerCamara();
  }

  reintentarCamara(): void {
    void this.iniciarCamara();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydownGlobal(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

    const ahora = Date.now();
    const intervalo = ahora - this.ultimaTeclaTs;
    this.ultimaTeclaTs = ahora;

    if (event.key === 'Enter') {
      const token = this.bufferScanner;
      this.bufferScanner = '';
      if (token.length >= this.SCANNER_TOKEN_MIN_LARGO) {
        this.emitirLectura(token);
      }
      return;
    }

    if (event.key.length !== 1) return;

    if (this.bufferScanner.length > 0 && intervalo > this.SCANNER_INTERVALO_MAX_MS) {
      this.bufferScanner = '';
    }
    this.bufferScanner += event.key;

    if (this.scannerResetTimeout) clearTimeout(this.scannerResetTimeout);
    this.scannerResetTimeout = setTimeout(() => (this.bufferScanner = ''), 300);
  }

  private async iniciarCamara(): Promise<void> {
    this.estado = 'iniciando';
    this.mensajeError = null;

    try {
      const camaras = await Html5Qrcode.getCameras();

      if (!camaras?.length) {
        this.estado = 'sin-camara';
        return;
      }

      const camaraElegida =
        camaras.find((c) => /back|trasera|rear/i.test(c.label))?.id ?? camaras[0].id;

      this.lector = new Html5Qrcode(this.lectorId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });

      await this.lector.start(
        camaraElegida,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (texto) => this.emitirLectura(texto),
        () => {},
      );

      this.estado = 'escaneando';
    } catch (error) {
      this.estado = 'error-camara';
      this.mensajeError = 'No se pudo acceder a la cámara. Revisa los permisos del navegador.';
      console.error('💥 ERROR_INICIAR_CAMARA_QR', error);
    }
  }

  private async detenerCamara(): Promise<void> {
    if (!this.lector) return;
    try {
      await this.lector.stop();
      this.lector.clear();
    } catch {
      // ya estaba detenida, sin problema
    } finally {
      this.lector = null;
    }
  }

  private emitirLectura(token: string): void {
    const ahora = Date.now();

    if (this.bloqueado) return;
    if (token === this.ultimoToken && ahora - this.ultimaLecturaTs < this.COOLDOWN_MISMO_TOKEN_MS) {
      return;
    }

    this.ultimoToken = token;
    this.ultimaLecturaTs = ahora;

    this.pausarCamaraSiActiva();
    this.codigoDetectado.emit(token);
  }

  /** Llamar desde el padre cuando ya terminó de procesar (éxito o error) para reanudar. */
  reanudar(): void {
    this.ultimoToken = null;
    this.reanudarCamaraSiPausada();
  }

  private pausarCamaraSiActiva(): void {
    try {
      if (this.lector?.getState() === Html5QrcodeScannerState.SCANNING) {
        this.lector.pause(true);
      }
    } catch {}
  }

  private reanudarCamaraSiPausada(): void {
    try {
      if (this.lector?.getState() === Html5QrcodeScannerState.PAUSED) {
        this.lector.resume();
      }
    } catch {}
  }
}