import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { fuseAnimations } from '@fuse/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { ReportProdService } from '../../../reportprod.service';
import { SharedDataService } from '../../shared-data.service';

@Component({
    selector: 'tabs-por-revisar',
    templateUrl: './porrevisar-tab.component.html',
    standalone: true,
    imports: [
        CommonModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatButtonModule,
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations
})
export class PorRevisarTabComponent implements OnInit, OnDestroy {

    // Datos originales y filtrados
    datos: any[] = [];
    datosFiltrados: any[] = [];

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
                // Solo aplicar filtros si ya hemos cargado datos
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
                this.cargarPorRevisarTejido(filtros.fechaInicio, filtros.fechaFin);
                this._sharedDataService.confirmarRecargaConsumida();
            });

        // Carga inicial con fechas por defecto
        const filtros = this._sharedDataService.obtenerFiltros();
        this.cargarPorRevisarTejido(filtros.fechaInicio, filtros.fechaFin);
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private aplicarFiltrosLocales(filtros: any): void {
        if (this.datos.length === 0) {
            this.datosFiltrados = [];
            this._cd.markForCheck();
            return;
        }

        const busqueda = filtros.busqueda?.toLowerCase() || '';
        const deptoSeleccionado = filtros.departamento || '';

        this.datosFiltrados = this.datos.filter(item => {
            const coincideBusqueda = !busqueda ||
                item.ARTICULO?.toString().toLowerCase().includes(busqueda) ||
                item.CVE_ART?.toString().toLowerCase().includes(busqueda);

            // Si el item tiene departamento, verificar coincidencia
            const coincideDepto = !deptoSeleccionado ||
                (item.departamento && item.departamento === deptoSeleccionado);

            return coincideBusqueda && coincideDepto;
        });

        // Actualizar servicio compartido
        this._sharedDataService.actualizarPorRevisar(this.datos, this.datosFiltrados);

        this._cd.markForCheck();
    }

    cargarPorRevisarTejido(fechaInicio?: Date | null, fechaFin?: Date | null): void {
        this.isLoading = true;
        this._cd.markForCheck();

        this._reportService.getPorRevisarTejido(
            fechaInicio || undefined,
            fechaFin || undefined
        ).pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (response) => {
                    this.datos = response;
                    this.cargaInicial = true;

                    // Aplicar filtros actuales después de cargar datos
                    const filtros = this._sharedDataService.obtenerFiltros();
                    this.aplicarFiltrosLocales(filtros);

                    this.isLoading = false;
                    this._cd.markForCheck();
                },
                error: (err) => {
                    console.error('Error al cargar por revisar:', err);
                    this._snackBar.open('Error al cargar datos por revisar', 'Cerrar', { duration: 3000 });
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

    // Getters para el template
    get datosPorRevisarFiltrados(): any[] {
        return this.datosFiltrados;
    }

    get isLoadingPorRevisar(): boolean {
        return this.isLoading;
    }

    calcularTotalPesoPorRevisar(): number {
        return this.datosFiltrados.reduce((total, item) =>
            total + (parseFloat(item.TOTAL_POR_REVISAR) || 0), 0
        );
    }

    calcularTotalPiezasPorRevisar(): number {
        return this.datosFiltrados.reduce((total, item) =>
            total + (parseFloat(item.PIEZAS) || 0), 0
        );
    }

    contarArticulosPorRevisar(): number {
        return this.datosFiltrados.length;
    }
}