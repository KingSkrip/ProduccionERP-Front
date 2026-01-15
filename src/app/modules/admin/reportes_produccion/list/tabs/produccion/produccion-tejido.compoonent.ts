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
//     selector: 'tabs-produccion-tejido',
//     templateUrl: './produccion-tejido.component.html',
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
// export class ProduccionTabComponent implements OnInit, OnDestroy {
    
//     datosTejido: any[] = [];
//     datosTejidoFiltrados: any[] = [];
//     isLoadingTejido = false;
    
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
//         // Cargar datos con el rango por defecto (mes_actual)
//         const fechaInicio = new Date();
//         fechaInicio.setDate(1);
//         const fechaFin = new Date();

//         this.cargarProduccionTejido(fechaInicio, fechaFin);

//         // Suscribirse a cambios en filtros globales
//         this._sharedDataService.filtrosGlobales$
//             .pipe(
//                 takeUntil(this._unsubscribeAll),
//                 debounceTime(100)
//             )
//             .subscribe(filtros => {
//                 // Actualizar búsqueda sin recargar datos
//                 if (this.searchControl.value !== filtros.busqueda) {
//                     this.searchControl.setValue(filtros.busqueda, { emitEvent: false });
//                 }

//                 // Solo recargar si las fechas cambiaron
//                 if (filtros.rangoFecha !== this.rangoFechaSeleccionado) {
//                     this.rangoFechaSeleccionado = filtros.rangoFecha;
//                     const fechas = this.calcularFechasPorRango(filtros.rangoFecha, filtros.fechaInicio, filtros.fechaFin);
//                     this.cargarProduccionTejido(fechas.inicio, fechas.fin);
//                 }
//             });

//         // Configurar filtro de búsqueda
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

//     private calcularFechasPorRango(
//         rango: string,
//         fechaInicio: Date | null,
//         fechaFin: Date | null
//     ): { inicio: Date; fin: Date } {
        
//         if (fechaInicio && fechaFin) {
//             return { inicio: fechaInicio, fin: fechaFin };
//         }

//         let inicio: Date;
//         let fin: Date = new Date();

//         switch (rango) {
//             case 'hoy':
//                 inicio = new Date();
//                 break;
//             case 'ayer':
//                 inicio = new Date();
//                 inicio.setDate(inicio.getDate() - 1);
//                 fin = new Date(inicio);
//                 break;
//             case 'mes_actual':
//                 inicio = new Date();
//                 inicio.setDate(1);
//                 break;
//             case 'mes_anterior':
//                 inicio = new Date();
//                 inicio.setMonth(inicio.getMonth() - 1);
//                 inicio.setDate(1);
//                 fin = new Date();
//                 fin.setDate(0);
//                 break;
//             case 'todos':
//                 inicio = new Date();
//                 inicio.setFullYear(inicio.getFullYear() - 1);
//                 break;
//             default:
//                 inicio = new Date();
//                 inicio.setDate(1);
//                 break;
//         }

//         return { inicio, fin };
//     }

//     cargarProduccionTejido(fechaInicio?: Date, fechaFin?: Date): void {
//         this.isLoadingTejido = true;
//         this._cd.markForCheck();

//         this._reportService.getProduccionTejido(fechaInicio, fechaFin)
//             .pipe(takeUntil(this._unsubscribeAll))
//             .subscribe({
//                 next: response => {
//                     this.datosTejido = response;
//                     this.datosTejidoFiltrados = [...response];
//                     this.aplicarFiltros();
//                     this.isLoadingTejido = false;
//                     this._cd.markForCheck();
//                 },
//                 error: err => {
//                     console.error('Error al cargar producción de tejido:', err);
//                     this._snackBar.open('Error al cargar producción de tejido', 'Cerrar', { duration: 5000 });
//                     this.isLoadingTejido = false;
//                     this._cd.markForCheck();
//                 }
//             });
//     }

//     aplicarFiltros(): void {
//         const busqueda = this.searchControl.value?.toLowerCase().trim() || '';
        
//         this.datosTejidoFiltrados = this.datosTejido.filter(item =>
//             !busqueda || item.ARTICULO?.toString().toLowerCase().includes(busqueda)
//         );

//         this._sharedDataService.actualizarTejido(
//             this.datosTejido,
//             this.datosTejidoFiltrados
//         );

//         this._cd.markForCheck();
//     }

//     calcularTotalPesoTejido(): number {
//         return this.datosTejidoFiltrados.reduce((total, item) => 
//             total + (parseFloat(item.TOTAL_TJ) || 0), 0
//         );
//     }

//     calcularTotalPiezasTejido(): number {
//         return this.datosTejidoFiltrados.reduce((total, item) => 
//             total + (parseFloat(item.PIEZAS) || 0), 0
//         );
//     }

//     contarArticulosTejido(): number {
//         return this.datosTejidoFiltrados.length;
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
    selector: 'tabs-produccion-tejido',
    templateUrl: './produccion-tejido.component.html',
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
export class ProduccionTabComponent implements OnInit, OnDestroy {
    
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
                this.cargarProduccionTejido(filtros.fechaInicio, filtros.fechaFin);
                this._sharedDataService.confirmarRecargaConsumida();
            });

        // Carga inicial con fechas por defecto
        const filtros = this._sharedDataService.obtenerFiltros();
        this.cargarProduccionTejido(filtros.fechaInicio, filtros.fechaFin);
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
        this._sharedDataService.actualizarTejido(this.datos, this.datosFiltrados);

        this._cd.markForCheck();
    }

    cargarProduccionTejido(fechaInicio?: Date | null, fechaFin?: Date | null): void {
        this.isLoading = true;
        this._cd.markForCheck();

        this._reportService.getProduccionTejido(
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
                    console.error('Error al cargar producción de tejido:', err);
                    this._snackBar.open('Error al cargar producción de tejido', 'Cerrar', { duration: 3000 });
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
    get datosTejidoFiltrados(): any[] {
        return this.datosFiltrados;
    }

    get isLoadingTejido(): boolean {
        return this.isLoading;
    }

    calcularTotalPesoTejido(): number {
        return this.datosFiltrados.reduce((total, item) => 
            total + (parseFloat(item.TOTAL_TJ) || 0), 0
        );
    }

    calcularTotalPiezasTejido(): number {
        return this.datosFiltrados.reduce((total, item) => 
            total + (parseFloat(item.PIEZAS) || 0), 0
        );
    }

    contarArticulosTejido(): number {
        return this.datosFiltrados.length;
    }
}