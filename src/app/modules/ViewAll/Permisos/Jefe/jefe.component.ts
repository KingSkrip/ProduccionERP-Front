import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { finalize, forkJoin } from 'rxjs';

import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Injector } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { CatalogoPermiso } from 'app/modules/Checador/types/Catalogopermiso.types';
import { ChecadorPermiso } from 'app/modules/Checador/types/Checadorpermiso.types';
import { PermisosModalComponent } from 'app/modules/modals/Permisos/PermisosModal.component';
import { PermisosService } from '../permisos.service';

type RangoRapido = 'hoy' | 'semana' | 'mes' | 'anio' | null;
type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;

@Component({
  selector: 'permisos-jefe',
  templateUrl: './jefe.component.html',
  styleUrls: ['./jefe.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
})
export class JefeComponent implements OnInit, OnChanges {
  private overlayRef: OverlayRef | null = null;
  @Input() identityId: number | null = null;
  @Input() catalogo: CatalogoPermiso[] = [];
    @Input() esGerente = false;
  @Input() esJefeArea = false;
  @Input() esJefeAuxiliar = false; 
  @Output() mensaje = new EventEmitter<Mensaje>();

  pendientesJefe: ChecadorPermiso[] = [];
  cargandoJefe = false;
  resolviendoJefeId: number | null = null;
  comentariosJefePorPermiso: Record<number, string> = {};

  historialEquipo: ChecadorPermiso[] = [];
  cargandoHistorialEquipo = false;

  vistaJefeTab: 'pendientes' | 'historial' = 'pendientes';

  refrescarEmpleadoTrigger = 0;
  paginaActualPendientes = 1;
  readonly tamPaginaPendientes = 8;

  paginaActualEquipo = 1;
  readonly tamPaginaEquipo = 6;

  seleccionados = new Set<number>();
  resolviendoLote = false;

  filaExpandidaId: number | null = null;
  filaExpandidaEquipoId: number | null = null;

  filtroBusquedaJefe = '';
  filtroCatalogoIdJefe: number | null = null;
  filtroFechaDesde: string = this.calcularSemana().desde;
  filtroFechaHasta: string = this.calcularSemana().hasta;
  filtroRangoActivo: RangoRapido = 'semana';
  mostrarPanelFiltrosJefe = false;

  private readonly paletaAvatar = [
    'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  ];

  constructor(
    private permisosService: PermisosService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private overlay: Overlay,
    private injector: Injector,
  ) {}

  ngOnInit(): void {
    this.cargarPendientesJefe();
    this.cargarHistorialEquipo();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['identityId'] && !changes['identityId'].firstChange && this.identityId) {
      this.cargarPendientesJefe();
      this.cargarHistorialEquipo();
    }
  }

  cambiarVistaJefeTab(tab: 'pendientes' | 'historial'): void {
    this.vistaJefeTab = tab;
    this.cdr.markForCheck();
  }

  cargarPendientesJefe(): void {
    if (!this.identityId) return;
    this.cargandoJefe = true;
    this.cdr.markForCheck();
    this.permisosService
      .pendientesJefe(this.identityId)
      .pipe(
        finalize(() => {
          this.cargandoJefe = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (pendientes) => {
          this.pendientesJefe = pendientes;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pendientesJefe = [];
          this.cdr.markForCheck();
        },
      });
  }

  cargarHistorialEquipo(): void {
    if (!this.identityId) return;
    this.cargandoHistorialEquipo = true;
    this.cdr.markForCheck();
    this.permisosService
      .historialEquipo(this.identityId)
      .pipe(
        finalize(() => {
          this.cargandoHistorialEquipo = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (historial) => {
          this.historialEquipo = historial;
          this.cdr.markForCheck();
        },
        error: () => {
          this.historialEquipo = [];
          this.cdr.markForCheck();
        },
      });
  }

  onComentarioJefeChange(permisoId: number, event: Event): void {
    this.comentariosJefePorPermiso[permisoId] = (event.target as HTMLTextAreaElement).value;
  }

  aprobarComoJefe(p: ChecadorPermiso): void {
    this.resolverComoJefe(p, 'aprobado');
  }

  rechazarComoJefe(p: ChecadorPermiso): void {
    this.resolverComoJefe(p, 'rechazado');
  }

  private resolverComoJefe(p: ChecadorPermiso, estado: 'aprobado' | 'rechazado'): void {
    this.resolviendoJefeId = p.id;
    this.cdr.markForCheck();

    this.permisosService
      .resolver(p.id, 'jefe', {
        estado,
        comentarios_aprobador: this.comentariosJefePorPermiso[p.id] || undefined,
      })
      .pipe(
        finalize(() =>
          this.ngZone.run(() => {
            this.resolviendoJefeId = null;
            this.cdr.markForCheck();
          }),
        ),
      )
      .subscribe({
        next: () =>
          this.ngZone.run(() => {
            this.pendientesJefe = this.pendientesJefe.filter((x) => x.id !== p.id);
            this.mensaje.emit({
              tipo: 'ok',
              texto: estado === 'aprobado' ? 'Permiso aprobado.' : 'Permiso rechazado.',
            });
            this.cargarHistorialEquipo();
            this.cdr.markForCheck();
          }),
        error: (err) =>
          this.ngZone.run(() => {
            this.mensaje.emit({
              tipo: 'error',
              texto: err?.error?.message ?? 'No se pudo resolver el permiso.',
            });
            this.cdr.markForCheck();
          }),
      });
  }

  estaSeleccionado(id: number): boolean {
    return this.seleccionados.has(id);
  }

  toggleSeleccion(id: number): void {
    if (this.seleccionados.has(id)) this.seleccionados.delete(id);
    else this.seleccionados.add(id);
    this.cdr.markForCheck();
  }

  get haySeleccionados(): boolean {
    return this.seleccionados.size > 0;
  }

  get todosEnPaginaSeleccionados(): boolean {
    const idsPagina = this.pendientesJefePaginados.map((p) => p.id);
    return idsPagina.length > 0 && idsPagina.every((id) => this.seleccionados.has(id));
  }

  toggleSeleccionarTodoEnPagina(): void {
    const idsPagina = this.pendientesJefePaginados.map((p) => p.id);
    const todos = this.todosEnPaginaSeleccionados;
    idsPagina.forEach((id) => (todos ? this.seleccionados.delete(id) : this.seleccionados.add(id)));
    this.cdr.markForCheck();
  }

  limpiarSeleccion(): void {
    this.seleccionados.clear();
    this.cdr.markForCheck();
  }

  resolverSeleccionEnLote(estado: 'aprobado' | 'rechazado'): void {
    if (!this.seleccionados.size) return;
    this.resolviendoLote = true;
    this.cdr.markForCheck();

    const ids = Array.from(this.seleccionados);
    const llamadas = ids.map((id) => this.permisosService.resolver(id, 'jefe', { estado }));

    forkJoin(llamadas)
      .pipe(
        finalize(() =>
          this.ngZone.run(() => {
            this.resolviendoLote = false;
            this.cdr.markForCheck();
          }),
        ),
      )
      .subscribe({
        next: () =>
          this.ngZone.run(() => {
            this.pendientesJefe = this.pendientesJefe.filter((p) => !this.seleccionados.has(p.id));
            this.mensaje.emit({
              tipo: 'ok',
              texto:
                estado === 'aprobado'
                  ? `${ids.length} permiso(s) aprobado(s).`
                  : `${ids.length} permiso(s) rechazado(s).`,
            });
            this.seleccionados.clear();
            this.cargarHistorialEquipo();
            this.cdr.markForCheck();
          }),
        error: (err) =>
          this.ngZone.run(() => {
            this.mensaje.emit({
              tipo: 'error',
              texto:
                err?.error?.message ??
                'No se pudieron resolver algunos permisos. Intenta de nuevo.',
            });
            this.cdr.markForCheck();
          }),
      });
  }

  resumenEstadoEquipo(p: ChecadorPermiso): string {
    if (p.estado === 'aprobado') {
      return p.hora_fin
        ? `Aprobado · regreso máximo ${this.formatFechaHora(p.hora_fin)}`
        : 'Aprobado';
    }
    if (p.estado === 'rechazado') return 'Rechazado';
    return 'Falta de tu aprobación';
  }

  get pendientesJefeFiltrados(): ChecadorPermiso[] {
    const q = this.filtroBusquedaJefe.trim().toLowerCase();
    return this.pendientesJefe.filter((p) => this.coincideConFiltrosJefe(p, q));
  }

  get historialEquipoFiltrado(): ChecadorPermiso[] {
    const q = this.filtroBusquedaJefe.trim().toLowerCase();
    return this.historialEquipo.filter((p) => this.coincideConFiltrosJefe(p, q));
  }

  private coincideConFiltrosJefe(p: ChecadorPermiso, q: string): boolean {
    const nombreSeleccionado = this.filtroCatalogoIdJefe
      ? this.catalogo.find((c) => c.id === this.filtroCatalogoIdJefe)?.nombre
      : null;

    const coincideCatalogo = !nombreSeleccionado || p.catalogo?.nombre === nombreSeleccionado;

    const coincideFecha =
      (!this.filtroFechaDesde && !this.filtroFechaHasta) ||
      this.rangoSolapaConFiltro(p, this.filtroFechaDesde, this.filtroFechaHasta);

    const coincideBusqueda =
      !q ||
      (p.identity?.nombre ?? '').toLowerCase().includes(q) ||
      (p.identity?.apellido ?? '').toLowerCase().includes(q) ||
      (p.motivo ?? '').toLowerCase().includes(q) ||
      (p.catalogo?.nombre ?? '').toLowerCase().includes(q);

    return coincideCatalogo && coincideFecha && coincideBusqueda;
  }

  private rangoSolapaConFiltro(p: ChecadorPermiso, desde: string, hasta: string): boolean {
    if (!p.fecha_inicio || !p.fecha_fin) return false;
    const inicio = p.fecha_inicio.slice(0, 10);
    const fin = p.fecha_fin.slice(0, 10);
    if (desde && fin < desde) return false;
    if (hasta && inicio > hasta) return false;
    return true;
  }

  get totalPaginasPendientes(): number {
    return Math.max(1, Math.ceil(this.pendientesJefeFiltrados.length / this.tamPaginaPendientes));
  }

  get pendientesJefePaginados(): ChecadorPermiso[] {
    const inicio = (this.paginaActualPendientes - 1) * this.tamPaginaPendientes;
    return this.pendientesJefeFiltrados.slice(inicio, inicio + this.tamPaginaPendientes);
  }

  get totalPaginasEquipo(): number {
    return Math.max(1, Math.ceil(this.historialEquipoFiltrado.length / this.tamPaginaEquipo));
  }

  get historialEquipoPaginado(): ChecadorPermiso[] {
    const inicio = (this.paginaActualEquipo - 1) * this.tamPaginaEquipo;
    return this.historialEquipoFiltrado.slice(inicio, inicio + this.tamPaginaEquipo);
  }

  get filtroCatalogoLabelJefe(): string {
    if (!this.filtroCatalogoIdJefe) return 'Todos los tipos';
    return (
      this.catalogo.find((c) => c.id === this.filtroCatalogoIdJefe)?.nombre ?? 'Todos los tipos'
    );
  }

  get filtrosBotonLabelJefe(): string {
    const partes: string[] = [];
    if (this.filtroCatalogoIdJefe) partes.push(this.filtroCatalogoLabelJefe);

    const etiquetasRango: Record<Exclude<RangoRapido, null>, string> = {
      hoy: 'Hoy',
      semana: 'Esta semana',
      mes: 'Este mes',
      anio: 'Este año',
    };

    if (this.filtroRangoActivo) {
      partes.push(etiquetasRango[this.filtroRangoActivo]);
    } else if (this.filtroFechaDesde || this.filtroFechaHasta) {
      const desde = this.filtroFechaDesde ? this.formatFecha(this.filtroFechaDesde) : '…';
      const hasta = this.filtroFechaHasta ? this.formatFecha(this.filtroFechaHasta) : '…';
      partes.push(`${desde} – ${hasta}`);
    }

    return partes.length ? partes.join(' · ') : 'Filtros';
  }

  get hayFiltrosActivosJefe(): boolean {
    return !!(
      this.filtroCatalogoIdJefe ||
      this.filtroFechaDesde ||
      this.filtroFechaHasta ||
      this.filtroBusquedaJefe
    );
  }

  togglePanelFiltrosJefe(): void {
    this.mostrarPanelFiltrosJefe = !this.mostrarPanelFiltrosJefe;
    this.cdr.markForCheck();
  }

  cerrarPanelFiltrosJefe(): void {
    this.mostrarPanelFiltrosJefe = false;
    this.cdr.markForCheck();
  }

  onBusquedaJefeChange(event: Event): void {
    this.filtroBusquedaJefe = (event.target as HTMLInputElement).value;
    this.paginaActualPendientes = 1;
    this.paginaActualEquipo = 1;
    this.cdr.markForCheck();
  }

  onFiltroCatalogoJefeChange(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.filtroCatalogoIdJefe = valor ? Number(valor) : null;
    this.paginaActualPendientes = 1;
    this.paginaActualEquipo = 1;
    this.cdr.markForCheck();
  }

  onFiltroFechaDesdeChange(event: Event): void {
    this.filtroFechaDesde = (event.target as HTMLInputElement).value;
    this.filtroRangoActivo = null;
    this.paginaActualPendientes = 1;
    this.paginaActualEquipo = 1;
    this.cdr.markForCheck();
  }

  onFiltroFechaHastaChange(event: Event): void {
    this.filtroFechaHasta = (event.target as HTMLInputElement).value;
    this.filtroRangoActivo = null;
    this.paginaActualPendientes = 1;
    this.paginaActualEquipo = 1;
    this.cdr.markForCheck();
  }

  filtrarHoy(): void {
    const hoy = new Date();
    this.aplicarRangoRapido(hoy, hoy, 'hoy');
  }

  filtrarSemana(): void {
    const { desde, hasta } = this.calcularSemana();
    this.filtroFechaDesde = desde;
    this.filtroFechaHasta = hasta;
    this.filtroRangoActivo = 'semana';
    this.paginaActualPendientes = 1;
    this.paginaActualEquipo = 1;
    this.cdr.markForCheck();
  }

  filtrarMes(): void {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    this.aplicarRangoRapido(inicio, fin, 'mes');
  }

  filtrarAnio(): void {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), 0, 1);
    const fin = new Date(hoy.getFullYear(), 11, 31);
    this.aplicarRangoRapido(inicio, fin, 'anio');
  }

  private aplicarRangoRapido(desde: Date, hasta: Date, tipo: Exclude<RangoRapido, null>): void {
    this.filtroFechaDesde = this.fechaAISO(desde);
    this.filtroFechaHasta = this.fechaAISO(hasta);
    this.filtroRangoActivo = tipo;
    this.paginaActualPendientes = 1;
    this.paginaActualEquipo = 1;
    this.cdr.markForCheck();
  }

  limpiarFiltrosJefe(): void {
    this.filtroCatalogoIdJefe = null;
    this.filtroBusquedaJefe = '';
    this.filtrarSemana();
    this.cdr.markForCheck();
  }

  irAPaginaPendientes(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasPendientes) return;
    this.paginaActualPendientes = pagina;
    this.cdr.markForCheck();
  }

  paginaAnteriorPendientes(): void {
    this.irAPaginaPendientes(this.paginaActualPendientes - 1);
  }

  paginaSiguientePendientes(): void {
    this.irAPaginaPendientes(this.paginaActualPendientes + 1);
  }

  irAPaginaEquipo(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasEquipo) return;
    this.paginaActualEquipo = pagina;
    this.cdr.markForCheck();
  }

  paginaAnteriorEquipo(): void {
    this.irAPaginaEquipo(this.paginaActualEquipo - 1);
  }

  paginaSiguienteEquipo(): void {
    this.irAPaginaEquipo(this.paginaActualEquipo + 1);
  }

  toggleExpandir(id: number): void {
    this.filaExpandidaId = this.filaExpandidaId === id ? null : id;
    this.cdr.markForCheck();
  }

  toggleExpandirEquipo(id: number): void {
    this.filaExpandidaEquipoId = this.filaExpandidaEquipoId === id ? null : id;
    this.cdr.markForCheck();
  }

  etiquetaContador(n: number): string {
    return n > 999 ? '999+' : String(n);
  }

  inicialesDe(nombre?: string | null): string {
    if (!nombre) return '?';
    const partes = nombre.trim().split(/\s+/);
    return (
      partes
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  colorAvatar(id?: number | null): string {
    if (!id) return this.paletaAvatar[0];
    return this.paletaAvatar[id % this.paletaAvatar.length];
  }

  claseBadge(estado: string): string {
    switch (estado) {
      case 'aprobado':
        return 'bg-green-100 text-black dark:bg-green-500/20 dark:text-green-400';
      case 'rechazado':
        return 'bg-red-100 text-black dark:bg-red-500/20 dark:text-red-400';
      default:
        return 'bg-amber-100 text-black dark:bg-amber-500/20 dark:text-amber-400';
    }
  }

  private fechaAISO(d: Date): string {
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  /** Fecha de hoy en formato ISO (America/Mexico_City) para comparar contra los permisos */
  private hoyISO(): string {
    return this.fechaAISO(new Date());
  }

  /** true si el permiso es de hoy en adelante (aún se puede/debe aprobar) */
  esPermisoVigente(p: ChecadorPermiso): boolean {
    const referencia = p.fecha_fin ?? p.fecha_inicio;
    if (!referencia) return true;
    return referencia.slice(0, 10) >= this.hoyISO();
  }

  /** true si la fecha del permiso ya pasó sin haber sido resuelto */
  esPermisoCaducado(p: ChecadorPermiso): boolean {
    return !this.esPermisoVigente(p);
  }

  rangoFechas(p: ChecadorPermiso): string {
    const inicio = this.formatFecha(p.fecha_inicio);
    const fin = this.formatFecha(p.fecha_fin);
    return inicio === fin ? inicio : `${inicio} — ${fin}`;
  }

  private formatFecha(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Mexico_City',
    });
  }

  formatFechaHora(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City',
    });
  }

  formatHora(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City',
    });
  }

  abrirModalPermiso(): void {
    this.overlayRef = this.overlay.create({
      hasBackdrop: false,
      positionStrategy: this.overlay.position().global(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });

    const portal = new ComponentPortal(PermisosModalComponent, null, this.injector);
    const compRef = this.overlayRef.attach(portal);

    compRef.instance.cerrar = (result?: any) => {
      this.overlayRef?.dispose();
      this.overlayRef = null;

      if (result?.success) {
        this.mensaje.emit({ tipo: 'ok', texto: result.mensaje ?? 'Permiso solicitado.' });
        this.refrescarEmpleadoTrigger++;
        this.cdr.markForCheck();
      }
    };
  }

  get mostrarIndicadorFiltrosJefe(): boolean {
    return !!(
      this.filtroCatalogoIdJefe ||
      this.filtroBusquedaJefe ||
      (this.filtroRangoActivo && this.filtroRangoActivo !== 'hoy') ||
      (!this.filtroRangoActivo && (this.filtroFechaDesde || this.filtroFechaHasta))
    );
  }

  private calcularSemana(): { desde: string; hasta: string } {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diffLunes = dia === 0 ? -6 : 1 - dia;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diffLunes);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    return { desde: this.fechaAISO(lunes), hasta: this.fechaAISO(domingo) };
  }

  /** Texto legible del horario del permiso (todo el día / no regresa / rango) */
  infoHorario(p: ChecadorPermiso): string {
    if (!p.hora_inicio && !p.hora_fin) {
      return 'Todo el día';
    }
    if (p.no_regresa) {
      return `Sale ${this.formatHora(p.hora_inicio)} · No regresa`;
    }
    if (p.hora_inicio && p.hora_fin) {
      return `${this.formatHora(p.hora_inicio)} – ${this.formatHora(p.hora_fin)}`;
    }
    return this.formatHora(p.hora_inicio) || '—';
  }

  /** Etiqueta legible de la forma en que se paga el tiempo */
  etiquetaPagoTiempo(clave: ChecadorPermiso['tipo_pago_tiempo']): string {
    switch (clave) {
      case 'tiempo_por_tiempo':
        return 'Tiempo por tiempo';
      case 'dia_descanso':
        return 'Reposición en día de descanso';
      case 'sin_goce':
        return 'Sin goce de sueldo';
      default:
        return '';
    }
  }

  /** Ícono asociado a la forma de pago de tiempo */
  iconoPagoTiempo(clave: ChecadorPermiso['tipo_pago_tiempo']): string {
    switch (clave) {
      case 'tiempo_por_tiempo':
        return 'sync_alt';
      case 'dia_descanso':
        return 'event_repeat';
      case 'sin_goce':
        return 'money_off';
      default:
        return 'payments';
    }
  }

  formatFechaReposicion(p: ChecadorPermiso): string {
    return this.formatFecha(p.fecha_reposicion);
  }


    /**
   * Para cada permiso: si tú eres el jefe_id del puesto del colaborador
   * -> "titular"; si eres jefe_aux_id -> "auxiliar". Si por lo que sea
   * eres ambos (raro, pero posible en catálogos chicos) se prioriza titular.
   */
  rolFrenteA(p: ChecadorPermiso): 'titular' | 'auxiliar' | null {
    if (!this.identityId) return null;
    const puesto = p.identity?.puestoActivo;
    if (!puesto) return null;
    if (puesto.jefe_id === this.identityId) return 'titular';
    if (puesto.jefe_aux_id === this.identityId) return 'auxiliar';
    return null;
  }

  etiquetaRolFrenteA(p: ChecadorPermiso): string {
    const rol = this.rolFrenteA(p);
    if (rol === 'titular') return 'Como jefe directo';
    if (rol === 'auxiliar') return 'Como jefe auxiliar';
    return '';
  }

  claseBadgeRol(p: ChecadorPermiso): string {
    return this.rolFrenteA(p) === 'auxiliar'
      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
      : 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400';
  }
}
