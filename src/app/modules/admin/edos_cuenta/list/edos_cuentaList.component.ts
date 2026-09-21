import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import {
  MAT_DATE_LOCALE,
  MatNativeDateModule,
  MatOptionModule,
  MatRippleModule,
} from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fuseAnimations } from '@fuse/animations';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { EdosCuentaService, EstadoCuenta, ResumenEstadoCuenta } from '../edos_cuenta.service';

export const slideDown = trigger('slideDown', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(8px) scale(0.98)' }),
    animate('150ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
  ]),
  transition(':leave', [
    animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(8px) scale(0.98)' })),
  ]),
]);

@Component({
  selector: 'edos_cuenta-list',
  templateUrl: './edos_cuentaList.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatIconModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatSortModule,
    MatPaginatorModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatOptionModule,
    MatCheckboxModule,
    MatRippleModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule,
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-MX' }],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [...fuseAnimations, slideDown],
})
export class EdosCuentaListComponent implements OnInit, OnDestroy {
  // Data
  estadosCuenta: EstadoCuenta[] = [];
  estadosCuentaFiltrados: EstadoCuenta[] = [];
  resumen: ResumenEstadoCuenta | null = null;

  // Loading
  isLoading = true;
  isLoadingResumen = false;

  // Search & filters
  searchControl = new FormControl('');
  filtroAnio = new FormControl<number | null>(null);
  filtroEstado = new FormControl<string>('todos');
  aniosDisponibles: number[] = [];

  // Pagination
  paginaActual = 0;
  itemsPorPagina = 10;
  totalPaginas = 0;
  paginasVisibles: number[] = [];

  // Totales
  totalCargos = 0;
  totalAbonos = 0;
  totalSaldos = 0;

  // Selection
  documentosSeleccionados: Set<string> = new Set();
  todosSeleccionados = false;

  // Share/cache
  compartiendo = false;
  blobCache: Blob | null = null;
  blobCacheKey = '';

  Math = Math;
  private _cancelarPreparacion$ = new Subject<void>();
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  constructor(
    private _edosCuentaService: EdosCuentaService,
    private _snackBar: MatSnackBar,
    private _cdr: ChangeDetectorRef,
    private _dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.cargarEstadosCuenta();
    this.cargarResumen();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
    this._cancelarPreparacion$.next();
    this._cancelarPreparacion$.complete();
  }

  cargarEstadosCuenta(): void {
    this.isLoading = true;
    this._edosCuentaService
      .getEstadosCuenta()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.estadosCuenta = response.data;
            this.estadosCuentaFiltrados = [...this.estadosCuenta];
            this.totalCargos = response.total_cargos ?? 0;
            this.totalAbonos = response.total_abonos ?? 0;
            this.totalSaldos = response.total_saldos ?? 0;
            this.extraerAniosDisponibles();
            this.aplicarFiltros();
            this.calcularPaginacion();
          }
          this.isLoading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.mostrarError('Error al cargar estados de cuenta');
          this.isLoading = false;
          this._cdr.markForCheck();
        },
      });
  }

  cargarResumen(): void {
    this.isLoadingResumen = true;
    this._edosCuentaService
      .getResumen()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success) this.resumen = response.data;
          this.isLoadingResumen = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.isLoadingResumen = false;
          this._cdr.markForCheck();
        },
      });
  }

  setupSearch(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this._unsubscribeAll))
      .subscribe(() => this.aplicarFiltros());
  }

  aplicarFiltros(): void {
    let filtrados = [...this.estadosCuenta];

    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    if (searchTerm) {
      filtrados = filtrados.filter(
        (ec) =>
          ec.documento.toLowerCase().includes(searchTerm) ||
          ec.nombre.toLowerCase().includes(searchTerm) ||
          ec.rfc.toLowerCase().includes(searchTerm),
      );
    }

    if (this.filtroAnio.value) {
      filtrados = filtrados.filter(
        (ec) => new Date(ec.fecha_aplicacion).getFullYear() === this.filtroAnio.value,
      );
    }

    const estado = this.filtroEstado.value;
    if (estado && estado !== 'todos') {
      const hoy = new Date();
      filtrados = filtrados.filter((ec) => {
        if (estado === 'pagado') return ec.saldo === 0;
        if (estado === 'vencido') return ec.saldo > 0 && new Date(ec.fecha_vencimiento) < hoy;
        if (estado === 'pendiente') return ec.saldo > 0 && new Date(ec.fecha_vencimiento) >= hoy;
        return true;
      });
    }

    this.estadosCuentaFiltrados = filtrados;
    this.paginaActual = 0;
    this.calcularPaginacion();
    this._cdr.markForCheck();
  }

  extraerAniosDisponibles(): void {
    const anios = new Set<number>();
    this.estadosCuenta.forEach((ec) => anios.add(new Date(ec.fecha_aplicacion).getFullYear()));
    this.aniosDisponibles = Array.from(anios).sort((a, b) => b - a);
  }

  calcularPaginacion(): void {
    this.totalPaginas = Math.ceil(this.estadosCuentaFiltrados.length / this.itemsPorPagina);
    const maxPaginas = 5;
    const inicio = Math.max(0, this.paginaActual - Math.floor(maxPaginas / 2));
    const fin = Math.min(this.totalPaginas, inicio + maxPaginas);
    this.paginasVisibles = Array.from({ length: fin - inicio }, (_, i) => inicio + i);
  }

  get estadosCuentaPaginados(): EstadoCuenta[] {
    const inicio = this.paginaActual * this.itemsPorPagina;
    return this.estadosCuentaFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  paginaAnterior(): void {
    if (this.paginaActual > 0) {
      this.paginaActual--;
      this.calcularPaginacion();
      this._cdr.markForCheck();
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas - 1) {
      this.paginaActual++;
      this.calcularPaginacion();
      this._cdr.markForCheck();
    }
  }

  irAPagina(pagina: number): void {
    this.paginaActual = pagina;
    this.calcularPaginacion();
    this._cdr.markForCheck();
  }

  onItemsPorPaginaChange(): void {
    this.paginaActual = 0;
    this.calcularPaginacion();
    this._cdr.markForCheck();
  }

  // ── Selección ──
  toggleSeleccion(documento: string): void {
    if (this.documentosSeleccionados.has(documento)) {
      this.documentosSeleccionados.delete(documento);
    } else {
      this.documentosSeleccionados.add(documento);
    }
    this.actualizarEstadoSeleccionTodos();
    this.invalidarCache();
    this._cdr.markForCheck();
  }

  toggleSeleccionTodos(): void {
    if (this.todosSeleccionados) {
      this.documentosSeleccionados.clear();
    } else {
      this.estadosCuentaPaginados.forEach((ec) => this.documentosSeleccionados.add(ec.documento));
    }
    this.actualizarEstadoSeleccionTodos();
    this.invalidarCache();
    this._cdr.markForCheck();
  }

  actualizarEstadoSeleccionTodos(): void {
    const paginados = this.estadosCuentaPaginados;
    this.todosSeleccionados =
      paginados.length > 0 &&
      paginados.every((ec) => this.documentosSeleccionados.has(ec.documento));
  }

  limpiarSeleccion(): void {
    this.documentosSeleccionados.clear();
    this.todosSeleccionados = false;
    this.blobCache = null;
    this.blobCacheKey = '';
    this._cdr.markForCheck();
  }

  // Click síncrono — navigator.share() funciona aquí
  async compartirSeleccionados(): Promise<void> {
    if (!this.blobCache || this.compartiendo) return;

    const fecha = new Date().toISOString().split('T')[0];
    const fileName = `estados-cuenta-${fecha}.pdf`;
    const file = new File([this.blobCache], fileName, { type: 'application/pdf' });

    try {
      await navigator.share({ title: 'Estados de cuenta', files: [file] });
      this.limpiarSeleccion();
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        this.mostrarError('No se pudo compartir el PDF');
      }
    }
  }

  // ── Cache / background ──
  private invalidarCache(): void {
    this._cancelarPreparacion$.next();
    this.blobCache = null;
    this.blobCacheKey = '';
    this.compartiendo = false;

    if (this.documentosSeleccionados.size > 0) {
      this.prepararPDFEnBackground();
    }
    this._cdr.markForCheck();
  }

  private prepararPDFEnBackground(): void {
    const documentos = Array.from(this.documentosSeleccionados);
    const cacheKey = documentos.slice().sort().join(',');

    if (this.blobCacheKey === cacheKey && this.blobCache) return;

    this.compartiendo = true;
    this._cdr.markForCheck();

    this._edosCuentaService
      .descargarMultiples(documentos)
      .pipe(takeUntil(this._cancelarPreparacion$))
      .subscribe({
        next: (blob) => {
          const seleccionActual = Array.from(this.documentosSeleccionados).sort().join(',');
          if (seleccionActual !== cacheKey) return;

          this.blobCache = new Blob([blob], { type: 'application/pdf' });
          this.blobCacheKey = cacheKey;
          this.compartiendo = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.mostrarError('Error al preparar PDF');
          this.compartiendo = false;
          this._cdr.markForCheck();
        },
      });
  }

  // ── Utils ──
  getEstadoDocumento(ec: EstadoCuenta): { texto: string; clase: string } {
    if (ec.saldo === 0) return { texto: 'Pagado', clase: 'text-green-600 bg-green-100' };
    const hoy = new Date();
    if (new Date(ec.fecha_vencimiento) < hoy)
      return { texto: 'Vencido', clase: 'text-red-600 bg-red-100' };
    return { texto: 'Pendiente', clase: 'text-yellow-600 bg-yellow-100' };
  }

  getDiasVencimiento(fechaVenc: string): number {
    return Math.ceil((new Date(fechaVenc).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('');
    this.filtroAnio.setValue(null);
    this.filtroEstado.setValue('todos');
    this.aplicarFiltros();
  }

  hayFiltrosActivos(): boolean {
    return (
      !!this.searchControl.value || !!this.filtroAnio.value || this.filtroEstado.value !== 'todos'
    );
  }

  trackByDocumento(_: number, item: EstadoCuenta): string {
    return item.documento;
  }

  private mostrarExito(mensaje: string): void {
    this._snackBar.open(mensaje, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-success'],
    });
  }

  private mostrarError(mensaje: string): void {
    this._snackBar.open(mensaje, 'Cerrar', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-error'],
    });
  }
}
