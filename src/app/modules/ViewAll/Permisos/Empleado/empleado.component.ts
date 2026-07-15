import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { finalize } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';
import { CatalogoPermiso, ChecadorPermiso, PermisosService } from '../permisos.service';
import { PermisosModalComponent } from 'app/modules/modals/Permisos/PermisosModal.component';
import { MatDialog } from '@angular/material/dialog';

type RangoRapido = 'hoy' | 'semana' | 'mes' | 'anio' | null;
type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;

@Component({
  selector: 'permisos-empleado',
  templateUrl: './empleado.component.html',
  styleUrls: ['./empleado.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
})
export class EmpleadoComponent implements OnInit, OnChanges {
  @Input() identityId: number | null = null;
  @Input() catalogo: CatalogoPermiso[] = [];
  @Input() refrescarTrigger = 0;
  @Output() mensaje = new EventEmitter<Mensaje>();

  historial: ChecadorPermiso[] = [];
  cargandoHistorial = false;

  vistaEmpTab: 'activos' | 'historial' = 'activos';

  paginaActual = 1;
  readonly tamPagina = 6;
  refrescarEmpleadoTrigger = 0;
  paginaActualActivos = 1;
  readonly tamPaginaActivos = 6;

  filtroBusquedaEmp = '';
  filtroCatalogoIdEmp: number | null = null;
  filtroFechaDesdeEmp: string = new Date().toISOString().slice(0, 10);
  filtroFechaHastaEmp: string = new Date().toISOString().slice(0, 10);
  filtroRangoActivoEmp: RangoRapido = 'hoy';
  mostrarPanelFiltrosEmp = false;
  filaExpandidaEmpId: number | null = null;

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
        private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.cargarHistorial();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refrescarTrigger'] && !changes['refrescarTrigger'].firstChange) {
      this.cargarHistorial();
    }
    if (changes['identityId'] && !changes['identityId'].firstChange && this.identityId) {
      this.cargarHistorial();
    }
  }

  cambiarVistaEmpTab(tab: 'activos' | 'historial'): void {
    this.vistaEmpTab = tab;
    this.cdr.markForCheck();
  }

  cargarHistorial(): void {
    if (!this.identityId) return;
    this.cargandoHistorial = true;
    this.cdr.markForCheck();
    this.permisosService
      .historial(this.identityId)
      .pipe(
        finalize(() => {
          this.cargandoHistorial = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (historial) => {
          this.historial = historial;
          this.cdr.markForCheck();
        },
        error: () => this.mensaje.emit({ tipo: 'error', texto: 'No se pudo cargar tu historial de permisos.' }),
      });
  }

  resumenEstado(p: ChecadorPermiso): string {
    if (p.estado === 'aprobado') {
      return p.hora_fin ? `Aprobado · regreso máximo ${this.formatFechaHora(p.hora_fin)}` : 'Aprobado';
    }
    if (p.estado === 'rechazado') return 'Rechazado por tu jefe';
    return 'Falta aprobación de tu jefe';
  }

  get permisosActivos(): ChecadorPermiso[] {
    const hoy = this.hoyISO();
    return this.historial.filter((p) => {
      if (p.estado === 'rechazado') return false;
      if (!p.fecha_inicio || !p.fecha_fin) return false;
      const inicio = p.fecha_inicio.slice(0, 10);
      const fin = p.fecha_fin.slice(0, 10);
      const esHoy = hoy >= inicio && hoy <= fin;
      if (!esHoy) return false;
      const yaRegistroEntradaYSalida = !!p.hora_inicio && !!p.hora_fin;
      return !yaRegistroEntradaYSalida;
    });
  }

  get permisosActivosFiltrados(): ChecadorPermiso[] {
    const q = this.filtroBusquedaEmp.trim().toLowerCase();
    return this.permisosActivos.filter((p) => this.coincideConFiltrosEmp(p, q));
  }

  get totalPaginasActivos(): number {
    return Math.max(1, Math.ceil(this.permisosActivosFiltrados.length / this.tamPaginaActivos));
  }

  get permisosActivosPaginados(): ChecadorPermiso[] {
    const inicio = (this.paginaActualActivos - 1) * this.tamPaginaActivos;
    return this.permisosActivosFiltrados.slice(inicio, inicio + this.tamPaginaActivos);
  }

  irAPaginaActivos(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasActivos) return;
    this.paginaActualActivos = pagina;
    this.cdr.markForCheck();
  }

  paginaAnteriorActivos(): void {
    this.irAPaginaActivos(this.paginaActualActivos - 1);
  }

  paginaSiguienteActivos(): void {
    this.irAPaginaActivos(this.paginaActualActivos + 1);
  }

  get historialFiltrado(): ChecadorPermiso[] {
    const q = this.filtroBusquedaEmp.trim().toLowerCase();
    return this.historial.filter((p) => this.coincideConFiltrosEmp(p, q));
  }

  private coincideConFiltrosEmp(p: ChecadorPermiso, q: string): boolean {
    const nombreSeleccionado = this.filtroCatalogoIdEmp
      ? this.catalogo.find((c) => c.id === this.filtroCatalogoIdEmp)?.nombre
      : null;

    const coincideCatalogo = !nombreSeleccionado || p.catalogo?.nombre === nombreSeleccionado;

    const coincideFecha =
      (!this.filtroFechaDesdeEmp && !this.filtroFechaHastaEmp) ||
      this.rangoSolapaConFiltro(p, this.filtroFechaDesdeEmp, this.filtroFechaHastaEmp);

    const coincideBusqueda =
      !q ||
      (p.catalogo?.nombre ?? '').toLowerCase().includes(q) ||
      (p.motivo ?? '').toLowerCase().includes(q) ||
      (p.estado ?? '').toLowerCase().includes(q);

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

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.historialFiltrado.length / this.tamPagina));
  }

  get historialPaginado(): ChecadorPermiso[] {
    const inicio = (this.paginaActual - 1) * this.tamPagina;
    return this.historialFiltrado.slice(inicio, inicio + this.tamPagina);
  }

  get filtroCatalogoLabelEmp(): string {
    if (!this.filtroCatalogoIdEmp) return 'Todos los tipos';
    return this.catalogo.find((c) => c.id === this.filtroCatalogoIdEmp)?.nombre ?? 'Todos los tipos';
  }

  get filtrosBotonLabelEmp(): string {
    const partes: string[] = [];
    if (this.filtroCatalogoIdEmp) partes.push(this.filtroCatalogoLabelEmp);

    const etiquetasRango: Record<Exclude<RangoRapido, null>, string> = {
      hoy: 'Hoy',
      semana: 'Esta semana',
      mes: 'Este mes',
      anio: 'Este año',
    };

    if (this.filtroRangoActivoEmp) {
      partes.push(etiquetasRango[this.filtroRangoActivoEmp]);
    } else if (this.filtroFechaDesdeEmp || this.filtroFechaHastaEmp) {
      const desde = this.filtroFechaDesdeEmp ? this.formatFecha(this.filtroFechaDesdeEmp) : '…';
      const hasta = this.filtroFechaHastaEmp ? this.formatFecha(this.filtroFechaHastaEmp) : '…';
      partes.push(`${desde} – ${hasta}`);
    }

    return partes.length ? partes.join(' · ') : 'Filtros';
  }

  get hayFiltrosActivosEmp(): boolean {
    return !!(
      this.filtroCatalogoIdEmp ||
      this.filtroBusquedaEmp ||
      this.filtroFechaDesdeEmp ||
      this.filtroFechaHastaEmp
    );
  }

  togglePanelFiltrosEmp(): void {
    this.mostrarPanelFiltrosEmp = !this.mostrarPanelFiltrosEmp;
    this.cdr.markForCheck();
  }

  cerrarPanelFiltrosEmp(): void {
    this.mostrarPanelFiltrosEmp = false;
    this.cdr.markForCheck();
  }

  onBusquedaEmpChange(event: Event): void {
    this.filtroBusquedaEmp = (event.target as HTMLInputElement).value;
    this.paginaActual = 1;
    this.paginaActualActivos = 1;
    this.cdr.markForCheck();
  }

  onFiltroCatalogoEmpChange(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.filtroCatalogoIdEmp = valor ? Number(valor) : null;
    this.paginaActual = 1;
    this.paginaActualActivos = 1;
    this.cdr.markForCheck();
  }

  onFiltroFechaDesdeEmpChange(event: Event): void {
    this.filtroFechaDesdeEmp = (event.target as HTMLInputElement).value;
    this.filtroRangoActivoEmp = null;
    this.paginaActual = 1;
    this.cdr.markForCheck();
  }

  onFiltroFechaHastaEmpChange(event: Event): void {
    this.filtroFechaHastaEmp = (event.target as HTMLInputElement).value;
    this.filtroRangoActivoEmp = null;
    this.paginaActual = 1;
    this.cdr.markForCheck();
  }

  filtrarHoyEmp(): void {
    const hoy = new Date();
    this.aplicarRangoRapidoEmp(hoy, hoy, 'hoy');
  }

  filtrarSemanaEmp(): void {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diffLunes = dia === 0 ? -6 : 1 - dia;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diffLunes);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    this.aplicarRangoRapidoEmp(lunes, domingo, 'semana');
  }

  filtrarMesEmp(): void {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    this.aplicarRangoRapidoEmp(inicio, fin, 'mes');
  }

  filtrarAnioEmp(): void {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), 0, 1);
    const fin = new Date(hoy.getFullYear(), 11, 31);
    this.aplicarRangoRapidoEmp(inicio, fin, 'anio');
  }

  private aplicarRangoRapidoEmp(desde: Date, hasta: Date, tipo: Exclude<RangoRapido, null>): void {
    this.filtroFechaDesdeEmp = this.fechaAISO(desde);
    this.filtroFechaHastaEmp = this.fechaAISO(hasta);
    this.filtroRangoActivoEmp = tipo;
    this.paginaActual = 1;
    this.cdr.markForCheck();
  }

  limpiarFiltrosEmp(): void {
    this.filtroCatalogoIdEmp = null;
    this.filtroBusquedaEmp = '';
    this.filtrarHoyEmp();
    this.cdr.markForCheck();
  }

  toggleExpandirEmp(id: number): void {
    this.filaExpandidaEmpId = this.filaExpandidaEmpId === id ? null : id;
    this.cdr.markForCheck();
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    this.cdr.markForCheck();
  }

  paginaAnterior(): void {
    this.irAPagina(this.paginaActual - 1);
  }

  paginaSiguiente(): void {
    this.irAPagina(this.paginaActual + 1);
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

  colorAvatar(id?: number | null): string {
    if (!id) return this.paletaAvatar[0];
    return this.paletaAvatar[id % this.paletaAvatar.length];
  }

  private hoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private fechaAISO(d: Date): string {
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
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
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
  }

  formatFechaHora(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City',
    });
  }

  formatHora(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' });
  }


   abrirModalPermiso(): void {
      const ref = this.dialog.open(PermisosModalComponent, {
        width: '480px',
        maxWidth: '95vw',
        panelClass: 'permisos-modal-panel',
        autoFocus: false,
      });
      ref.afterClosed().subscribe((result) => {
        if (result?.success) {
          this.mensaje.emit({ tipo: 'ok', texto: result.mensaje ?? 'Permiso solicitado.' });
          this.refrescarEmpleadoTrigger++;
          this.cdr.markForCheck();
        }
      });
    }
}