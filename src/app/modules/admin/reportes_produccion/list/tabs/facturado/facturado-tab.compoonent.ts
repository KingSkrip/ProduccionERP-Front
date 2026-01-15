import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { fuseAnimations } from '@fuse/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { ReportProdService } from '../../../reportprod.service';
import { SharedDataService } from '../../shared-data.service';
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  selector: 'tabs-facturado-tab',
  templateUrl: './facturado-tab.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    ScrollingModule,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: fuseAnimations
})
export class FacturadoTabComponent implements OnInit, OnDestroy {

  // Datos originales y filtrados
  datosOriginales: any = null;
  detalleFiltrado: any[] = [];
  totalFacturado = 0;
  
  // Estados
  isLoading = false;
  cargaInicial = false;

  private _unsubscribeAll = new Subject<void>();

  constructor(
    private _cd: ChangeDetectorRef,
    private _reportService: ReportProdService,
    private _snackBar: MatSnackBar,
    private _sharedDataService: SharedDataService
  ) { }

  ngOnInit(): void {
    // Escuchar cambios en filtros globales (búsqueda, departamento)
    this._sharedDataService.filtrosGlobales$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(filtros => {
 
        if (this.cargaInicial) {
          this.aplicarFiltrosLocales(filtros);
        }
      });

    // Escuchar cambios en fechas para recargar datos
    this._sharedDataService.recargarDatos$
      .pipe(
        takeUntil(this._unsubscribeAll),
        filter(recargar => recargar === true)
      )
      .subscribe(() => {
        const filtros = this._sharedDataService.obtenerFiltros();
        this.cargarFacturado(filtros.fechaInicio, filtros.fechaFin);
        this._sharedDataService.confirmarRecargaConsumida();
      });

    // Carga inicial con fechas por defecto
    const filtros = this._sharedDataService.obtenerFiltros();
    this.cargarFacturado(filtros.fechaInicio, filtros.fechaFin);
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next();
    this._unsubscribeAll.complete();
  }

  private aplicarFiltrosLocales(filtros: any): void {
    if (!this.datosOriginales?.detalle) {
      this.detalleFiltrado = [];
      this.totalFacturado = 0;
      this._cd.markForCheck();
      return;
    }

    const busqueda = filtros.busqueda?.toLowerCase() || '';
    const deptoSeleccionado = filtros.departamento || '';

    // Filtrar detalle
    this.detalleFiltrado = this.datosOriginales.detalle.filter((item: any) => {
      const coincideBusqueda = !busqueda ||
        item.partida?.toString().toLowerCase().includes(busqueda) ||
        item.articulo?.toString().toLowerCase().includes(busqueda);

      // Si hay departamento seleccionado, verificar que la partida tenga ese departamento
      // (esto depende de tu estructura de datos - ajusta según sea necesario)
      const coincideDepto = !deptoSeleccionado; // Por ahora no filtramos por depto en facturado
      
      return coincideBusqueda && coincideDepto;
    });

    // Recalcular total
    this.totalFacturado = this.detalleFiltrado.reduce(
      (sum, item) => sum + (Number(item.pneto) || 0), 
      0
    );

    this._cd.markForCheck();
  }

  cargarFacturado(fechaInicio?: Date | null, fechaFin?: Date | null): void {
    if (this.isLoading) return;

    const inicio = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fin = fechaFin || new Date();

    this.isLoading = true;
    this._cd.markForCheck();

    this._reportService.getFacturado(
      fechaInicio || undefined,
        fechaFin || undefined, 
        true)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (data) => {
          this.datosOriginales = data;
          this.cargaInicial = true;
          
          // Aplicar filtros actuales después de cargar datos
          const filtros = this._sharedDataService.obtenerFiltros();
          this.aplicarFiltrosLocales(filtros);

          // Actualizar servicio compartido
          this._sharedDataService.actualizarFacturado(data);

          this.isLoading = false;
          this._cd.markForCheck();
        },
        error: (err) => {
          console.error('Error al cargar facturado:', err);
          this._snackBar.open('Error al cargar datos de facturado', 'Cerrar', { duration: 3000 });
          this.isLoading = false;
          this._cd.markForCheck();
        }
      });
  }

  limpiarFiltrosLocales(): void {
    this._sharedDataService.actualizarFiltros({
      busqueda: '',
      departamento: '',
      proceso: ''
    });
  }

  trackByPartida(index: number, item: any): any {
    return item.partida ?? index;
  }

  // Getter para usar en el template
  get detalle(): any[] {
    return this.detalleFiltrado;
  }
}

//hijo facturado