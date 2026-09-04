import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewEncapsulation,
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
  styleUrls: ['./lector-qr.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class LectorQrComponent implements AfterViewInit, OnDestroy {
  readonly lectorId = `qr-reader-${++contadorInstancias}`;

  @Input() bloqueado = false;

  @Output() codigoDetectado = new EventEmitter<string>();

  estado: EstadoLectorQr = 'iniciando';
  mensajeError: string | null = null;

  private lector: Html5Qrcode | null = null;
  private ultimoToken: string | null = null;
  private ultimaLecturaTs = 0;
  private readonly COOLDOWN_MISMO_TOKEN_MS = 2000;

  private bufferScanner = '';
  private scannerResetTimeout: ReturnType<typeof setTimeout> | null = null;
  private ultimaTeclaTs = 0;
  private readonly SCANNER_INTERVALO_MAX_MS = 50;
  private readonly SCANNER_TOKEN_MIN_LARGO = 6;

  // --- Debug ---
  private frameErrorCount = 0;
  private ultimoLogFrameErrorTs = 0;

  ngAfterViewInit(): void {
    console.log('🟢 [QR] ngAfterViewInit — UA:', navigator.userAgent);
    void this.iniciarCamara();
  }

  ngOnDestroy(): void {
    console.log('🔴 [QR] ngOnDestroy');
    if (this.scannerResetTimeout) clearTimeout(this.scannerResetTimeout);
    void this.detenerCamara();
  }

  reintentarCamara(): void {
    console.log('🔁 [QR] reintentarCamara()');
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
        console.log('⌨️ [QR] Lectura por pistola USB:', token);
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
    console.log('🎥 [QR] iniciarCamara() — solicitando lista de cámaras...');

    try {
      const camaras = await Html5Qrcode.getCameras();
      console.log('📷 [QR] Cámaras encontradas:', camaras);

      if (!camaras?.length) {
        console.warn('⚠️ [QR] No se encontraron cámaras.');
        this.estado = 'sin-camara';
        return;
      }

      const camaraElegida =
        camaras.find((c) => /back|trasera|rear/i.test(c.label))?.id ?? camaras[0].id;
      console.log('✅ [QR] Cámara elegida:', camaraElegida);

      const usaNativo = this.usarDetectorNativo();
      console.log(
        '🧠 [QR] ¿BarcodeDetector nativo disponible?',
        typeof (window as any).BarcodeDetector !== 'undefined',
        '| ¿Vamos a usarlo?',
        usaNativo,
      );

      this.lector = new Html5Qrcode(this.lectorId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: usaNativo,
        },
      });

      await this.lector.start(
        camaraElegida,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          videoConstraints: {
            deviceId: { exact: camaraElegida },
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ focusMode: 'continuous' } as any],
          },
        },
        (texto, resultado) => {
          console.log('🎯 [QR] ¡DECODIFICADO!', texto, resultado);
          this.emitirLectura(texto);
        },
        (mensajeError) => {
          // Esto se dispara MUCHAS veces por segundo cuando no hay código
          // en cuadro — es normal. Lo logueamos agrupado cada 2s para no
          // inundar la consola pero sí confirmar que el loop de escaneo
          // sigue vivo y qué error interno está devolviendo cada intento.
          this.frameErrorCount++;
          const ahora = Date.now();
          if (ahora - this.ultimoLogFrameErrorTs > 2000) {
            console.log(
              `🔍 [QR] Loop de escaneo activo — ${this.frameErrorCount} intentos sin código en los últimos ~2s. Último error:`,
              mensajeError,
            );
            this.frameErrorCount = 0;
            this.ultimoLogFrameErrorTs = ahora;
          }
        },
      );

      // Inspeccionar el <video> real que quedó montado, para confirmar
      // dimensiones reales negociadas vs lo que pedimos.
      const video = document.querySelector(`#${this.lectorId} video`) as HTMLVideoElement | null;
      if (video) {
        console.log('📐 [QR] <video> montado:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          paused: video.paused,
          srcObjectTracks: (video.srcObject as MediaStream | null)
            ?.getVideoTracks()
            .map((t) => ({ label: t.label, settings: t.getSettings() })),
        });
      } else {
        console.warn('⚠️ [QR] No se encontró el elemento <video> tras iniciar la cámara.');
      }

      this.estado = 'escaneando';
      console.log('✅ [QR] Estado -> escaneando');
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
      console.log('🛑 [QR] Cámara detenida y limpiada.');
    } catch (e) {
      console.log('ℹ️ [QR] detenerCamara(): ya estaba detenida.', e);
    } finally {
      this.lector = null;
    }
  }

  private emitirLectura(token: string): void {
    const ahora = Date.now();

    if (this.bloqueado) {
      console.log('⛔ [QR] Lectura ignorada — componente bloqueado. Token:', token);
      return;
    }
    if (token === this.ultimoToken && ahora - this.ultimaLecturaTs < this.COOLDOWN_MISMO_TOKEN_MS) {
      console.log('🧊 [QR] Lectura ignorada — mismo token en cooldown. Token:', token);
      return;
    }

    console.log('📤 [QR] Emitiendo lectura al padre:', token);
    this.ultimoToken = token;
    this.ultimaLecturaTs = ahora;

    this.pausarCamaraSiActiva();
    this.codigoDetectado.emit(token);
  }

  reanudar(): void {
    console.log('▶️ [QR] reanudar()');
    this.ultimoToken = null;
    this.reanudarCamaraSiPausada();
  }

  private pausarCamaraSiActiva(): void {
    try {
      if (this.lector?.getState() === Html5QrcodeScannerState.SCANNING) {
        this.lector.pause(true);
        console.log('⏸️ [QR] Cámara pausada.');
      }
    } catch (e) {
      console.log('⚠️ [QR] pausarCamaraSiActiva() falló', e);
    }
  }

  private reanudarCamaraSiPausada(): void {
    try {
      if (this.lector?.getState() === Html5QrcodeScannerState.PAUSED) {
        this.lector.resume();
        console.log('▶️ [QR] Cámara reanudada.');
      }
    } catch (e) {
      console.log('⚠️ [QR] reanudarCamaraSiPausada() falló', e);
    }
  }

  usarDetectorNativo(): boolean {
    const ua = navigator.userAgent;
    const esIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const esSafari = /^((?!chrome|android).)*safari/i.test(ua);

    if (esIOS || esSafari) return false;

    return true;
  }
}