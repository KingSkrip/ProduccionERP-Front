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

    cantidadTotal: number;
    expandido?: boolean;
}

@Component({
    selector: 'tabs-por-revisar',
    templateUrl: './porrevisar-tab.component.html',
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
export class PorRevisarTabComponent implements OnInit, OnDestroy {
    datos: any[] = [];
    datosFiltrados: any[] = [];
    datosAgrupados: DatoAgrupado[] = [];
    isLoading = false;
    mostrarPanelFiltros = false;
    mostrarPanelFechas = false;

    // DATOS ORIGINALES Y FILTRADOS PARA TODOS LOS TABS

    datosRevisado: any[] = [];
    datosRevisadoFiltrados: any[] = [];
    datosPorRevisar: any[] = [];
    datosPorRevisarFiltrados: any[] = [];
    isLoadingPorRevisar = false;

    // Controles de filtros
    searchControl = new FormControl('');
    rangoFechaControl = new FormControl('mes_actual');
    fechaInicioControl = new FormControl(null);
    fechaFinControl = new FormControl(null);
    verTodosControl = new FormControl(true);
    rangoFechaSeleccionado: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo' = 'mes_actual';
    departamentosUnicos: string[] = [];
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
    this.cargarPorRevisarTejido(fechaInicio, fechaFin);

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
                
                this.cargarPorRevisarTejido(fechas.inicio, fechas.fin);
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


// 🔥 NUEVO MÉTODO: Calcular fechas según rango
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

    cargarPorRevisarTejido(fechaInicio?: Date, fechaFin?: Date): void {
        this.isLoadingPorRevisar = true;
        this._cd.markForCheck();

        this._reportService.getPorRevisarTejido(fechaInicio, fechaFin)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: response => {
                    this.datosPorRevisar = response;
                    this.datosPorRevisarFiltrados = [...response];
                    this.aplicarFiltros();
                    this.isLoadingPorRevisar = false;
                    this._cd.markForCheck();
                },
                error: err => {
                    console.error('Error al cargar por revisar:', err);
                    this._snackBar.open('Error al cargar datos por revisar', 'Cerrar', { duration: 5000 });
                    this.isLoadingPorRevisar = false;
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
            this.cargarPorRevisarTejido(undefined, undefined);
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
        this.cargarPorRevisarTejido(fechaInicio, fechaFin);
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

        this.cargarPorRevisarTejido(fechaInicio, fechaFin);
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

    }

   aplicarFiltros(): void {
    const busqueda = this.searchControl.value?.toLowerCase().trim() || '';

    this.datosPorRevisarFiltrados = this.datosPorRevisar.filter(item =>
        !busqueda || item.ARTICULO?.toLowerCase().includes(busqueda)
    );

    // 👇 SOLO POR REVISAR
    this._sharedDataService.actualizarPorRevisar(
        this.datosPorRevisar,
        this.datosPorRevisarFiltrados
    );

    this._cd.markForCheck();
}



    // MÉTODOS DE CÁLCULO PARA POR REVISAR
    calcularTotalPesoPorRevisar(): number {
        return this.datosPorRevisarFiltrados.reduce((total, item) => total + (parseFloat(item.TOTAL_POR_REVISAR) || 0), 0);
    }

    calcularTotalPiezasPorRevisar(): number {
        return this.datosPorRevisarFiltrados.reduce((total, item) => total + (parseFloat(item.PIEZAS) || 0), 0);
    }

    contarArticulosPorRevisar(): number {
        return this.datosPorRevisarFiltrados.length;
    }


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
        return count;
    }
    limpiarTodosFiltros(): void {
        this.searchControl.setValue('');

        this.limpiarFiltroFechas();
        this.aplicarFiltros();
    }
}