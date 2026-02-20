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
import { ClienteAgrupado, EdosCuentaService, EstadoCuenta, ResumenEstadoCuenta } from '../edos_cuenta.service';

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
  // Data
  estadosCuenta: EstadoCuenta[] = [];
  clientesAgrupados: ClienteAgrupado[] = [];
  clientesAgrupadosFiltrados: ClienteAgrupado[] = [];
  resumen: ResumenEstadoCuenta | null = null;

  // Loading
  isLoading = true;
  isLoadingResumen = false;

  // Search & filters
  searchControl = new FormControl('');
  filtroEstado = new FormControl<string>('todos');

  // Totales globales
  totalCargos = 0;
  totalAbonos = 0;
  totalSaldos = 0;

  // Selection
  documentosSeleccionados: Set<string> = new Set();

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

  cargarEstadosCuenta(): void {
    this.isLoading = true;
    this._edosCuentaService
      .getEstadosCuenta()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.estadosCuenta = response.data;
            this.totalCargos = response.total_cargos ?? 0;
            this.totalAbonos = response.total_abonos ?? 0;
            this.totalSaldos = response.total_saldos ?? 0;
            this.clientesAgrupados = this._edosCuentaService.agruparPorCliente(this.estadosCuenta);
            this.aplicarFiltros();
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
    this._edosCuentaService
      .getResumen()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          if (response.success) this.resumen = response.data;
          this._cdr.markForCheck();
        },
        error: () => {},
      });
  }

  setupSearch(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this._unsubscribeAll))
      .subscribe(() => this.aplicarFiltros());
  }

  aplicarFiltros(): void {
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    const estado = this.filtroEstado.value;
    const hoy = new Date();

    this.clientesAgrupadosFiltrados = this.clientesAgrupados
      .map((cliente) => {
        // Filtrar documentos del cliente
        let docs = [...cliente.documentos];

        if (searchTerm) {
          docs = docs.filter(
            (ec) =>
              ec.documento.toLowerCase().includes(searchTerm) ||
              cliente.nombre.toLowerCase().includes(searchTerm) ||
              cliente.rfc.toLowerCase().includes(searchTerm),
          );
        }

        if (estado && estado !== 'todos') {
          docs = docs.filter((ec) => {
            if (estado === 'pagado') return ec.saldo === 0;
            if (estado === 'vencido') return ec.saldo > 0 && new Date(ec.fecha_vencimiento) < hoy;
            if (estado === 'pendiente')
              return ec.saldo > 0 && new Date(ec.fecha_vencimiento) >= hoy;
            return true;
          });
        }

        return { ...cliente, documentos: docs };
      })
      .filter(
        (cliente) =>
          cliente.documentos.length > 0 ||
          (searchTerm &&
            (cliente.nombre.toLowerCase().includes(searchTerm) ||
              cliente.rfc.toLowerCase().includes(searchTerm))),
      );

    this._cdr.markForCheck();
  }

  toggleExpandir(cliente: ClienteAgrupado): void {
    cliente.expandido = !cliente.expandido;
    this._cdr.markForCheck();
  }

  expandirTodos(): void {
    const todosExpandidos = this.clientesAgrupadosFiltrados.every((c) => c.expandido);
    this.clientesAgrupadosFiltrados.forEach((c) => (c.expandido = !todosExpandidos));
    this._cdr.markForCheck();
  }

  toggleSeleccionCliente(cliente: ClienteAgrupado): void {
    const todosSeleccionados = cliente.documentos.every((ec) =>
      this.documentosSeleccionados.has(ec.documento),
    );
    if (todosSeleccionados) {
      cliente.documentos.forEach((ec) => this.documentosSeleccionados.delete(ec.documento));
    } else {
      cliente.documentos.forEach((ec) => this.documentosSeleccionados.add(ec.documento));
    }
    this._cdr.markForCheck();
  }

  clienteTodoSeleccionado(cliente: ClienteAgrupado): boolean {
    return (
      cliente.documentos.length > 0 &&
      cliente.documentos.every((ec) => this.documentosSeleccionados.has(ec.documento))
    );
  }

  clienteParcialmenteSeleccionado(cliente: ClienteAgrupado): boolean {
    const algunos = cliente.documentos.some((ec) => this.documentosSeleccionados.has(ec.documento));
    return algunos && !this.clienteTodoSeleccionado(cliente);
  }

  toggleSeleccion(documento: string): void {
    if (this.documentosSeleccionados.has(documento)) {
      this.documentosSeleccionados.delete(documento);
    } else {
      this.documentosSeleccionados.add(documento);
    }
    this._cdr.markForCheck();
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('');
    this.filtroEstado.setValue('todos');
    this.aplicarFiltros();
  }

  hayFiltrosActivos(): boolean {
    return !!this.searchControl.value || this.filtroEstado.value !== 'todos';
  }

  descargarSeleccionados(): void {
    const documentos = Array.from(this.documentosSeleccionados);
    this._edosCuentaService.descargarMultiples(documentos).subscribe({
      next: (blob) => {
        const fecha = new Date().toISOString().split('T')[0];
        this.descargarArchivo(blob, `estados-cuenta-${fecha}.pdf`);
        this.mostrarExito('PDFs descargados correctamente');
        this.documentosSeleccionados.clear();
        this._cdr.markForCheck();
      },
      error: () => this.mostrarError('Error al descargar PDFs'),
    });
  }

  descargarPDF(documento: string): void {
    this._edosCuentaService.descargarPDF(documento).subscribe({
      next: (blob) => {
        this.descargarArchivo(blob, `estado-cuenta-${documento}.pdf`);
        this.mostrarExito('PDF descargado correctamente');
      },
      error: () => this.mostrarError('Error al descargar PDF'),
    });
  }

  getDiasVencimiento(fechaVenc: string): number {
    const hoy = new Date();
    const vencimiento = new Date(fechaVenc);
    return Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }

  getEstadoDocumento(ec: EstadoCuenta): { texto: string; clase: string } {
    if (ec.saldo === 0) return { texto: 'Pagado', clase: 'text-green-600 bg-green-100' };
    const hoy = new Date();
    if (new Date(ec.fecha_vencimiento) < hoy)
      return { texto: 'Vencido', clase: 'text-red-600 bg-red-100' };
    return { texto: 'Pendiente', clase: 'text-yellow-600 bg-yellow-100' };
  }

  trackByCliente(_: number, item: ClienteAgrupado): string {
    return item.clave;
  }

  trackByDocumento(_: number, item: EstadoCuenta): string {
    return item.documento;
  }

  private descargarArchivo(blob: Blob, nombreArchivo: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    link.click();
    window.URL.revokeObjectURL(url);
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