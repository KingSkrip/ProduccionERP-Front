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

export type EstadoLectorQr =
  | 'iniciando'
  | 'escaneando'
  | 'procesando'
  | 'error-camara'
  | 'sin-camara';

let contadorInstancias = 0;

// Se configura UNA sola vez para toda la app: le decimos a zxing-wasm de
// dónde bajar el binario .wasm (via CDN, no requiere tocar angular.json).
// Si tu política de seguridad no permite CDNs externos, cambia esta URL
// por la ruta a un asset local (ver notas al final).
let wasmConfigurado = false;
function asegurarWasmConfigurado(): void {
  if (wasmConfigurado) return;
  wasmConfigurado = true;
  console.log('🧩 [QR] Configurando módulo zxing-wasm...');
  prepareZXingModule({
    overrides: {
      locateFile: (path: string) => {
        const url = `https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/reader/${path}`;
        console.log('🧩 [QR] zxing-wasm pidiendo archivo:', path, '→', url);
        return url;
      },
    },
  });
  console.log('✅ [QR] prepareZXingModule() configurado (la carga real del wasm ocurre en el primer readBarcodes).');
}

const READER_OPTIONS: ReaderOptions = {
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

  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  estado: EstadoLectorQr = 'iniciando';
  mensajeError: string | null = null;

  private stream: MediaStream | null = null;
  private loopHandle: ReturnType<typeof setTimeout> | null = null;
  private decodificando = false;
  private pausado = false;
  private destruido = false;

  private ultimoToken: string | null = null;
  private ultimaLecturaTs = 0;
  private readonly COOLDOWN_MISMO_TOKEN_MS = 2000;
  /** Intervalo entre intentos de decode. ~8 fps es de sobra y no satura CPU. */
  private readonly INTERVALO_DECODE_MS = 125;

  // --- Lector USB tipo pistola (sin cambios, no toca cámara) ---
  private bufferScanner = '';
  private scannerResetTimeout: ReturnType<typeof setTimeout> | null = null;
  private ultimaTeclaTs = 0;
  private readonly SCANNER_INTERVALO_MAX_MS = 50;
  private readonly SCANNER_TOKEN_MIN_LARGO = 6;

  ngAfterViewInit(): void {
    asegurarWasmConfigurado();
    void this.iniciarCamara();
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.scannerResetTimeout) clearTimeout(this.scannerResetTimeout);
    if (this.loopHandle) clearTimeout(this.loopHandle);
    this.detenerCamara();
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
  this.detenerCamara();

  try {
    console.log('🎥 [QR] Paso 1: pidiendo getUserMedia inicial...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    console.log('✅ [QR] Paso 1 OK — stream inicial obtenido:', stream);

    console.log('🎥 [QR] Paso 2: enumerando dispositivos...');
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    const camaras = dispositivos.filter((d) => d.kind === 'videoinput');
    console.log('✅ [QR] Paso 2 OK — cámaras encontradas:', camaras);

    const traseraPreferida = camaras.find((c) => /back|trasera|rear|environment/i.test(c.label));
    console.log('ℹ️ [QR] Trasera preferida (por label):', traseraPreferida);

    const deviceIdActual = stream.getVideoTracks()[0]?.getSettings().deviceId;
    console.log('ℹ️ [QR] deviceId actual del stream:', deviceIdActual);

    if (traseraPreferida && deviceIdActual !== traseraPreferida.deviceId) {
      console.log('🎥 [QR] Paso 3: pidiendo getUserMedia específico para cámara trasera...');
      stream.getTracks().forEach((t) => t.stop());
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: traseraPreferida.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      console.log('✅ [QR] Paso 3 OK — stream trasera obtenido:', this.stream);
    } else {
      this.stream = stream;
      console.log('ℹ️ [QR] Se usa el stream inicial (ya era la trasera o no había otra).');
    }

    if (!camaras.length) {
      console.warn('⚠️ [QR] Sin cámaras listadas.');
      this.estado = 'sin-camara';
      return;
    }

    console.log('🎥 [QR] Paso 4: asignando srcObject al <video>...');
    const video = this.videoRef.nativeElement;
    video.srcObject = this.stream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    console.log('✅ [QR] Paso 4 OK — srcObject asignado. readyState:', video.readyState);

    console.log('🎥 [QR] Paso 5: llamando video.play()...');
    await video.play();
    console.log('✅ [QR] Paso 5 OK — video.play() resolvió. videoWidth/Height:', video.videoWidth, video.videoHeight);

    this.estado = 'escaneando';
    this.pausado = false;
    console.log('✅ [QR] Estado -> escaneando. Arrancando loop de decode...');
    this.iniciarLoopDecode();
  } catch (error) {
    this.estado = 'error-camara';
    this.mensajeError = 'No se pudo acceder a la cámara. Revisa los permisos del navegador.';
    console.error('💥 ERROR_INICIAR_CAMARA_QR', {
      name: (error as any)?.name,
      message: (error as any)?.message,
      error,
    });
  }
}
  private iniciarLoopDecode(): void {
    const paso = async () => {
      if (this.destruido) return;

      if (!this.pausado && !this.bloqueado && !this.decodificando) {
        this.decodificando = true;
        try {
          await this.intentarDecodificarFrame();
        } finally {
          this.decodificando = false;
        }
      }

      this.loopHandle = setTimeout(paso, this.INTERVALO_DECODE_MS);
    };
    this.loopHandle = setTimeout(paso, this.INTERVALO_DECODE_MS);
  }

private async intentarDecodificarFrame(): Promise<void> {
  const video = this.videoRef.nativeElement;
  const canvas = this.canvasRef.nativeElement;

  if (!video.videoWidth || !video.videoHeight) {
    console.log('⏭️ [QR] Frame saltado — video sin dimensiones aún.');
    return;
  }

  const tam = Math.min(video.videoWidth, video.videoHeight) * 0.6;
  const sx = (video.videoWidth - tam) / 2;
  const sy = (video.videoHeight - tam) / 2;

  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    console.warn('⚠️ [QR] No se pudo obtener contexto 2d del canvas.');
    return;
  }

  ctx.drawImage(video, sx, sy, tam, tam, 0, 0, tam, tam);
  const imageData = ctx.getImageData(0, 0, tam, tam);

  try {
    const resultados = await readBarcodes(imageData, READER_OPTIONS);
    console.log('🔍 [QR] Frame decodificado, resultados:', resultados.length, resultados);
    if (resultados.length > 0 && resultados[0].text) {
      console.log('🎯 [QR] ¡DETECTADO!', resultados[0].text);
      this.emitirLectura(resultados[0].text);
    }
  } catch (e) {
    console.error('💥 [QR] ERROR REAL EN readBarcodes (antes se tragaba silenciosamente):', e);
  }
}

  private detenerCamara(): void {
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

  private emitirLectura(token: string): void {
    const ahora = Date.now();

    if (this.bloqueado) return;
    if (token === this.ultimoToken && ahora - this.ultimaLecturaTs < this.COOLDOWN_MISMO_TOKEN_MS) {
      return;
    }

    this.ultimoToken = token;
    this.ultimaLecturaTs = ahora;

    this.pausado = true;
    this.codigoDetectado.emit(token);
  }

  /** Llamar desde el padre cuando ya terminó de procesar (éxito o error) para reanudar. */
  reanudar(): void {
    this.ultimoToken = null;
    this.pausado = false;
  }
}