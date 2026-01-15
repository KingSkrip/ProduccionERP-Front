// import { CommonModule } from '@angular/common';
// import {
//     ChangeDetectionStrategy,
//     ChangeDetectorRef,
//     Component,
//     OnDestroy,
//     OnInit,
//     ViewEncapsulation
// } from '@angular/core';
// import { FormControl } from '@angular/forms';
// import { MatIconModule } from '@angular/material/icon';
// import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
// import { fuseAnimations } from '@fuse/animations';
// import { MatSnackBar } from '@angular/material/snack-bar';
// import { Subject } from 'rxjs';
// import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
// import { ReportProdService } from '../../../reportprod.service';
// import { SharedDataService } from '../../shared-data.service';

// @Component({
//     selector: 'tabs-tejido-revisado',
//     templateUrl: './tejido-revisado.component.html',
//     standalone: true,
//     imports: [
//         CommonModule,
//         MatProgressSpinnerModule,
//         MatIconModule,
//     ],
//     encapsulation: ViewEncapsulation.None,
//     changeDetection: ChangeDetectionStrategy.OnPush,
//     animations: fuseAnimations
// })
// export class TejidoRevisadoTabComponent implements OnInit, OnDestroy {

//     datosRevisado: any[] = [];
//     datosRevisadoFiltrados: any[] = [];
//     isLoadingRevisado = false;

//     searchControl = new FormControl('');
//     rangoFechaSeleccionado: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo' = 'mes_actual';

//     private _unsubscribeAll = new Subject<void>();

//     constructor(
//         private _cd: ChangeDetectorRef,
//         private _reportService: ReportProdService,
//         private _snackBar: MatSnackBar,
//         private _sharedDataService: SharedDataService
//     ) { }

//     ngOnInit(): void {
//         this._sharedDataService.filtrosGlobales$
//             .pipe(takeUntil(this._unsubscribeAll))
//             .subscribe(filtros => {
//                 if (this.searchControl.value !== filtros.busqueda) {
//                     this.searchControl.setValue(filtros.busqueda, { emitEvent: false });
//                 }

//                 this.rangoFechaSeleccionado = filtros.rangoFecha;
//                 this.cargarRevisadoTejido(filtros.fechaInicio || undefined, filtros.fechaFin || undefined);
//             });

//         this.searchControl.valueChanges
//             .pipe(
//                 debounceTime(300),
//                 distinctUntilChanged(),
//                 takeUntil(this._unsubscribeAll)
//             )
//             .subscribe(() => this.aplicarFiltros());
//     }

//     ngOnDestroy(): void {
//         this._unsubscribeAll.next();
//         this._unsubscribeAll.complete();
//     }

//     cargarRevisadoTejido(fechaInicio?: Date, fechaFin?: Date): void {
//         this.isLoadingRevisado = true;
//         this._cd.markForCheck();

//         this._reportService.getRevisadoTejido(fechaInicio, fechaFin)
//             .pipe(takeUntil(this._unsubscribeAll))
//             .subscribe({
//                 next: response => {
//                     this.datosRevisado = response;
//                     this.datosRevisadoFiltrados = [...response];
//                     this.aplicarFiltros();
//                     this.isLoadingRevisado = false;
//                     this._cd.markForCheck();
//                 },
//                 error: err => {
//                     console.error('Error al cargar revisado de tejido:', err);
//                     this._snackBar.open('Error al cargar revisado de tejido', 'Cerrar', { duration: 5000 });
//                     this.isLoadingRevisado = false;
//                     this._cd.markForCheck();
//                 }
//             });
//     }

//     aplicarFiltros(): void {
//         const busqueda = this.searchControl.value?.toLowerCase().trim() || '';

//         this.datosRevisadoFiltrados = this.datosRevisado.filter(item =>
//             !busqueda || item.ARTICULO?.toLowerCase().includes(busqueda)
//         );

//         this._sharedDataService.actualizarRevisado(
//             this.datosRevisado,
//             this.datosRevisadoFiltrados
//         );

//         this._cd.markForCheck();
//     }

//     calcularTotalPesoRevisado(): number {
//         return this.datosRevisadoFiltrados.reduce((total, item) =>
//             total + (parseFloat(item.TOTAL_RV) || 0), 0
//         );
//     }

//     calcularTotalPiezasRevisado(): number {
//         return this.datosRevisadoFiltrados.reduce((total, item) =>
//             total + (parseFloat(item.PIEZAS) || 0), 0
//         );
//     }

//     contarArticulosRevisado(): number {
//         return this.datosRevisadoFiltrados.length;
//     }
// }

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
    selector: 'tabs-tejido-revisado',
    templateUrl: './tejido-revisado.component.html',
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
export class TejidoRevisadoTabComponent implements OnInit, OnDestroy {

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
                this.cargarRevisadoTejido(filtros.fechaInicio, filtros.fechaFin);
                this._sharedDataService.confirmarRecargaConsumida();
            });

        // Carga inicial con fechas por defecto
        const filtros = this._sharedDataService.obtenerFiltros();
        this.cargarRevisadoTejido(filtros.fechaInicio, filtros.fechaFin);
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
        this._sharedDataService.actualizarRevisado(this.datos, this.datosFiltrados);

        this._cd.markForCheck();
    }

    cargarRevisadoTejido(fechaInicio?: Date | null, fechaFin?: Date | null): void {
        this.isLoading = true;
        this._cd.markForCheck();

        this._reportService.getRevisadoTejido(
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
                    console.error('Error al cargar revisado de tejido:', err);
                    this._snackBar.open('Error al cargar revisado de tejido', 'Cerrar', { duration: 3000 });
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
    get datosRevisadoFiltrados(): any[] {
        return this.datosFiltrados;
    }

    get isLoadingRevisado(): boolean {
        return this.isLoading;
    }

    calcularTotalPesoRevisado(): number {
        return this.datosFiltrados.reduce((total, item) =>
            total + (parseFloat(item.TOTAL_RV) || 0), 0
        );
    }

    calcularTotalPiezasRevisado(): number {
        return this.datosFiltrados.reduce((total, item) =>
            total + (parseFloat(item.PIEZAS) || 0), 0
        );
    }

    contarArticulosRevisado(): number {
        return this.datosFiltrados.length;
    }
}