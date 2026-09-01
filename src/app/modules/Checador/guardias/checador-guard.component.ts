import { CommonModule } from '@angular/common';
import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  ChecadaRegistradaEvent,
  GuardiaWebsocketService,
} from 'app/core/websockets/Checador/guardiawebsocket.service';
import {
  ChecadorRegistroResultado,
  ChecadorService,
  GuardiaBusquedaResultado,
  GuardiaPermisoHoy,
  GuardiaPuntualidad,
  GuardiaRestriccionEntrada,
  GuardiaRestriccionSalida, // 👈 importar del service, ya no redeclarar aquí
} from '../checador.service';

type EstadoGuard =
  | 'buscando'
  | 'sin-resultados'
  | 'resultados'
  | 'seleccionado'
  | 'procesando'
  | 'resultado'
  | 'error';

const MOTIVOS_MANUALES = [
  'No trae su QR',
  'No tiene datos / credencial no dada de alta',
  'Credencial robada o extraviada',
  'Otro',
] as const;

export interface NotificacionChecada {
  id: string;
  identityId: number;
  nombre: string;
  fotoUrl: string | null;
  iniciales: string;
  tipo: 'entrada' | 'salida' | 'Inicio de permiso' | 'Fin de permiso';
  hora: string;
  color: { bg: string; text: string; border: string };
  icono: string;
  etiqueta: string;
}

@Component({
  selector: 'app-checador-guard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './checador-guard.component.html',
  styleUrls: ['./checador-guard.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ChecadorGuardComponent implements OnInit, OnDestroy {
  notificacionesChecada: NotificacionChecada[] = [];

  private readonly NOTIF_DURACION_MS = 6000;
  private notifTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  readonly motivos = MOTIVOS_MANUALES;
  estado: EstadoGuard = 'buscando';
  mensajeError: string | null = null;

  termino = '';
  resultados: GuardiaBusquedaResultado[] = [];

  personaSeleccionada: GuardiaBusquedaResultado | null = null;
  motivoSeleccionado: string = MOTIVOS_MANUALES[0];
  motivoOtro = '';

  resultadoRegistro: ChecadorRegistroResultado | null = null;

  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 350;

  constructor(
    private checadorService: ChecadorService,
    private guardiaWs: GuardiaWebsocketService,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.guardiaWs.listenChecadas((checada) => {
      this.ngZone.run(() => {
        console.log('📡 Checada recibida:', checada);
        this.actualizarPorChecada(checada);
        if (checada.metodo === 'qr') {
          this.mostrarNotificacionChecada(checada);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.guardiaWs.stopListening();
    this.notifTimeouts.forEach((t) => clearTimeout(t));
    this.notifTimeouts.clear();
  }

  // ============================================================
  // Actualización en vivo por websocket
  // ============================================================

  /**
   * Cuando llega una checada de alguien más (QR, otro guardia, etc.),
   * refrescamos su estado_actual: en la lista de resultados si está
   * visible, y en la tarjeta de personaSeleccionada si es a quien el
   * guardia tiene abierto en pantalla. Así el botón de "Movimiento a
   * registrar" no se queda mostrando algo que ya no aplica.
   *
   * No tocamos nada si el guardia está a mitad de su propio registro
   * (procesando / resultado) para no pisarle el overlay.
   */
  private actualizarPorChecada(checada: any): void {
    const identityId: number | undefined = checada?.identityId ?? checada?.identity_id;
    if (!identityId) {
      return;
    }

    const idxResultado = this.resultados.findIndex((r) => r.identity_id === identityId);
    const esLaSeleccionada = this.personaSeleccionada?.identity_id === identityId;

    if (idxResultado === -1 && !esLaSeleccionada) {
      return; // no está en pantalla ahorita, no hay nada que refrescar
    }

    this.checadorService.estadoGuardia(identityId).subscribe({
      next: (estadoActual) => {
        if (idxResultado !== -1) {
          this.resultados = this.resultados.map((r, i) =>
            i === idxResultado ? { ...r, estado_actual: estadoActual } : r,
          );
        }

        if (esLaSeleccionada && this.estado === 'seleccionado') {
          this.personaSeleccionada = { ...this.personaSeleccionada!, estado_actual: estadoActual };
        }
      },
      error: (error) => {
        console.error('💥 ERROR_ESTADO_GUARDIA_WS', error);
      },
    });
  }
  // ============================================================
  // Búsqueda
  // ============================================================

  onTerminoChange(valor: string): void {
    this.termino = valor;

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    const limpio = valor.trim();
    this.personaSeleccionada = null;

    if (limpio.length < 2) {
      this.resultados = [];
      this.estado = 'buscando';
      return;
    }

    this.debounceTimeout = setTimeout(() => this.buscar(limpio), this.DEBOUNCE_MS);
  }

  private buscar(termino: string): void {
    this.checadorService.buscarGuardias(termino).subscribe({
      next: (resultados) => {
        this.resultados = resultados;
        this.estado = resultados.length ? 'resultados' : 'sin-resultados';
      },
      error: (error) => {
        console.error('💥 ERROR_BUSCAR_GUARDIA', error);
        this.resultados = [];
        this.estado = 'error';
        this.mensajeError = 'No se pudo buscar. Intenta de nuevo.';
      },
    });
  }

  // ============================================================
  // Selección + registro manual (entrada/salida/permiso, automático)
  // ============================================================

  seleccionar(persona: GuardiaBusquedaResultado): void {
    this.personaSeleccionada = persona;
    this.motivoSeleccionado = MOTIVOS_MANUALES[0];
    this.motivoOtro = '';
    this.mensajeError = null;
    this.estado = 'seleccionado';
  }

  cancelarSeleccion(): void {
    this.personaSeleccionada = null;
    this.estado = this.resultados.length ? 'resultados' : 'buscando';
  }

  /** El permiso aprobado y activo (comida, etc.) si lo hay, para mostrarlo. */
  get permisoDisponible() {
    return this.personaSeleccionada?.estado_actual?.permiso_disponible ?? null;
  }

  /**
   * Etiqueta del botón/movimiento. Si el siguiente paso involucra un
   * permiso, usamos el nombre real del catálogo (ej. "Comida") en vez
   * de un genérico, para que el guardia sepa exactamente qué está
   * registrando.
   */
  get etiquetaMovimientoSugerido(): string {
    const sugerido = this.personaSeleccionada?.estado_actual?.siguiente_movimiento_sugerido;
    const permiso = this.permisoDisponible;

    switch (sugerido) {
      case 'entrada':
        return 'Entrada';
      case 'salida':
        return 'Salida';
      case 'Inicio de permiso':
        return permiso ? `Salida a permiso: ${permiso.tipo}` : 'Salida a permiso';
      case 'Fin de permiso':
        return permiso ? `Regreso de permiso: ${permiso.tipo}` : 'Regreso de permiso';
      default:
        return 'Movimiento';
    }
  }

  /** true si el movimiento que se va a registrar es de permiso (inicio o fin). */
  get esMovimientoDePermiso(): boolean {
    const sugerido = this.personaSeleccionada?.estado_actual?.siguiente_movimiento_sugerido;
    return sugerido === 'Inicio de permiso' || sugerido === 'Fin de permiso';
  }

  registrar(): void {
    if (!this.personaSeleccionada || this.estado === 'procesando') {
      return;
    }

    const motivo =
      this.motivoSeleccionado === 'Otro'
        ? this.motivoOtro.trim() || 'Otro'
        : this.motivoSeleccionado;

    this.estado = 'procesando';
    this.mensajeError = null;

    // El backend decide solo si es entrada/salida/inicio-permiso/fin-permiso
    // según el estado de la identidad (misma lógica que el QR). El front
    // no manda el tipo, solo el motivo del registro manual.
    this.checadorService.registrarGuardia(this.personaSeleccionada.identity_id, motivo).subscribe({
      next: (resultado) => {
        this.resultadoRegistro = resultado;
        this.estado = 'resultado';
      },
      error: (error) => {
        this.mensajeError =
          error?.error?.message ?? 'No se pudo registrar la checada, intenta de nuevo.';
        this.estado = 'error';
      },
    });
  }

  nuevaBusqueda(): void {
    this.termino = '';
    this.resultados = [];
    this.personaSeleccionada = null;
    this.resultadoRegistro = null;
    this.mensajeError = null;
    this.estado = 'buscando';
  }

  // ============================================================
  // Helpers de presentación para el overlay de resultado
  // ============================================================

  getFoto(photoPath: string | null): string {
    return this.checadorService.userPhoto(photoPath);
  }

  get usuarioFotoUrl(): string | null {
    const photoPath = (this.resultadoRegistro as any)?.usuario?.foto ?? null;
    if (!photoPath) return null;
    return this.getFoto(photoPath);
  }

  get iniciales(): string {
    const nombre = (this.resultadoRegistro as any)?.usuario?.nombre?.trim();
    if (!nombre) return '?';
    const partes = nombre.split(/\s+/).filter(Boolean);
    const primera = partes[0]?.[0] ?? '';
    const segunda = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primera + segunda).toUpperCase();
  }

  get nombreEmpleado(): string {
    return (this.resultadoRegistro as any)?.usuario?.nombre ?? 'Empleado';
  }

  /** Nombre del permiso que quedó registrado, para mostrarlo en el overlay. */
  get permisoRegistradoNombre(): string | null {
    return this.resultadoRegistro?.permiso?.catalogo?.nombre ?? null;
  }

  // ============================================================
  // Presentación por tipo de movimiento (icono + color)
  // ============================================================

  get iconoMovimiento(): string {
    switch (this.personaSeleccionada?.estado_actual?.siguiente_movimiento_sugerido) {
      case 'entrada':
        return 'heroicons_outline:arrow-right-on-rectangle';
      case 'salida':
        return 'heroicons_outline:arrow-left-on-rectangle';
      case 'Inicio de permiso':
        return 'heroicons_outline:clock';
      case 'Fin de permiso':
        return 'heroicons_outline:arrow-uturn-left';
      default:
        return 'heroicons_outline:user';
    }
  }

  get colorMovimiento(): { bg: string; text: string; ring: string } {
    switch (this.personaSeleccionada?.estado_actual?.siguiente_movimiento_sugerido) {
      case 'entrada':
        return { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/30' };
      case 'salida':
        return { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/30' };
      case 'Inicio de permiso':
        return { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/30' };
      case 'Fin de permiso':
        return { bg: 'bg-sky-500', text: 'text-sky-500', ring: 'ring-sky-500/30' };
      default:
        return { bg: 'bg-slate-500', text: 'text-slate-500', ring: 'ring-slate-500/30' };
    }
  }

  get areaSeleccionado(): string | null {
    return this.personaSeleccionada?.estado_actual?.area ?? null;
  }

  get jefeSeleccionado(): string | null {
    return this.personaSeleccionada?.estado_actual?.jefe ?? null;
  }

  get puntualidadSeleccionado(): GuardiaPuntualidad | null {
    return this.personaSeleccionada?.estado_actual?.puntualidad ?? null;
  }

  get flagsSeleccionado(): string[] {
    return this.personaSeleccionada?.estado_actual?.flags_extraordinarios ?? [];
  }

  get fotoPersonaSeleccionada(): string | null {
    const foto = this.personaSeleccionada?.foto ?? null;
    return foto ? this.checadorService.userPhoto(foto) : null;
  }

  get inicialesSeleccionado(): string {
    const nombre = this.personaSeleccionada?.nombre?.trim();
    if (!nombre) return '?';
    const partes = nombre.split(/\s+/).filter(Boolean);
    const primera = partes[0]?.[0] ?? '';
    const segunda = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primera + segunda).toUpperCase();
  }

  get puntualidadColor(): { bg: string; text: string } {
    switch (this.puntualidadSeleccionado?.estado) {
      case 'retardo':
        return { bg: 'bg-red-500', text: 'text-red-500' };
      case 'anticipado':
        return { bg: 'bg-sky-500', text: 'text-sky-500' };
      case 'a_tiempo':
        return { bg: 'bg-emerald-500', text: 'text-emerald-500' };
      default:
        return { bg: 'bg-slate-500', text: 'text-slate-400' };
    }
  }

  get sinInfoAdicional(): boolean {
    return (
      !this.areaSeleccionado &&
      !this.jefeSeleccionado &&
      !this.jefeAuxSeleccionado &&
      !this.puntualidadSeleccionado &&
      !this.permisoDisponible &&
      !this.permisosHoySeleccionado.length &&
      !this.flagsSeleccionado.length
    );
  }

  get jefeAuxSeleccionado(): string | null {
    return this.personaSeleccionada?.estado_actual?.jefe_aux ?? null;
  }

  get permisosHoySeleccionado(): GuardiaPermisoHoy[] {
    return this.personaSeleccionada?.estado_actual?.permisos_hoy ?? [];
  }

  colorPermiso(estado: string): { bg: string; text: string } {
    switch (estado) {
      case 'aprobado':
        return { bg: 'bg-emerald-500/10', text: 'text-emerald-500' };
      case 'rechazado':
        return { bg: 'bg-red-500/10', text: 'text-red-500' };
      default:
        return { bg: 'bg-amber-500/10', text: 'text-amber-500' };
    }
  }

  etiquetaEstadoPermiso(estado: string): string {
    switch (estado) {
      case 'aprobado':
        return 'Aprobado';
      case 'rechazado':
        return 'Rechazado';
      case 'pendiente':
        return 'Pendiente';
      default:
        return 'Solicitado';
    }
  }

  get sinInfoJornada(): boolean {
    return !this.puntualidadSeleccionado && !this.flagsSeleccionado.length;
  }

  get sinPermisosHoy(): boolean {
    return !this.permisoDisponible && !this.permisosHoySeleccionado.length;
  }

  get restriccionSalida(): GuardiaRestriccionSalida | null {
    return this.personaSeleccionada?.estado_actual?.restriccion_salida ?? null;
  }

  // ============================================================
  // Notificaciones de checadas automáticas (QR), apilables
  // ============================================================

  private mostrarNotificacionChecada(checada: ChecadaRegistradaEvent): void {
    const id = `${checada.identity_id}-${Date.now()}`;
    const presentacion = this.presentacionMovimiento(checada.tipo);

    const notificacion: NotificacionChecada = {
      id,
      identityId: checada.identity_id,
      nombre: checada.nombre ?? 'Empleado',
      fotoUrl: checada.foto ? this.checadorService.userPhoto(checada.foto) : null,
      iniciales: this.inicialesDeNombre(checada.nombre),
      tipo: checada.tipo,
      hora: checada.hora,
      ...presentacion,
    };

    // Se agrega arriba de la pila para que la más reciente quede primero.
    this.notificacionesChecada = [notificacion, ...this.notificacionesChecada];

    const timeout = setTimeout(() => this.cerrarNotificacion(id), this.NOTIF_DURACION_MS);
    this.notifTimeouts.set(id, timeout);
  }

  cerrarNotificacion(id: string): void {
    this.notificacionesChecada = this.notificacionesChecada.filter((n) => n.id !== id);

    const timeout = this.notifTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.notifTimeouts.delete(id);
    }
  }

  private inicialesDeNombre(nombre: string | null): string {
    const limpio = nombre?.trim();
    if (!limpio) return '?';
    const partes = limpio.split(/\s+/).filter(Boolean);
    const primera = partes[0]?.[0] ?? '';
    const segunda = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primera + segunda).toUpperCase();
  }

  private presentacionMovimiento(tipo: ChecadaRegistradaEvent['tipo']): {
    color: { bg: string; text: string; border: string };
    icono: string;
    etiqueta: string;
  } {
    switch (tipo) {
      case 'entrada':
        return {
          color: { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500' },
          icono: 'heroicons_outline:arrow-right-on-rectangle',
          etiqueta: 'Entrada',
        };
      case 'salida':
        return {
          color: { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500' },
          icono: 'heroicons_outline:arrow-left-on-rectangle',
          etiqueta: 'Salida',
        };
      case 'Inicio de permiso':
        return {
          color: { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500' },
          icono: 'heroicons_outline:clock',
          etiqueta: 'Salida a permiso',
        };
      case 'Fin de permiso':
        return {
          color: { bg: 'bg-sky-500', text: 'text-sky-500', border: 'border-sky-500' },
          icono: 'heroicons_outline:arrow-uturn-left',
          etiqueta: 'Regreso de permiso',
        };
      default:
        return {
          color: { bg: 'bg-slate-500', text: 'text-slate-500', border: 'border-slate-500' },
          icono: 'heroicons_outline:user',
          etiqueta: 'Movimiento',
        };
    }
  }

  get restriccionEntrada(): GuardiaRestriccionEntrada | null {
    return this.personaSeleccionada?.estado_actual?.restriccion_entrada ?? null;
  }
}
