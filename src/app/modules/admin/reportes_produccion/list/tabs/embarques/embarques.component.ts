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
    selector: 'tabs-embarques',
    templateUrl: './embarques.component.html',
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
export class EmbarquesTabComponent implements OnInit, OnDestroy {
    datos: any[] = [];

    datosAgrupados: DatoAgrupado[] = [];
    isLoading = false;
    mostrarPanelFiltros = false;
    mostrarPanelFechas = false;



    datosEmbarques: any[] = [];
    datosEmbarquesFiltrados: any[] = [];


    isLoadingEmbarques = false;

    // Controles de filtros
    searchControl = new FormControl('');


    rangoFechaControl = new FormControl('mes_actual');
    fechaInicioControl = new FormControl(null);
    fechaFinControl = new FormControl(null);
    verTodosControl = new FormControl(true);
    tipoEmbarqueControl = new FormControl('');
    rangoFechaSeleccionado: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo' = 'mes_actual';
    tiposEmbarqueUnicos: string[] = [];
    ordenActual: { campo: string; direccion: 'asc' | 'desc' } = { campo: '', direccion: 'asc' };
    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _cd: ChangeDetectorRef,
        private _reportService: ReportProdService,
        private _snackBar: MatSnackBar,
        private _bottomSheet: MatBottomSheet,
        private _sharedDataService: SharedDataService
    ) { }

    // 🔥 EMBARQUES TAB - CORREGIDO COMPLETO

    ngOnInit(): void {
        // 🔥 PRIMERO: Cargar datos con el rango por defecto (mes_actual)
        const fechaInicio = new Date();
        fechaInicio.setDate(1); // Primer día del mes actual
        const fechaFin = new Date(); // Hoy

        // Cargar datos iniciales
        this.cargarEmbarques(fechaInicio, fechaFin);

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

                // Actualizar tipo de embarque sin recargar datos
                if (this.tipoEmbarqueControl.value !== filtros.tipoEmbarque) {
                    this.tipoEmbarqueControl.setValue(filtros.tipoEmbarque, { emitEvent: false });
                }

                // 🔥 CRÍTICO: Solo recargar si las fechas cambiaron
                if (filtros.rangoFecha !== this.rangoFechaSeleccionado) {
                    this.rangoFechaSeleccionado = filtros.rangoFecha;

                    // Calcular fechas según el rango
                    const fechas = this.calcularFechasPorRango(filtros.rangoFecha, filtros.fechaInicio, filtros.fechaFin);

                    this.cargarEmbarques(fechas.inicio, fechas.fin);
                }
            });

        // Configurar filtros locales (búsqueda y tipo)
        this.searchControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(() => this.aplicarFiltros());

        this.tipoEmbarqueControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
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

    // 🔥 NUEVO: CARGAR EMBARQUES
    cargarEmbarques(fechaInicio?: Date, fechaFin?: Date): void {
        this.isLoadingEmbarques = true;
        this._cd.markForCheck();
        this._reportService.getEntregadoaEmbarques(fechaInicio, fechaFin)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: response => {
                    this.datosEmbarques = response || [];
                    this.datosEmbarquesFiltrados = [...(response || [])];
                    this.extraerTiposEmbarque();
                    this.aplicarFiltros();
                    this.isLoadingEmbarques = false;
                    this._cd.detectChanges(); // Usar detectChanges para forzar actualización

                    const total = this.calcularTotalEmbarques();
                },
                error: err => {
                    console.error('❌ === ERROR EN CARGA ===');
                    console.error('Error completo:', err);
                    console.error('Mensaje:', err.message);
                    console.error('Status:', err.status);

                    this._snackBar.open(
                        'Error al cargar datos de embarques: ' + (err.message || 'Error desconocido'),
                        'Cerrar',
                        { duration: 5000 }
                    );

                    this.isLoadingEmbarques = false;
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
            this.cargarEmbarques(undefined, undefined);
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
        this.cargarEmbarques(fechaInicio, fechaFin);
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

        this.cargarEmbarques(fechaInicio, fechaFin);
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


    extraerTiposEmbarque(): void {
        const tiposSet = new Set<string>();
        this.datosEmbarques.forEach((item, index) => {
            if (item.TIPO) {
                tiposSet.add(item.TIPO);

            }
        });

        this.tiposEmbarqueUnicos = Array.from(tiposSet).sort();
    }

    configurarFiltros(): void {
        this.searchControl.valueChanges
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this._unsubscribeAll))
            .subscribe(() => this.aplicarFiltros());

        this.tipoEmbarqueControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.aplicarFiltros());
    }

    // 🔥 MODIFICADO: aplicarFiltros ahora también actualiza el servicio compartido
    aplicarFiltros(): void {
        const busqueda = this.searchControl.value?.toLowerCase().trim() || '';
        const tipoSeleccionado = this.tipoEmbarqueControl.value || '';

        // FILTRAR EMBARQUES
        this.datosEmbarquesFiltrados = this.datosEmbarques.filter(item => {
            const coincideBusqueda = !busqueda ||
                item.ARTICULO?.toLowerCase().includes(busqueda) ||
                item.TIPO?.toLowerCase().includes(busqueda);
            const coincideTipo = !tipoSeleccionado || item.TIPO === tipoSeleccionado;
            return coincideBusqueda && coincideTipo;
        });

        // 🔥 ACTUALIZAR SERVICIO COMPARTIDO
        this._sharedDataService.actualizarEmbarques(
            this.datosEmbarques,
            this.datosEmbarquesFiltrados
        );

        this._cd.markForCheck();
    }


    // 🔥 NUEVOS MÉTODOS DE CÁLCULO PARA EMBARQUES
    calcularTotalEmbarques(): number {

        if (this.datosEmbarquesFiltrados.length === 0) {
            // console.warn('⚠️ No hay datos filtrados para calcular');
            return 0;
        }

        let total = 0;
        this.datosEmbarquesFiltrados.forEach((item, index) => {
            // Limpiamos espacios y reemplazamos coma por punto
            const cantidadStr = item.CANTIDAD.trim().replace(',', '.');
            const cantidad = parseFloat(cantidadStr) || 0;

            total += cantidad;

        });

        return total;
    }

    calcularPorTipo(tipo: string): number {

        const itemsFiltrados = this.datosEmbarquesFiltrados.filter(
            item => item.TIPO.trim() === tipo
        );

        const total = itemsFiltrados.reduce((sum, item) => {
            const cantidad = parseFloat(item.CANTIDAD) || 0;
            return sum + cantidad;
        }, 0);

        return total;
    }


    contarArticulosEmbarques(): number {
        const articulos = new Set(this.datosEmbarquesFiltrados.map(item => item.ARTICULO));
        return articulos.size;
    }

    contarTiposEmbarque(): number {
        const tipos = new Set(this.datosEmbarquesFiltrados.map(item => item.TIPO));
        return tipos.size;
    }



    trackByFn(index: number, item: any): string {
        return item.departamento || item.CVE_ART || `${item.depto}-${item.proc}` || index.toString();
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