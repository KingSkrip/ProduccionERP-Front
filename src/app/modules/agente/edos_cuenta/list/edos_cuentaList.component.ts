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
import {
  ClienteAgrupado,
  EdosCuentaService,
  EstadoCuenta,
  ResumenEstadoCuenta,
} from '../edos_cuenta.service';

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
  estadosCuenta: EstadoCuenta[] = [];
  clientesAgrupados: ClienteAgrupado[] = [];
  clientesAgrupadosFiltrados: ClienteAgrupado[] = [];
  resumen: ResumenEstadoCuenta | null = null;
  isLoading = true;
  searchControl = new FormControl('');
  filtroEstado = new FormControl<string>('todos');
  totalCargos = 0;
  totalAbonos = 0;
  totalSaldos = 0;
  documentosSeleccionados: Set<string> = new Set();
  Math = Math;
  compartiendo = false;
  blobCache: Blob | null = null;
  blobCacheKey = '';
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
    this.invalidarCache();
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
    this.invalidarCache();
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

  limpiarSeleccionCompleta(): void {
    this.documentosSeleccionados.clear();
    this.blobCache = null;
    this.blobCacheKey = '';
    this._cdr.markForCheck();
  }

  // Llamado sincrónicamente desde el click — navigator.share() funciona aquí
  async compartirPDF(): Promise<void> {
    if (!this.blobCache || this.compartiendo) return;

    const fecha = new Date().toISOString().split('T')[0];
    const fileName = `estados-cuenta-${fecha}.pdf`;
    const file = new File([this.blobCache], fileName, { type: 'application/pdf' });

    try {
      await navigator.share({ title: 'Estados de cuenta', files: [file] });
      this.limpiarSeleccionCompleta();
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        this.mostrarError('No se pudo compartir el PDF');
      }
    }
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
      .pipe(takeUntil(this._cancelarPreparacion$)) // ← se cancela si cambia selección
      .subscribe({
        next: (blob) => {
          // Verificar que la selección no cambió mientras esperábamos
          const seleccionActual = Array.from(this.documentosSeleccionados).sort().join(',');
          if (seleccionActual !== cacheKey) return; // selección cambió, ignorar

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

  // private mostrarExito(mensaje: string): void {
  //   this._snackBar.open(mensaje, 'Cerrar', {
  //     duration: 3000,
  //     horizontalPosition: 'end',
  //     verticalPosition: 'top',
  //     panelClass: ['snackbar-success'],
  //   });
  // }

  private mostrarError(mensaje: string): void {
    this._snackBar.open(mensaje, 'Cerrar', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-error'],
    });
  }
}
