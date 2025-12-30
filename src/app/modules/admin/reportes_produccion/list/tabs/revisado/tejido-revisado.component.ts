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
    selector: 'tabs-tejido-revisado',
    templateUrl: './tejido-revisado.component.html',
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
export class TejidoRevisadoTabComponent implements OnInit, OnDestroy {
    datos: any[] = [];
    datosFiltrados: any[] = [];
    datosAgrupados: DatoAgrupado[] = [];
    isLoading = false;
    mostrarPanelFiltros = false;
    mostrarPanelFechas = false;

    // DATOS ORIGINALES Y FILTRADOS PARA TODOS LOS TABS
    datosTejido: any[] = [];
    datosTejidoFiltrados: any[] = [];
    datosRevisado: any[] = [];
    datosRevisadoFiltrados: any[] = [];
    isLoadingRevisado = false;
    // Controles de filtros
    searchControl = new FormControl('');
    rangoFechaControl = new FormControl('mes_actual');
    fechaInicioControl = new FormControl(null);
    fechaFinControl = new FormControl(null);
    verTodosControl = new FormControl(true);
    rangoFechaSeleccionado: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo' = 'mes_actual';
    ordenActual: { campo: string; direccion: 'asc' | 'desc' } = { campo: '', direccion: 'asc' };
    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _cd: ChangeDetectorRef,
        private _reportService: ReportProdService,
        private _snackBar: MatSnackBar,
        private _bottomSheet: MatBottomSheet,
        private _sharedDataService: SharedDataService
    ) { }

    // ngOnInit(): void {
    //     this.seleccionarRangoFecha('mes_actual');
    //     this.configurarFiltros();
    // }

    ngOnInit(): void {
        this._sharedDataService.filtrosGlobales$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(filtros => {
                if (this.searchControl.value !== filtros.busqueda) {
                    this.searchControl.setValue(filtros.busqueda, { emitEvent: false });
                }

                this.rangoFechaSeleccionado = filtros.rangoFecha;
                this.cargarRevisadoTejido(filtros.fechaInicio || undefined, filtros.fechaFin || undefined);
            });

        this.searchControl.valueChanges
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this._unsubscribeAll))
            .subscribe(() => this.aplicarFiltros());
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

    cargarRevisadoTejido(fechaInicio?: Date, fechaFin?: Date): void {
        this.isLoadingRevisado = true;
        this._cd.markForCheck();

        this._reportService.getRevisadoTejido(fechaInicio, fechaFin)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: response => {
                    this.datosRevisado = response;
                    this.datosRevisadoFiltrados = [...response];
                    this.aplicarFiltros(); // Aplicar filtro de búsqueda
                    this.isLoadingRevisado = false;
                    this._cd.markForCheck();
                },
                error: err => {
                    console.error('Error al cargar revisado de tejido:', err);
                    this._snackBar.open('Error al cargar revisado de tejido', 'Cerrar', { duration: 5000 });
                    this.isLoadingRevisado = false;
                    this._cd.markForCheck();
                }
            });
    }


    limpiarFiltroFechas(): void {
        this.rangoFechaControl.setValue('mes_actual');
        this.rangoFechaSeleccionado = 'mes_actual';
        this.fechaInicioControl.setValue(null);
        this.fechaFinControl.setValue(null);
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

        this.datosRevisadoFiltrados = this.datosRevisado.filter(item =>
            !busqueda || item.ARTICULO?.toLowerCase().includes(busqueda)
        );

        this._sharedDataService.actualizarRevisado(
            this.datosRevisado,
            this.datosRevisadoFiltrados
        );

        this._cd.markForCheck();
    }


    // MÉTODOS DE CÁLCULO PARA REVISADO
    calcularTotalPesoRevisado(): number {
        return this.datosRevisadoFiltrados.reduce((total, item) => {
            const valor = parseFloat(item.TOTAL_RV) || 0;
            return total + valor;
        }, 0);
    }

    calcularTotalPiezasRevisado(): number {
        return this.datosRevisadoFiltrados.reduce((total, item) => total + (parseFloat(item.PIEZAS) || 0), 0);
    }

    contarArticulosRevisado(): number {
        return this.datosRevisadoFiltrados.length;
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