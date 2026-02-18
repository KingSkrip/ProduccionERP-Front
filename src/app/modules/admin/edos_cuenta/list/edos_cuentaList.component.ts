import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
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
  animations: fuseAnimations,
})
export class EdosCuentaListComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput: any;

  // Data
  estadosCuenta: EstadoCuenta[] = [];
  estadosCuentaFiltrados: EstadoCuenta[] = [];
  resumen: ResumenEstadoCuenta | null = null;

  // Loading states
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
  totalCargos: number = 0;
  totalAbonos: number = 0;
  totalSaldos: number = 0;

  // Selection
  documentosSeleccionados: Set<string> = new Set();
  todosSeleccionados = false;

  // Utils
  Math = Math;
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
  }

  /**
   * Cargar estados de cuenta
   */
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
            this.totalCargos = response.total_cargos ?? 0; // 👈
            this.totalAbonos = response.total_abonos ?? 0; // 👈
            this.totalSaldos = response.total_saldos ?? 0; // 👈
            this.extraerAniosDisponibles();
            this.aplicarFiltros();
            this.calcularPaginacion();
          }
          this.isLoading = false;
          this._cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar estados de cuenta:', error);
          this.mostrarError('Error al cargar estados de cuenta');
          this.isLoading = false;
          this._cdr.markForCheck();
        },
      });
  }

  /**
   * Cargar resumen
   */
  cargarResumen(): void {
    this.isLoadingResumen = true;

    this._edosCuentaService
      .getResumen()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.resumen = response.data;
          }
          this.isLoadingResumen = false;
          this._cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar resumen:', error);
          this.isLoadingResumen = false;
          this._cdr.markForCheck();
        },
      });
  }

  /**
   * Setup búsqueda
   */
  setupSearch(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this._unsubscribeAll))
      .subscribe(() => {
        this.aplicarFiltros();
      });
  }

  /**
   * Aplicar filtros
   */
  aplicarFiltros(): void {
    let filtrados = [...this.estadosCuenta];

    // Filtro de búsqueda
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    if (searchTerm) {
      filtrados = filtrados.filter(
        (ec) =>
          ec.documento.toLowerCase().includes(searchTerm) ||
          ec.nombre.toLowerCase().includes(searchTerm) ||
          ec.rfc.toLowerCase().includes(searchTerm),
      );
    }

    // Filtro por año
    if (this.filtroAnio.value) {
      filtrados = filtrados.filter((ec) => {
        const anio = new Date(ec.fecha_aplicacion).getFullYear();
        return anio === this.filtroAnio.value;
      });
    }

    // Filtro por estado
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

  /**
   * Extraer años disponibles de los documentos
   */
  extraerAniosDisponibles(): void {
    const anios = new Set<number>();
    this.estadosCuenta.forEach((ec) => {
      const anio = new Date(ec.fecha_aplicacion).getFullYear();
      anios.add(anio);
    });
    this.aniosDisponibles = Array.from(anios).sort((a, b) => b - a);
  }

  /**
   * Calcular paginación
   */
  calcularPaginacion(): void {
    this.totalPaginas = Math.ceil(this.estadosCuentaFiltrados.length / this.itemsPorPagina);

    // Calcular páginas visibles
    const maxPaginas = 5;
    const inicio = Math.max(0, this.paginaActual - Math.floor(maxPaginas / 2));
    const fin = Math.min(this.totalPaginas, inicio + maxPaginas);

    this.paginasVisibles = Array.from({ length: fin - inicio }, (_, i) => inicio + i);
  }

  /**
   * Obtener documentos paginados
   */
  get estadosCuentaPaginados(): EstadoCuenta[] {
    const inicio = this.paginaActual * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.estadosCuentaFiltrados.slice(inicio, fin);
  }

  /**
   * Navegación de paginación
   */
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

  /**
   * Selección de documentos
   */
  toggleSeleccion(documento: string): void {
    if (this.documentosSeleccionados.has(documento)) {
      this.documentosSeleccionados.delete(documento);
    } else {
      this.documentosSeleccionados.add(documento);
    }
    this.actualizarEstadoSeleccionTodos();
    this._cdr.markForCheck();
  }

  toggleSeleccionTodos(): void {
    if (this.todosSeleccionados) {
      this.documentosSeleccionados.clear();
    } else {
      this.estadosCuentaPaginados.forEach((ec) => {
        this.documentosSeleccionados.add(ec.documento);
      });
    }
    this.actualizarEstadoSeleccionTodos();
    this._cdr.markForCheck();
  }

  actualizarEstadoSeleccionTodos(): void {
    const todosPaginadosSeleccionados = this.estadosCuentaPaginados.every((ec) =>
      this.documentosSeleccionados.has(ec.documento),
    );
    this.todosSeleccionados = todosPaginadosSeleccionados && this.estadosCuentaPaginados.length > 0;
  }

  /**
   * Descargar PDF individual
   */
  descargarPDF(documento: string): void {
    this._edosCuentaService.descargarPDF(documento).subscribe({
      next: (blob) => {
        this.descargarArchivo(blob, `estado-cuenta-${documento}.pdf`);
        this.mostrarExito('PDF descargado correctamente');
      },
      error: (error) => {
        console.error('Error al descargar PDF:', error);
        this.mostrarError('Error al descargar PDF');
      },
    });
  }

  /**
   * Descargar múltiples PDFs
   */
  descargarSeleccionados(): void {
    // if (this.documentosSeleccionados.size === 0) {
    //   this.mostrarError('Selecciona al menos un documento');
    //   return;
    // }

    const documentos = Array.from(this.documentosSeleccionados);

    this._edosCuentaService.descargarMultiples(documentos).subscribe({
      next: (blob) => {
        const fecha = new Date().toISOString().split('T')[0];
        this.descargarArchivo(blob, `estados-cuenta-${fecha}.pdf`);
        this.mostrarExito('PDFs descargados correctamente');
        this.documentosSeleccionados.clear();
        this.todosSeleccionados = false;
        this._cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al descargar PDFs:', error);
        this.mostrarError('Error al descargar PDFs');
      },
    });
  }

  /**
   * Enviar por email
   */
  enviarEmail(documento: string): void {
    const email = prompt('Ingresa el email de destino:');
    if (!email) return;

    this._edosCuentaService.enviarPorEmail(documento, email).subscribe({
      next: (response) => {
        if (response.success) {
          this.mostrarExito('Email enviado correctamente');
        }
      },
      error: (error) => {
        console.error('Error al enviar email:', error);
        this.mostrarError('Error al enviar email');
      },
    });
  }

  /**
   * Determinar estado visual del documento
   */
  getEstadoDocumento(ec: EstadoCuenta): {
    texto: string;
    clase: string;
  } {
    if (ec.saldo === 0) {
      return { texto: 'Pagado', clase: 'text-green-600 bg-green-100' };
    }

    const hoy = new Date();
    const fechaVenc = new Date(ec.fecha_vencimiento);

    if (fechaVenc < hoy) {
      return { texto: 'Vencido', clase: 'text-red-600 bg-red-100' };
    }

    return { texto: 'Pendiente', clase: 'text-yellow-600 bg-yellow-100' };
  }

  /**
   * Calcular días hasta vencimiento
   */
  getDiasVencimiento(fechaVenc: string): number {
    const hoy = new Date();
    const vencimiento = new Date(fechaVenc);
    const diff = vencimiento.getTime() - hoy.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Limpiar filtros
   */
  limpiarFiltros(): void {
    this.searchControl.setValue('');
    this.filtroAnio.setValue(null);
    this.filtroEstado.setValue('todos');
    this.aplicarFiltros();
  }

  /**
   * Helper para descargar archivo
   */
  private descargarArchivo(blob: Blob, nombreArchivo: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Mostrar notificaciones
   */
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

  // Agregar este método al final del componente, antes del último }
  trackByDocumento(index: number, item: EstadoCuenta): string {
    return item.documento;
  }

  hayFiltrosActivos(): boolean {
    return (
      !!this.searchControl.value || !!this.filtroAnio.value || this.filtroEstado.value !== 'todos'
    );
  }
}
