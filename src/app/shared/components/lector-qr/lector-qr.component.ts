import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export type EstadoLectorQr =
  | 'iniciando'
  | 'escaneando'
  | 'procesando'
  | 'error-camara'
  | 'sin-camara';

let contadorInstancias = 0;

// --- Config zxing-wasm (solo se usa en la rama iOS/Safari) ---
let wasmConfigurado = false;
function asegurarWasmConfigurado(): void {
  if (wasmConfigurado) return;
  wasmConfigurado = true;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string) =>
        `https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/reader/${path}`,
    },
  });
}

const ZXING_READER_OPTIONS: ReaderOptions = {
  tryHarder: true,
  formats: ['QRCode', 'EAN-13', 'EAN-8', 'Code128', 'Code39', 'ITF', 'UPC-A', 'UPC-E'],
  maxNumberOfSymbols: 1,
};

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

  // Solo se resuelven cuando el template renderiza la rama iOS.
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  estado: EstadoLectorQr = 'iniciando';
  mensajeError: string | null = null;

  /** true = iPhone/iPad/Safari -> usa zxing-wasm. false = Android/otros -> usa html5-qrcode. */
  readonly esPlataformaIOS = this.detectarIOS();

  // --- Estado interno rama iOS (zxing-wasm) ---
  private stream: MediaStream | null = null;
  private loopHandle: ReturnType<typeof setTimeout> | null = null;
  private decodificando = false;
  private pausadoZxing = false;
  private destruido = false;
  private readonly INTERVALO_DECODE_MS = 125;

  // --- Estado interno rama Android (html5-qrcode) ---
  private lector: Html5Qrcode | null = null;

  // --- Común a ambas ramas ---
  private ultimoToken: string | null = null;
  private ultimaLecturaTs = 0;
  private readonly COOLDOWN_MISMO_TOKEN_MS = 2000;

  // --- Lector USB tipo pistola (sin cambios, no toca cámara) ---
  private bufferScanner = '';
  private scannerResetTimeout: ReturnType<typeof setTimeout> | null = null;
  private ultimaTeclaTs = 0;
  private readonly SCANNER_INTERVALO_MAX_MS = 50;
  private readonly SCANNER_TOKEN_MIN_LARGO = 6;

  ngAfterViewInit(): void {
    if (this.esPlataformaIOS) {
      asegurarWasmConfigurado();
    }
    void this.iniciarCamara();
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.scannerResetTimeout) clearTimeout(this.scannerResetTimeout);
    if (this.loopHandle) clearTimeout(this.loopHandle);
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

  /**
   * iPadOS 13+ se identifica como 'MacIntel' en el userAgent (igual que una Mac normal),
   * por eso se complementa con el chequeo de puntos táctiles.
   */
  private detectarIOS(): boolean {
    const ua = navigator.userAgent;
    const esIphoneIpadClasico = /iPad|iPhone|iPod/.test(ua);
    const esIpadOS13Mas = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return esIphoneIpadClasico || esIpadOS13Mas;
  }

  private async iniciarCamara(): Promise<void> {
    if (this.esPlataformaIOS) {
      await this.iniciarCamaraIOS();
    } else {
      await this.iniciarCamaraAndroid();
    }
  }

  private async detenerCamara(): Promise<void> {
    if (this.esPlataformaIOS) {
      this.detenerCamaraIOS();
    } else {
      await this.detenerCamaraAndroid();
    }
  }

  // ============================================================
  // RAMA iOS / Safari — zxing-wasm (video + canvas manuales)
  // Idéntica a tu implementación original, solo renombrada *IOS.
  // ============================================================

  private async iniciarCamaraIOS(): Promise<void> {
    this.estado = 'iniciando';
    this.mensajeError = null;
    this.detenerCamaraIOS();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      const camaras = dispositivos.filter((d) => d.kind === 'videoinput');

      const traseraPreferida = camaras.find((c) => /back|trasera|rear|environment/i.test(c.label));
      const deviceIdActual = stream.getVideoTracks()[0]?.getSettings().deviceId;

      if (traseraPreferida && deviceIdActual !== traseraPreferida.deviceId) {
        stream.getTracks().forEach((t) => t.stop());
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: traseraPreferida.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } else {
        this.stream = stream;
      }

      if (!camaras.length) {
        this.estado = 'sin-camara';
        return;
      }

      const video = this.videoRef?.nativeElement;
      if (!video) {
        throw new Error('No se encontró el elemento <video> para la rama iOS.');
      }
      video.srcObject = this.stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;

      await video.play();

      this.estado = 'escaneando';
      this.pausadoZxing = false;
      this.iniciarLoopDecodeIOS();
    } catch (error) {
      this.estado = 'error-camara';
      this.mensajeError = 'No se pudo acceder a la cámara. Revisa los permisos del navegador.';
      console.error('💥 ERROR_INICIAR_CAMARA_QR_IOS', error);
    }
  }

  private iniciarLoopDecodeIOS(): void {
    const paso = async () => {
      if (this.destruido) return;

      if (!this.pausadoZxing && !this.bloqueado && !this.decodificando) {
        this.decodificando = true;
        try {
          await this.intentarDecodificarFrameIOS();
        } finally {
          this.decodificando = false;
        }
      }

      this.loopHandle = setTimeout(paso, this.INTERVALO_DECODE_MS);
    };
    this.loopHandle = setTimeout(paso, this.INTERVALO_DECODE_MS);
  }

  private async intentarDecodificarFrameIOS(): Promise<void> {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) return;

    const tam = Math.min(video.videoWidth, video.videoHeight) * 0.6;
    const sx = (video.videoWidth - tam) / 2;
    const sy = (video.videoHeight - tam) / 2;

    canvas.width = tam;
    canvas.height = tam;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, sx, sy, tam, tam, 0, 0, tam, tam);
    const imageData = ctx.getImageData(0, 0, tam, tam);

    try {
      const resultados = await readBarcodes(imageData, ZXING_READER_OPTIONS);
      if (resultados.length > 0 && resultados[0].text) {
        this.emitirLectura(resultados[0].text);
      }
    } catch (e) {
      console.error('💥 [QR] ERROR EN readBarcodes (iOS):', e);
    }
  }

  private detenerCamaraIOS(): void {
    if (this.loopHandle) {
      clearTimeout(this.loopHandle);
      this.loopHandle = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoRef?.nativeElement) {
      this.videoRef.nativeElement.srcObject = null;
    }
  }

  // ============================================================
  // RAMA Android / resto — html5-qrcode
  // Idéntica a tu implementación original, solo renombrada *Android.
  // ============================================================

  private async iniciarCamaraAndroid(): Promise<void> {
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
          useBarCodeDetectorIfSupported: true,
        },
      });

      await this.lector.start(
        camaraElegida,
        {
          fps: 15,
          videoConstraints: {
            deviceId: { exact: camaraElegida },
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' } as any],
          },
        },
        (texto) => this.emitirLectura(texto),
        () => {},
      );

      this.estado = 'escaneando';
    } catch (error) {
      this.estado = 'error-camara';
      this.mensajeError = 'No se pudo acceder a la cámara. Revisa los permisos del navegador.';
      console.error('💥 ERROR_INICIAR_CAMARA_QR_ANDROID', error);
    }
  }

  private async detenerCamaraAndroid(): Promise<void> {
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

  private pausarCamaraAndroidSiActiva(): void {
    try {
      if (this.lector?.getState() === Html5QrcodeScannerState.SCANNING) {
        this.lector.pause(true);
      }
    } catch {}
  }

  private reanudarCamaraAndroidSiPausada(): void {
    try {
      if (this.lector?.getState() === Html5QrcodeScannerState.PAUSED) {
        this.lector.resume();
      }
    } catch {}
  }

  // ============================================================
  // Común a ambas ramas
  // ============================================================

  private emitirLectura(token: string): void {
    const ahora = Date.now();

    if (this.bloqueado) return;
    if (token === this.ultimoToken && ahora - this.ultimaLecturaTs < this.COOLDOWN_MISMO_TOKEN_MS) {
      return;
    }

    this.ultimoToken = token;
    this.ultimaLecturaTs = ahora;

    if (this.esPlataformaIOS) {
      this.pausadoZxing = true;
    } else {
      this.pausarCamaraAndroidSiActiva();
    }

    this.codigoDetectado.emit(token);
  }

  /** Llamar desde el padre cuando ya terminó de procesar (éxito o error) para reanudar. */
  reanudar(): void {
    this.ultimoToken = null;
    if (this.esPlataformaIOS) {
      this.pausadoZxing = false;
    } else {
      this.reanudarCamaraAndroidSiPausada();
    }
  }
}