// Rh/rh.component.ts
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { CatalogoPermiso } from 'app/modules/Checador/types/Catalogopermiso.types';
import { ChecadorPermiso } from 'app/modules/Checador/types/Checadorpermiso.types';
import {
  ExportarExcelDialogComponent,
  ExportarExcelResultado,
} from 'app/modules/modals/TarjetasAsistencia/exportar-excel-dialog.component';
import { finalize } from 'rxjs';
import { PermisosService } from '../permisos.service';

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;
type RangoRapido = 'semana_pasada' | 'semana_actual' | 'semana_siguiente' | 'personalizado' | null;

/** Días permitidos para el selector de fecha personalizada: 0=domingo, 5=viernes, 6=sábado */
const DIAS_PERMITIDOS = [0, 5, 6];

/** Opción genérica para los selects de Área / Departamento / Turno */
export interface OpcionFiltro {
  id: number;
  nombre: string;
}

interface PermisoDia {
  id: number;
  tipo: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  no_regresa: boolean;
  motivo: string;
}

interface DiaTarjeta {
  fecha: string;
  dia_semana: string;
  es_descanso: boolean;
  horario_esperado: string;
  hora_entrada_real: string | null;
  hora_salida_real: string | null;
  horas_trabajadas: number;
  permisos: PermisoDia[];
}

interface TarjetaAsistencia {
  identity_id: number;
  nombre: string;
  empresa: string | null;
  turno: { id: number; nombre: string } | null;
  semana: { desde: string; hasta: string };
  dias: DiaTarjeta[];
  total_horas_semana: number;
}

interface RespuestaEquipo {
  data: TarjetaAsistencia[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
}

export interface OpcionEmpresa {
  id: string;
  nombre: string;
}

export const EMPRESAS_ASISTENCIA: OpcionEmpresa[] = [
  { id: '01', nombre: 'Gordon Lerma Go' },
  { id: '02', nombre: 'Fibra 26' },
  { id: '03', nombre: 'Fibra Ballesta' },
  { id: '04', nombre: 'Comercializadora Fibrasan S.A. de C.V.' },
  { id: '05', nombre: 'BH Continental' },
];

@Component({
  selector: 'permisos-rh',
  templateUrl: './rh.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatFormFieldModule, MatDatepickerModule, MatInputModule],
})
export class RhComponent implements OnInit {
  @Input() identityId: number | null = null;
  @Input() catalogo: CatalogoPermiso[] = [];
  empresas: OpcionEmpresa[] = EMPRESAS_ASISTENCIA;
  /** Listas para los selects del panel de filtros */
  @Input() areas: OpcionFiltro[] = [];
  @Input() departamentos: OpcionFiltro[] = [];
  @Input() turnos: OpcionFiltro[] = [];

  @Output() mensaje = new EventEmitter<Mensaje>();

  vistaRhTab: 'aprobaciones' | 'asistencia' = 'aprobaciones';

  pendientesRh: ChecadorPermiso[] = [];
  cargandoPendientes = false;

  tarjetas: TarjetaAsistencia[] = [];
  cargandoTarjetas = false;
  fechaSemana = new Date().toISOString().slice(0, 10);
  empresaFiltro = '';
  paginaActual = 1;
  totalPaginas = 1;
  totalEmpleados = 0;
  filaExpandidaId: number | null = null;

  // ------------------------------------------------------------------
  // Filtros (panel estilo "jefe")
  // ------------------------------------------------------------------
  filtroBusquedaRh = '';
  mostrarPanelFiltrosRh = false;
  filtroAreaId: number | null = null;
  filtroDepartamentoId: number | null = null;
  filtroTurnoId: number | null = null;
  filtroCatalogoId: number | null = null;
  filtroRangoActivo: RangoRapido = 'semana_actual';
  errorFechaPersonalizada: string | null = null;

  private debounceBusquedaHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private permisosService: PermisosService,
    private cdr: ChangeDetectorRef,
    private dateAdapter: DateAdapter<any>,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.cargarPendientesRh();
    this.cargarTarjetas();
  }

  cambiarTab(tab: 'aprobaciones' | 'asistencia'): void {
    this.vistaRhTab = tab;
    this.cdr.markForCheck();
  }

  cargarPendientesRh(): void {
    if (this.identityId == null) {
      this.pendientesRh = [];
      return;
    }

    this.cargandoPendientes = true;

    this.permisosService
      .pendientesJefe(this.identityId)
      .pipe(
        finalize(() => {
          this.cargandoPendientes = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (data) => {
          this.pendientesRh = data;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pendientesRh = [];
        },
      });
  }

  resolverComoRh(p: ChecadorPermiso, estado: 'aprobado' | 'rechazado'): void {
    this.permisosService.resolver(p.id, 'rh', { estado }).subscribe({
      next: () => {
        this.pendientesRh = this.pendientesRh.filter((x) => x.id !== p.id);
        this.mensaje.emit({
          tipo: 'ok',
          texto: estado === 'aprobado' ? 'Permiso aprobado.' : 'Permiso rechazado.',
        });
        this.cdr.markForCheck();
      },
      error: (err) =>
        this.mensaje.emit({ tipo: 'error', texto: err?.error?.message ?? 'No se pudo resolver.' }),
    });
  }

  // ------------------------------------------------------------------
  // Carga de tarjetas de asistencia (con todos los filtros aplicados)
  // ------------------------------------------------------------------
  cargarTarjetas(pagina = 1): void {
    this.cargandoTarjetas = true;
    this.paginaActual = pagina;

    this.permisosService
      .asistenciaEquipoSemana({
        fecha: this.fechaSemana,
        page: pagina,
        empresa: this.empresaFiltro || undefined,
        areaId: this.filtroAreaId ?? undefined,
        departamentoId: this.filtroDepartamentoId ?? undefined,
        turnoId: this.filtroTurnoId ?? undefined,
        catalogoId: this.filtroCatalogoId ?? undefined,
        busqueda: this.filtroBusquedaRh || undefined,
      })
      .pipe(
        finalize(() => {
          this.cargandoTarjetas = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.tarjetas = res.data;
          this.totalPaginas = res.meta.last_page;
          this.totalEmpleados = res.meta.total;
          this.cdr.markForCheck();
        },
        error: () => {
          this.tarjetas = [];
        },
      });
  }

  onFechaSemanaChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value;
    if (!valor) return;

    // 'T00:00:00' evita que el parseo interprete la fecha en UTC y la recorra un día
    const diaSemana = new Date(`${valor}T00:00:00`).getDay();

    if (!DIAS_PERMITIDOS.includes(diaSemana)) {
      this.errorFechaPersonalizada = 'Solo puedes elegir viernes, sábado o domingo.';
      input.value = this.fechaSemana; // revierte lo que se ve en el picker
      this.cdr.markForCheck();
      return;
    }

    this.errorFechaPersonalizada = null;
    this.fechaSemana = valor;
    this.filtroRangoActivo = 'personalizado';
    this.cargarTarjetas(1);
  }

  onEmpresaChange(event: Event): void {
    this.empresaFiltro = (event.target as HTMLSelectElement).value;
    this.cargarTarjetas(1);
  }

  toggleExpandir(id: number): void {
    this.filaExpandidaId = this.filaExpandidaId === id ? null : id;
    this.cdr.markForCheck();
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) this.cargarTarjetas(this.paginaActual - 1);
  }
  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) this.cargarTarjetas(this.paginaActual + 1);
  }

  descargarExcel(identityId: number): void {
    this.permisosService.descargarExcel(identityId, this.fechaSemana);
  }

  // descargarExcelTodos(): void {
  //   this.permisosService.descargarExcelTodos(this.fechaSemana, this.empresaFiltro || undefined);
  // }

  // ------------------------------------------------------------------
  // Panel de filtros
  // ------------------------------------------------------------------
  get hayFiltrosActivosRh(): boolean {
    return !!(
      this.filtroBusquedaRh ||
      this.empresaFiltro ||
      this.filtroAreaId ||
      this.filtroDepartamentoId ||
      this.filtroTurnoId ||
      this.filtroCatalogoId
    );
  }

  get mostrarIndicadorFiltrosRh(): boolean {
    return this.hayFiltrosActivosRh;
  }

  get filtrosBotonLabelRh(): string {
    const activos = [
      this.empresaFiltro ? 1 : 0,
      this.filtroAreaId ? 1 : 0,
      this.filtroDepartamentoId ? 1 : 0,
      this.filtroTurnoId ? 1 : 0,
      this.filtroCatalogoId ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    return activos ? `Filtros (${activos})` : 'Filtros';
  }

  togglePanelFiltrosRh(): void {
    this.mostrarPanelFiltrosRh = !this.mostrarPanelFiltrosRh;
    this.cdr.markForCheck();
  }

  cerrarPanelFiltrosRh(): void {
    this.mostrarPanelFiltrosRh = false;
    this.cargarTarjetas(1);
    this.cdr.markForCheck();
  }

  onBusquedaRhChange(event: Event): void {
    this.filtroBusquedaRh = (event.target as HTMLInputElement).value;

    // Debounce para no disparar una request en cada tecla
    if (this.debounceBusquedaHandle) {
      clearTimeout(this.debounceBusquedaHandle);
    }
    this.debounceBusquedaHandle = setTimeout(() => this.cargarTarjetas(1), 350);
  }

  onFiltroAreaChange(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.filtroAreaId = valor ? Number(valor) : null;
  }

  onFiltroDepartamentoChange(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.filtroDepartamentoId = valor ? Number(valor) : null;
  }

  onFiltroTurnoChange(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.filtroTurnoId = valor ? Number(valor) : null;
  }

  onFiltroCatalogoRhChange(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.filtroCatalogoId = valor ? Number(valor) : null;
  }

  limpiarFiltrosRh(): void {
    this.filtroBusquedaRh = '';
    this.empresaFiltro = '';
    this.filtroAreaId = null;
    this.filtroDepartamentoId = null;
    this.filtroTurnoId = null;
    this.filtroCatalogoId = null;
    this.filtroRangoActivo = 'semana_actual';
    this.errorFechaPersonalizada = null;
    this.mostrarPanelFiltrosRh = false;
    this.cargarTarjetas(1);
  }

  // ------------------------------------------------------------------
  // Accesos rápidos de semana
  // ------------------------------------------------------------------
  private moverSemana(offsetSemanas: number): void {
    const fecha = new Date(`${this.fechaSemana}T00:00:00`);
    fecha.setDate(fecha.getDate() + offsetSemanas * 7);
    this.fechaSemana = fecha.toISOString().slice(0, 10);
  }

  filtrarSemanaPasada(): void {
    this.filtroRangoActivo = 'semana_pasada';
    this.errorFechaPersonalizada = null;
    this.moverSemana(-1);
    this.cargarTarjetas(1);
  }

  filtrarSemanaActual(): void {
    this.filtroRangoActivo = 'semana_actual';
    this.errorFechaPersonalizada = null;
    this.fechaSemana = new Date().toISOString().slice(0, 10);
    this.cargarTarjetas(1);
  }

  filtrarSemanaSiguiente(): void {
    this.filtroRangoActivo = 'semana_siguiente';
    this.errorFechaPersonalizada = null;
    this.moverSemana(1);
    this.cargarTarjetas(1);
  }

  /**
   * Filtro del datepicker: solo permite viernes, sábado y domingo.
   * Se reconstruye una fecha nativa (año/mes/día) a mediodía para evitar
   * que el adaptador de fechas (Moment/Luxon/nativo) o la zona horaria
   * desfasen el día de la semana.
   */
  soloFinSemana = (date: any | null): boolean => {
    if (!date) return false;

    const anio = this.dateAdapter.getYear(date);
    const mes = this.dateAdapter.getMonth(date); // ya viene 0-indexado, igual que Date nativo
    const diaMes = this.dateAdapter.getDate(date);

    // Mediodía evita que un cambio de zona horaria recorra la fecha un día
    const fechaNativa = new Date(anio, mes, diaMes, 12, 0, 0);
    const diaSemana = fechaNativa.getDay(); // 0=domingo, 5=viernes, 6=sábado

    return diaSemana === 5 || diaSemana === 6 || diaSemana === 0;
  };

  onFechaChangeMaterial(event: MatDatepickerInputEvent<Date>) {
    if (!event.value) return;

    const anio = this.dateAdapter.getYear(event.value);
    const mes = this.dateAdapter.getMonth(event.value) + 1; // 0-indexado -> 1-indexado
    const diaMes = this.dateAdapter.getDate(event.value);

    const anioStr = String(anio);
    const mesStr = String(mes).padStart(2, '0');
    const diaStr = String(diaMes).padStart(2, '0');

    this.fechaSemana = `${anioStr}-${mesStr}-${diaStr}`;
    this.errorFechaPersonalizada = null;
    this.filtroRangoActivo = 'personalizado';
    this.cargarTarjetas(1);
  }

  formatHoras(decimalHoras: number | null | undefined): string {
    if (decimalHoras == null || isNaN(decimalHoras)) return '—';

    const horas = Math.floor(decimalHoras);
    let minutos = Math.round((decimalHoras - horas) * 60);

    // Corrige el caso borde donde el redondeo da 60 minutos
    if (minutos === 60) {
      return `${horas + 1}:00`;
    }

    return `${horas}:${minutos.toString().padStart(2, '0')}`;
  }

  /**
   * Convierte "08:00 - 18:00" en horas totales que dura ese horario (ej. 10)
   */
  private horasDelRango(horario: string | null | undefined): number {
    if (!horario) return 0;

    const match = horario.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!match) return 0;

    const inicio = Number(match[1]) + Number(match[2]) / 60;
    let fin = Number(match[3]) + Number(match[4]) / 60;

    // por si algún turno cruza medianoche
    if (fin <= inicio) fin += 24;

    return fin - inicio;
  }

  /**
   * Diferencia entre lo trabajado y lo esperado ese día.
   * Positivo = tiempo extra a favor. Negativo = le faltó cubrir horas.
   */
  tiempoExtra(dia: DiaTarjeta): number {
    if (dia.es_descanso) return 0;

    const esperadas = this.horasDelRango(dia.horario_esperado);
    const trabajadas = dia.horas_trabajadas ?? 0;
    const extra = trabajadas - esperadas;

    return Math.round(extra * 100) / 100; // evita basura de decimales flotantes
  }

  formatTiempoExtra(dia: DiaTarjeta): string {
    const extra = this.tiempoExtra(dia);
    if (extra === 0) return '—';

    const signo = extra > 0 ? '+' : '-';
    return `${signo}${this.formatHoras(Math.abs(extra))}`;
  }

  abrirModalExportarTodos(): void {
    const ref = this.dialog.open(ExportarExcelDialogComponent, {
      data: {
        empresas: this.empresas,
        areas: this.areas,
        departamentos: this.departamentos,
        turnos: this.turnos,
      },

      panelClass: 'ps-dialog-panel', // 👈 clase para resetear estilos
      width: '100vw',
      maxWidth: '100vw',
      height: '100dvh',
      hasBackdrop: false, // tu propio div ya pinta el backdrop (bg-black/60)
      autoFocus: false,
    });

    ref.afterClosed().subscribe((resultado: ExportarExcelResultado | undefined) => {
      if (!resultado) return;
      this.permisosService.descargarExcelTodos(this.fechaSemana, resultado);
    });
  }
}
