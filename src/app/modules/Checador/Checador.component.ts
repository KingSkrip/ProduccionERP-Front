import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';

import { APP_CONFIG } from 'app/core/config/app-config';
import { ChecadorRegistroResultado, ChecadorService } from './checador.service';

type EstadoChecador =
  | 'iniciando'
  | 'escaneando'
  | 'procesando'
  | 'resultado'
  | 'error-camara'
  | 'error-registro'
  | 'sin-camara';

/** De dónde vino la última lectura, solo para feedback visual sutil. */
type OrigenLectura = 'camara' | 'scanner';

/** Cómo mostramos el resultado en pantalla, ya resuelto a partir de tipo + en_permiso. */
type EstadoResultado = 'entrada' | 'salida' | 'salida-permiso' | 'regreso-permiso';

@Component({
  selector: 'app-checador',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './checador.component.html',
  styleUrls: ['./checador.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ChecadorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('lector', { static: true }) lectorRef!: ElementRef<HTMLDivElement>;

  /** Debe coincidir con el id del div que renderiza Html5Qrcode (ver template). */
  readonly lectorId = 'checador-qr-reader';

  estado: EstadoChecador = 'iniciando';
  mensajeError: string | null = null;
  resultado: ChecadorRegistroResultado | null = null;
  origenUltimaLectura: OrigenLectura | null = null;

  /**
   * true  -> PC (el lector USB es el flujo normal aquí; sin cámara no es
   *          error, es lo esperado).
   * false -> dispositivo táctil (celular/tablet montado solo para ver
   *          resultados, ej. pantalla informativa en la entrada).
   */
  readonly esEscritorio: boolean;

  /** Evita disparar dos requests si el frame vuelve a detectar el mismo QR mientras procesamos. */
  private procesandoToken = false;

  /** Evita reprocesar el mismo QR de inmediato apenas se cierra el resultado en pantalla. */
  private ultimoTokenLeido: string | null = null;
  private cooldownTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly COOLDOWN_ERROR_MS = 4000;
  private readonly COOLDOWN_RESULTADO_MS = 3500;

  private lector: Html5Qrcode | null = null;

  // ============================================================
  // Lector USB tipo pistola (funciona como teclado: escribe rápido
  // y termina con Enter). No depende de la cámara, así que sigue
  // funcionando aunque el equipo no tenga cámara conectada — que es
  // el caso normal en las PCs del checador.
  // ============================================================
  private bufferScanner = '';
  private scannerResetTimeout: ReturnType<typeof setTimeout> | null = null;
  private ultimaTeclaTimestamp = 0;
  /** Si dos teclas llegan más rápido que esto, asumimos que es una pistola lectora. */
  private readonly SCANNER_INTERVALO_MAX_MS = 50;
  /** Token mínimo razonable para no disparar con basura si alguien mantiene una tecla. */
  private readonly SCANNER_TOKEN_MIN_LARGO = 6;

  constructor(private checadorService: ChecadorService) {
    this.esEscritorio = this.detectarEscritorio();
  }

  ngAfterViewInit(): void {
    // Se arranca hasta afterViewInit porque Html5Qrcode necesita que el
    // div del lector ya exista en el DOM.
    void this.iniciarCamara();
  }

  ngOnDestroy(): void {
    if (this.cooldownTimeout) {
      clearTimeout(this.cooldownTimeout);
    }
    if (this.scannerResetTimeout) {
      clearTimeout(this.scannerResetTimeout);
    }
    void this.detenerCamara();
  }

  /** Botón de "reintentar" cuando falló el acceso a la cámara, o para buscar una recién conectada. */
  reintentarCamara(): void {
    void this.iniciarCamara();
  }

  /**
   * Heurística simple para saber si este equipo es una PC (mouse/teclado,
   * donde va el lector USB) o una pantalla táctil (celular/tablet que
   * probablemente solo se usa para visualizar, no para checar).
   */
  private detectarEscritorio(): boolean {
    const esPuntero = window.matchMedia?.('(pointer: fine)').matches ?? true;
    const sinTouch = (navigator.maxTouchPoints ?? 0) === 0;
    return esPuntero || sinTouch;
  }

  // ============================================================
  // Lector USB (pistola) — escucha global de teclado
  // ============================================================

  @HostListener('window:keydown', ['$event'])
  onKeydownGlobal(event: KeyboardEvent): void {
    // No interferir si el foco está en un input/textarea (ej. búsqueda
    // manual de empleado): ahí el usuario está tecleando de verdad.
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
      return;
    }

    const ahora = Date.now();
    const intervalo = ahora - this.ultimaTeclaTimestamp;
    this.ultimaTeclaTimestamp = ahora;

    if (event.key === 'Enter') {
      const token = this.bufferScanner;
      this.bufferScanner = '';

      if (token.length >= this.SCANNER_TOKEN_MIN_LARGO) {
        this.onQrDetectado(token, 'scanner');
      }
      return;
    }

    // Ignoramos teclas de control (Shift, Ctrl, flechas, etc.), solo
    // nos interesan caracteres imprimibles de un solo dígito/letra.
    if (event.key.length !== 1) {
      return;
    }

    // Si pasó demasiado tiempo desde la tecla anterior, alguien está
    // tecleando normal (no es una pistola lectora): reiniciamos buffer.
    if (this.bufferScanner.length > 0 && intervalo > this.SCANNER_INTERVALO_MAX_MS) {
      this.bufferScanner = '';
    }

    this.bufferScanner += event.key;

    if (this.scannerResetTimeout) {
      clearTimeout(this.scannerResetTimeout);
    }
    // Si no llega el Enter en un rato, tiramos el buffer (evita que
    // texto suelto se acumule para siempre).
    this.scannerResetTimeout = setTimeout(() => (this.bufferScanner = ''), 300);
  }

  // ============================================================
  // Cámara (opcional — el flujo principal siempre es el lector USB)
  // ============================================================

  private async iniciarCamara(): Promise<void> {
    this.estado = 'iniciando';
    this.mensajeError = null;

    try {
      const camaras = await Html5Qrcode.getCameras();

      if (!camaras?.length) {
        // Sin cámara NO es un error: en una PC es lo normal (se usa el
        // lector USB). El template distingue si además es una pantalla
        // de solo visualización.
        this.estado = 'sin-camara';
        this.mensajeError = null;
        return;
      }

      // Preferimos la cámara trasera cuando el navegador la etiqueta así
      // (celulares/tablets usados como lector fijo del checador).
      const camaraElegida =
        camaras.find((c) => /back|trasera|rear/i.test(c.label))?.id ?? camaras[0].id;

      this.lector = new Html5Qrcode(this.lectorId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });

      await this.lector.start(
        camaraElegida,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (textoDecodificado) => this.onQrDetectado(textoDecodificado, 'camara'),
        () => {
          // Callback de "no se detectó nada en este frame": se ignora a propósito,
          // Html5Qrcode lo llama constantemente mientras no hay QR en cuadro.
        },
      );

      this.estado = 'escaneando';
    } catch (error) {
      this.estado = 'error-camara';
      this.mensajeError = 'No se pudo acceder a la cámara. Revisa los permisos del navegador.';
      console.error('💥 ERROR_INICIAR_CAMARA_CHECADOR', error);
    }
  }

  private async detenerCamara(): Promise<void> {
    if (!this.lector) return;

    try {
      await this.lector.stop();
      this.lector.clear();
    } catch {
      // Si ya estaba detenida (ej. destroy antes de terminar de iniciar), no pasa nada.
    } finally {
      this.lector = null;
    }
  }

  // ============================================================
  // Procesar lectura (cámara o scanner, misma lógica)
  // ============================================================

  private onQrDetectado(token: string, origen: OrigenLectura): void {
    if (this.procesandoToken || token === this.ultimoTokenLeido) {
      return;
    }

    this.procesandoToken = true;
    this.ultimoTokenLeido = token;
    this.origenUltimaLectura = origen;
    this.estado = 'procesando';
    this.mensajeError = null;

    this.pausarCamaraSiActiva();

    this.checadorService.registrarPorToken(token).subscribe({
      next: (resultado) => {
        this.resultado = resultado;
        this.estado = 'resultado';
        this.procesandoToken = false;
        this.programarReinicioLectura(this.COOLDOWN_RESULTADO_MS);
      },
      error: (error) => {
        this.mensajeError =
          error?.error?.message ?? 'No se pudo registrar la checada, intenta de nuevo.';
        this.estado = 'error-registro';
        this.resultado = null;
        this.procesandoToken = false;
        this.programarReinicioLectura(this.COOLDOWN_ERROR_MS);
      },
    });
  }

  /** Después de mostrar el resultado/error unos segundos, regresa a modo "escaneando". */
  private programarReinicioLectura(delayMs: number): void {
    if (this.cooldownTimeout) {
      clearTimeout(this.cooldownTimeout);
    }

    this.cooldownTimeout = setTimeout(() => {
      this.resultado = null;
      this.mensajeError = null;
      this.estado = this.lector ? 'escaneando' : 'sin-camara';
      this.reanudarCamaraSiPausada();
      this.ultimoTokenLeido = null;
    }, delayMs);
  }

  // ============================================================
  // Helpers de presentación (todo derivado de tipo + en_permiso,
  // sin necesitar campos nuevos del backend)
  // ============================================================

  get estadoResultado(): EstadoResultado | null {
    if (!this.resultado) return null;

    switch (this.resultado.tipo) {
      case 'entrada':
        return 'entrada';
      case 'salida':
        return 'salida';
      case 'Inicio de permiso':
        return 'salida-permiso';
      case 'Fin de permiso':
        return 'regreso-permiso';
      default:
        return null;
    }
  }

get tituloResultado(): string {
  if (this.resultado?.es_primer_registro_dia) {
    return '¡Bienvenido!';
  }

  const libre = this.resultado?.autorizada_libre;
  const esCierre = this.resultado?.es_cierre_de_turno;

  switch (this.estadoResultado) {
    case 'entrada':
      return 'Regreso autorizado';

    case 'salida':
      if (!libre) {
        return '¡Hasta luego!';
      }
      return esCierre ? '¡Hasta luego!' : 'Salida autorizada';

    case 'salida-permiso':
      return 'Salida a permiso';

    case 'regreso-permiso':
      return 'Regreso de permiso';

    default:
      return '';
  }
}

// NUEVO: texto de detalle debajo de la hora — retardo, anticipación o tiempo extra
get detalleResultado(): string | null {
  const p = this.resultado?.puntualidad;
  if (!p) return null;

  // --- caso entrada (incluye el primer registro del día) ---
  if (this.estadoResultado === 'entrada') {
    if (p.es_retardo && p.minutos_retardo > 0) {
      return `Retardo: ${this.formatearMinutos(p.minutos_retardo)}`;
    }
    return null; // llegó a tiempo / dentro de tolerancia → solo se muestra la hora
  }

  // --- caso salida ---
  if (this.estadoResultado === 'salida') {
    if (p.minutos_anticipacion > 0) {
      return `Salida anticipada: ${this.formatearMinutos(p.minutos_anticipacion)}`;
    }
    if (p.horas_extra > 0) {
      return `Tiempo extra: ${this.formatearHoras(p.horas_extra)}`;
    }
    return null; // salió justo a su hora (o dentro de tolerancia)
  }

  return null;
}

private formatearMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

private formatearHoras(horasDecimal: number): string {
  const totalMin = Math.round(horasDecimal * 60);
  return this.formatearMinutos(totalMin);
}

  get etiquetaHora(): string {
    return this.estadoResultado === 'salida' ? 'Hora de salida:' : 'Hora:';
  }

  /** Color de acento según el tipo de checada — se aplica como CSS var en el template. */
  get colorAcento(): string {
    switch (this.estadoResultado) {
      case 'entrada':
        return '#34d399';
      case 'salida':
        return '#60a5fa';
      case 'salida-permiso':
        return '#fbbf24';
      case 'regreso-permiso':
        return '#2dd4bf';
      default:
        return '#f87171';
    }
  }

  /** Texto del motivo cuando es permiso (ej. "Comida"), vacío si no aplica. */
  get motivoPermiso(): string {
    return this.resultado?.permiso?.motivo ?? '';
  }

  get nombreEmpleado(): string {
    return this.resultado?.usuario?.nombre ?? 'Empleado';
  }

  get iniciales(): string {
    const nombre = this.resultado?.usuario?.nombre?.trim();
    if (!nombre) return '?';

    const partes = nombre.split(/\s+/).filter(Boolean);
    const primera = partes[0]?.[0] ?? '';
    const segunda = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primera + segunda).toUpperCase();
  }

  get tienePuntualidadRelevante(): boolean {
    const p = this.resultado?.puntualidad;
    if (!p) return false;
    return p.es_retardo || p.minutos_anticipacion > 0 || p.horas_extra > 0;
  }

  get tipoPermisoNombre(): string {
    return this.resultado?.permiso?.catalogo?.nombre ?? this.motivoPermiso;
  }

  get retardoFormateado(): string {
    const min = this.resultado?.puntualidad?.minutos_retardo;
    return min ? this.formatearDuracion(min) : '';
  }

  get anticipacionFormateada(): string {
    const min = this.resultado?.puntualidad?.minutos_anticipacion;
    return min ? this.formatearDuracion(min) : '';
  }

  get horasExtraFormateadas(): string {
    const horas = this.resultado?.puntualidad?.horas_extra;
    return horas ? this.formatearDuracion(horas * 60) : '';
  }

  /** Convierte minutos totales a "Xh Ymin Zs" (omite las partes en cero). */
  private formatearDuracion(totalMinutos: number): string {
    const horas = Math.floor(totalMinutos / 60);
    const minutos = Math.floor(totalMinutos % 60);
    const segundos = Math.round((totalMinutos % 1) * 60);

    const partes: string[] = [];
    if (horas > 0) partes.push(`${horas}h`);
    if (minutos > 0 || horas === 0) partes.push(`${minutos}min`);
    if (segundos > 0) partes.push(`${segundos}s`);
    return partes.join(' ');
  }

  get usuarioFotoUrl(): string {
    const foto = this.resultado?.usuario?.foto;
    if (!foto) return '';

    const base = APP_CONFIG.apiBase.endsWith('/') ? APP_CONFIG.apiBase : APP_CONFIG.apiBase + '/';
    const rutaLimpia = foto.startsWith('/') ? foto.substring(1) : foto;

    return `${base}${rutaLimpia}`;
  }

  private pausarCamaraSiActiva(): void {
    try {
      if (this.lector && this.lector.getState() === Html5QrcodeScannerState.SCANNING) {
        this.lector.pause(true);
      }
    } catch (error) {
      console.warn('No se pudo pausar la cámara', error);
    }
  }

  private reanudarCamaraSiPausada(): void {
    try {
      if (this.lector && this.lector.getState() === Html5QrcodeScannerState.PAUSED) {
        this.lector.resume();
      }
    } catch (error) {
      console.warn('No se pudo reanudar la cámara', error);
    }
  }
}
