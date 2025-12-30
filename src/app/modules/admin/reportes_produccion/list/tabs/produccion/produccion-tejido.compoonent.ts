import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
    HostListener
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBottomSheetModule, MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { fuseAnimations } from '@fuse/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ReportProdService } from '../../../reportprod.service';
import { SharedDataService } from '../../shared-data.service';

interface DatoAgrupado {
    departamento: string;
    procesos: { proceso: string; cantidad: number }[];
    cantidadTotal: number;
    expandido?: boolean;
}

@Component({
    selector: 'tabs-produccion-tejido',
    templateUrl: './produccion-tejido.component.html',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatTooltipModule,
        MatBottomSheetModule,
        MatBadgeModule,
        MatTabsModule,

    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations
})
export class ProduccionTabComponent implements OnInit, OnDestroy {
    datos: any[] = [];
    datosFiltrados: any[] = [];
    datosAgrupados: DatoAgrupado[] = [];
    isLoading = false;
    mostrarPanelFiltros = false;
    mostrarPanelFechas = false;
    datosTejido: any[] = [];
    datosTejidoFiltrados: any[] = [];
    isLoadingTejido = false;
    searchControl = new FormControl('');
    deptoControl = new FormControl('');
    procesoControl = new FormControl('');
    rangoFechaControl = new FormControl('mes_actual');
    fechaInicioControl = new FormControl(null);
    fechaFinControl = new FormControl(null);
    verTodosControl = new FormControl(true);
    rangoFechaSeleccionado: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo' = 'mes_actual';
    procesosUnicos: string[] = [];
    ordenActual: { campo: string; direccion: 'asc' | 'desc' } = { campo: '', direccion: 'asc' };
    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _cd: ChangeDetectorRef,
        private _reportService: ReportProdService,
        private _snackBar: MatSnackBar,
        private _bottomSheet: MatBottomSheet,
        private _sharedDataService: SharedDataService
    ) { }

       ngOnInit(): void {
        // 🔥 PRIMERO: Cargar datos con el rango por defecto (mes_actual)
        const fechaInicio = new Date();
        fechaInicio.setDate(1); // Primer día del mes actual
        const fechaFin = new Date(); // Hoy

        // Cargar datos iniciales
        this.cargarProduccionTejido(fechaInicio, fechaFin);

        // 🔥 SEGUNDO: Suscribirse a cambios en filtros globales
        this._sharedDataService.filtrosGlobales$
            .pipe(
                takeUntil(this._unsubscribeAll),
                debounceTime(100) // Evitar múltiples llamadas simultáneas
            )
            .subscribe(filtros => {
                // Actualizar búsqueda sin recargar datos
                if (this.searchControl.value !== filtros.busqueda) {
                    this.searchControl.setValue(filtros.busqueda, { emitEvent: false });
                }

                // 🔥 CRÍTICO: Solo recargar si las fechas cambiaron
                if (filtros.rangoFecha !== this.rangoFechaSeleccionado) {
                    this.rangoFechaSeleccionado = filtros.rangoFecha;

                    // Calcular fechas según el rango
                    const fechas = this.calcularFechasPorRango(filtros.rangoFecha, filtros.fechaInicio, filtros.fechaFin);

                    this.cargarProduccionTejido(fechas.inicio, fechas.fin);
                }
            });

        // Configurar filtros locales (búsqueda)
        this.searchControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(() => this.aplicarFiltros());
    }

    private calcularFechasPorRango(
        rango: string,
        fechaInicio: Date | null,
        fechaFin: Date | null
    ): { inicio: Date; fin: Date } {

        // Si ya hay fechas específicas, usarlas
        if (fechaInicio && fechaFin) {
            return { inicio: fechaInicio, fin: fechaFin };
        }

        const hoy = new Date();
        let inicio: Date;
        let fin: Date = new Date();

        switch (rango) {
            case 'hoy':
                inicio = new Date();
                fin = new Date();
                break;
            case 'ayer':
                inicio = new Date();
                inicio.setDate(inicio.getDate() - 1);
                fin = new Date(inicio);
                break;
            case 'mes_actual':
                inicio = new Date();
                inicio.setDate(1);
                break;
            case 'mes_anterior':
                inicio = new Date();
                inicio.setMonth(inicio.getMonth() - 1);
                inicio.setDate(1);
                fin = new Date();
                fin.setDate(0);
                break;
            case 'todos':
                // ⚠️ IMPORTANTE: Definir una fecha límite para "todos"
                // Para evitar cargar millones de registros
                inicio = new Date();
                inicio.setFullYear(inicio.getFullYear() - 1); // Último año
                break;
            default:
                inicio = new Date();
                inicio.setDate(1);
                break;
        }

        return { inicio, fin };
    }

    // ngOnInit(): void {
    //     // Escuchar cambios en filtros globales
    //     this._sharedDataService.filtrosGlobales$
    //         .pipe(takeUntil(this._unsubscribeAll))
    //         .subscribe(filtros => {
    //             if (this.searchControl.value !== filtros.busqueda) {
    //                 this.searchControl.setValue(filtros.busqueda, { emitEvent: false });
    //             }

    //             this.rangoFechaSeleccionado = filtros.rangoFecha;
    //             this.cargarProduccionTejido(filtros.fechaInicio || undefined, filtros.fechaFin || undefined);
    //         });

    //     this.searchControl.valueChanges
    //         .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this._unsubscribeAll))
    //         .subscribe(() => this.aplicarFiltros());
    // }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    toggleDatePanel(): void {
        this.mostrarPanelFechas = !this.mostrarPanelFechas;
        this._cd.markForCheck();
    }

    @HostListener('document:keydown.escape')
    onEscapeKey(): void {
        if (this.mostrarPanelFechas) {
            this.mostrarPanelFechas = false;
            this._cd.markForCheck();
        }
    }


    cargarProduccionTejido(fechaInicio?: Date, fechaFin?: Date): void {
        this.isLoadingTejido = true;
        this._cd.markForCheck();

        this._reportService.getProduccionTejido(fechaInicio, fechaFin)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: response => {
                    this.datosTejido = response;
                    this.datosTejidoFiltrados = [...response];
                    this.aplicarFiltros();
                    this.isLoadingTejido = false;
                    this._cd.markForCheck();
                },
                error: err => {
                    console.error('Error al cargar producción de tejido:', err);
                    this._snackBar.open('Error al cargar producción de tejido', 'Cerrar', { duration: 5000 });
                    this.isLoadingTejido = false;
                    this._cd.markForCheck();
                }
            });
    }

    seleccionarRangoFecha(
        rango: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo'
    ): void {
        this.rangoFechaSeleccionado = rango;

        if (rango === 'todos') {
            this.fechaInicioControl.setValue(null);
            this.fechaFinControl.setValue(null);
            this.cargarProduccionTejido(undefined, undefined);
            this.mostrarPanelFechas = false;
            this._cd.markForCheck();
            return;
        }

        if (rango === 'fecha_especifica' || rango === 'periodo') {
            this._cd.markForCheck();
            return;
        }

        let fechaInicio: Date;
        let fechaFin: Date = new Date();

        switch (rango) {
            case 'hoy':
                fechaInicio = new Date();
                fechaFin = new Date();
                break;
            case 'ayer':
                fechaInicio = new Date();
                fechaInicio.setDate(fechaInicio.getDate() - 1);
                fechaFin = new Date(fechaInicio);
                break;
            case 'mes_actual':
                fechaInicio = new Date();
                fechaInicio.setDate(1);
                fechaFin = new Date();
                break;
            case 'mes_anterior':
                fechaInicio = new Date();
                fechaInicio.setMonth(fechaInicio.getMonth() - 1);
                fechaInicio.setDate(1);
                fechaFin = new Date();
                fechaFin.setDate(0);
                break;
        }
        this.cargarProduccionTejido(fechaInicio, fechaFin);
        this.mostrarPanelFechas = false;
        this._cd.markForCheck();
    }

    aplicarFiltroFechas(): void {
        const fechaInicio = this.fechaInicioControl.value;
        const fechaFin = this.rangoFechaSeleccionado === 'periodo'
            ? this.fechaFinControl.value
            : this.fechaInicioControl.value;

        if (!fechaInicio) {
            this._snackBar.open('Selecciona una fecha válida', 'Cerrar', { duration: 3000 });
            return;
        }

        if (this.rangoFechaSeleccionado === 'periodo' && !fechaFin) {
            this._snackBar.open('Selecciona una fecha fin válida', 'Cerrar', { duration: 3000 });
            return;
        }

        if (this.rangoFechaSeleccionado === 'periodo' && fechaInicio > fechaFin) {
            this._snackBar.open('La fecha de inicio no puede ser mayor a la fecha fin', 'Cerrar', { duration: 3000 });
            return;
        }

        this.cargarProduccionTejido(fechaInicio, fechaFin);
        this.mostrarPanelFechas = false;
        this._cd.markForCheck();
    }

    limpiarFiltroFechas(): void {
        this.rangoFechaControl.setValue('mes_actual');
        this.rangoFechaSeleccionado = 'mes_actual';
        this.fechaInicioControl.setValue(null);
        this.fechaFinControl.setValue(null);
        this.seleccionarRangoFecha('mes_actual');
        this.mostrarPanelFechas = false;
        this._cd.markForCheck();
    }

    obtenerTextoFechaSeleccionada(): string {
        const opciones: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
        const hoy = new Date();

        switch (this.rangoFechaSeleccionado) {
            case 'todos': return 'Todos los registros';
            case 'hoy': return `Hoy - ${hoy.toLocaleDateString('es-MX', opciones)}`;
            case 'ayer':
                const ayer = new Date();
                ayer.setDate(ayer.getDate() - 1);
                return `Ayer - ${ayer.toLocaleDateString('es-MX', opciones)}`;
            case 'mes_actual':
                const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                return `${inicioMes.toLocaleDateString('es-MX', opciones)} - ${hoy.toLocaleDateString('es-MX', opciones)}`;
            case 'mes_anterior':
                const inicioMesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                const finMesAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
                return `${inicioMesAnt.toLocaleDateString('es-MX', opciones)} - ${finMesAnt.toLocaleDateString('es-MX', opciones)}`;
            case 'fecha_especifica':
                const fecha = this.fechaInicioControl.value;
                return fecha ? `Fecha: ${fecha.toLocaleDateString('es-MX', opciones)}` : 'Seleccionar fecha';
            case 'periodo':
                const inicio = this.fechaInicioControl.value;
                const fin = this.fechaFinControl.value;
                if (inicio && fin) {
                    return `${inicio.toLocaleDateString('es-MX', opciones)} - ${fin.toLocaleDateString('es-MX', opciones)}`;
                }
                return 'Periodo de fechas';
            default: return 'Mes actual';
        }
    }

    configurarFiltros(): void {
        this.searchControl.valueChanges
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this._unsubscribeAll))
            .subscribe(() => this.aplicarFiltros());

        this.deptoControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.aplicarFiltros());

        this.procesoControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.aplicarFiltros());
    }

    aplicarFiltros(): void {
        const busqueda = this.searchControl.value?.toLowerCase().trim() || '';
        this.datosTejidoFiltrados = this.datosTejido.filter(item => {
            return !busqueda || item.ARTICULO?.toString().toLowerCase().includes(busqueda);
        });

        this._sharedDataService.actualizarTejido(
            this.datos,
            this.datosTejidoFiltrados
        );

        this._cd.markForCheck();
    }

    calcularCantidadTotal(): number {
        if (this.procesoControl.value) {
            return this.datosFiltrados.reduce((total, item) => {
                return total + (parseFloat(item.CANTIDAD) || 0);
            }, 0);
        } else {
            return this.datosAgrupados.reduce((total, grupo) => {
                return total + grupo.cantidadTotal;
            }, 0);
        }
    }


    // MÉTODOS DE CÁLCULO PARA TEJIDO
    calcularTotalPesoTejido(): number {
        return this.datosTejidoFiltrados.reduce((total, item) => {
            const valor = parseFloat(item.TOTAL_TJ) || 0;
            return total + valor;
        }, 0);
    }

    calcularTotalPiezasTejido(): number {
        return this.datosTejidoFiltrados.reduce((total, item) => total + (parseFloat(item.PIEZAS) || 0), 0);
    }

    contarArticulosTejido(): number {
        return this.datosTejidoFiltrados.length;
    }

    // MÉTODOS DE CÁLCULO PARA SALDOS

    togglePanelFiltros(): void {
        this.mostrarPanelFiltros = !this.mostrarPanelFiltros;
        this._cd.markForCheck();
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.mostrarPanelFiltros || this.mostrarPanelFechas) {
            this.mostrarPanelFiltros = false;
            this.mostrarPanelFechas = false;
            this._cd.markForCheck();
        }
    }

    filtrosActivosCount(): number {
        let count = 0;
        if (this.rangoFechaSeleccionado !== 'mes_actual') count++;
        if (this.deptoControl.value) count++;
        if (this.procesoControl.value) count++;
        return count;
    }
    limpiarTodosFiltros(): void {
        this.searchControl.setValue('');
        this.deptoControl.setValue('');
        this.procesoControl.setValue('');
        this.limpiarFiltroFechas();
        this.aplicarFiltros();
    }
}