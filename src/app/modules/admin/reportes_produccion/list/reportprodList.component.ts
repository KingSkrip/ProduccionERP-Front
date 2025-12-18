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
import { fuseAnimations } from '@fuse/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ReportProdService } from '../reportprod.service';
import { MatBottomSheetModule, MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatBadgeModule } from '@angular/material/badge';

interface DatoAgrupado {
    departamento: string;
    procesos: { proceso: string; cantidad: number }[];
    cantidadTotal: number;
    expandido?: boolean;
}

@Component({
    selector: 'reportprod-list',
    templateUrl: './reportprodList.component.html',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatProgressBarModule,
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
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations
})
export class ReportProdListComponent implements OnInit, OnDestroy {
    datos: any[] = [];
    datosFiltrados: any[] = [];
    datosAgrupados: DatoAgrupado[] = [];
    isLoading = false;
    mostrarPanelFiltros = false;
    mostrarPanelFechas = false;

    // Controles de filtros
    searchControl = new FormControl('');
    deptoControl = new FormControl('');
    procesoControl = new FormControl('');
    rangoFechaControl = new FormControl('mes_actual');
    fechaInicioControl = new FormControl(null);
    fechaFinControl = new FormControl(null);
    verTodosControl = new FormControl(true);

    // Rango de fecha seleccionado - CAMBIADO A MES_ACTUAL POR DEFAULT
    rangoFechaSeleccionado: | 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo' = 'mes_actual';

    // Listas únicas para los filtros
    departamentosUnicos: string[] = [];
    procesosUnicos: string[] = [];

    // Ordenamiento
    ordenActual: { campo: string; direccion: 'asc' | 'desc' } = { campo: '', direccion: 'asc' };

    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _cd: ChangeDetectorRef,
        private _reportService: ReportProdService,
        private _snackBar: MatSnackBar,
        private _bottomSheet: MatBottomSheet
    ) { }

    ngOnInit(): void {
        // Cargar datos del mes actual por defecto
        this.seleccionarRangoFecha('mes_actual');
        this.configurarFiltros();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    /** Toggle del panel de fechas */
    toggleDatePanel(): void {
        this.mostrarPanelFechas = !this.mostrarPanelFechas;
        this._cd.markForCheck();
    }

    /** Cerrar panel al presionar ESC */
    @HostListener('document:keydown.escape')
    onEscapeKey(): void {
        if (this.mostrarPanelFechas) {
            this.mostrarPanelFechas = false;
            this._cd.markForCheck();
        }
    }

    /** Cargar datos desde el servicio */
    cargarDatos(fechaInicio?: Date, fechaFin?: Date): void {
        this.isLoading = true;
        this._cd.markForCheck();

        this._reportService.getReportesProduccion(fechaInicio, fechaFin)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: response => {
                    this.datos = response;
                    this.datosFiltrados = [...response];
                    this.extraerDatosUnicos();
                    this.aplicarFiltros();
                    this.isLoading = false;
                    this._cd.markForCheck();
                },
                error: err => {
                    console.error('Error al cargar datos:', err);
                    this._snackBar.open(
                        'Error al cargar datos de producción. Verifica tu conexión.',
                        'Cerrar',
                        { duration: 5000, panelClass: 'error-snackbar' }
                    );
                    this.isLoading = false;
                    this._cd.markForCheck();
                }
            });
    }

    /** Seleccionar rango de fecha predefinido */
    seleccionarRangoFecha(
        rango: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo'
    ): void {

        this.rangoFechaSeleccionado = rango;

        // VER TODOS = sin fechas
        if (rango === 'todos') {
            this.fechaInicioControl.setValue(null);
            this.fechaFinControl.setValue(null);
            this.cargarDatos(undefined, undefined);
            this.mostrarPanelFechas = false;
            this._cd.markForCheck();
            return;
        }

        // Personalizados
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

        this.cargarDatos(fechaInicio, fechaFin);
        this.mostrarPanelFechas = false;
        this._cd.markForCheck();
    }

    /** Aplicar filtro de fechas personalizado */
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

        this.cargarDatos(fechaInicio, fechaFin);
        this.mostrarPanelFechas = false;
        this._cd.markForCheck();
    }

    /** Limpiar filtro de fechas */
    limpiarFiltroFechas(): void {
        this.rangoFechaControl.setValue('mes_actual');
        this.rangoFechaSeleccionado = 'mes_actual';
        this.fechaInicioControl.setValue(null);
        this.fechaFinControl.setValue(null);
        this.seleccionarRangoFecha('mes_actual');
        this.mostrarPanelFechas = false;
        this._cd.markForCheck();
    }

    /** Obtener texto de fecha seleccionada */
    obtenerTextoFechaSeleccionada(): string {
        const opciones: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
        const hoy = new Date();

        switch (this.rangoFechaSeleccionado) {
            case 'todos':
                return 'Todos los registros';

            case 'hoy':
                return `Hoy - ${hoy.toLocaleDateString('es-MX', opciones)}`;

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
                return fecha
                    ? `Fecha: ${fecha.toLocaleDateString('es-MX', opciones)}`
                    : 'Seleccionar fecha';

            case 'periodo':
                const inicio = this.fechaInicioControl.value;
                const fin = this.fechaFinControl.value;
                if (inicio && fin) {
                    return `${inicio.toLocaleDateString('es-MX', opciones)} - ${fin.toLocaleDateString('es-MX', opciones)}`;
                }
                return 'Periodo de fechas';

            default:
                return `Mes actual`;
        }
    }

    /** Extraer listas únicas para los filtros */
    extraerDatosUnicos(): void {
        const deptosSet = new Set<string>();
        const procesosSet = new Set<string>();

        this.datos.forEach(item => {
            if (item.departamento) deptosSet.add(item.departamento);
            if (item.proceso) procesosSet.add(item.proceso);
        });

        this.departamentosUnicos = Array.from(deptosSet).sort();
        this.procesosUnicos = Array.from(procesosSet).sort();
    }

    /** Configurar filtros con debounce */
    configurarFiltros(): void {
        this.searchControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(() => this.aplicarFiltros());

        this.deptoControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.aplicarFiltros());

        this.procesoControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.aplicarFiltros());
    }

    /** Aplicar todos los filtros y agrupar datos */
    aplicarFiltros(): void {
        const busqueda = this.searchControl.value?.toLowerCase().trim() || '';
        const deptoSeleccionado = this.deptoControl.value || '';
        const procesoSeleccionado = this.procesoControl.value || '';

        this.datosFiltrados = this.datos.filter(item => {
            const coincideBusqueda = !busqueda ||
                item.departamento?.toLowerCase().includes(busqueda) ||
                item.proceso?.toLowerCase().includes(busqueda) ||
                item.proc?.toLowerCase().includes(busqueda) ||
                item.depto?.toString().includes(busqueda);

            const coincideDepto = !deptoSeleccionado ||
                item.departamento === deptoSeleccionado;

            const coincideProceso = !procesoSeleccionado ||
                item.proceso === procesoSeleccionado;

            return coincideBusqueda && coincideDepto && coincideProceso;
        });

        // Si hay filtro de proceso, NO agrupar, mostrar detalle
        if (procesoSeleccionado) {
            this.datosAgrupados = [];
        } else {
            this.agruparDatosPorDepartamento();
        }

        if (this.ordenActual.campo) {
            this.aplicarOrdenamiento();
        }

        this._cd.markForCheck();
    }

    /** Agrupar datos por departamento */
    agruparDatosPorDepartamento(): void {
        const grupos = new Map<string, DatoAgrupado>();

        this.datosFiltrados.forEach(item => {
            const depto = item.departamento;
            
            if (!grupos.has(depto)) {
                grupos.set(depto, {
                    departamento: depto,
                    procesos: [],
                    cantidadTotal: 0,
                    expandido: false
                });
            }

            const grupo = grupos.get(depto)!;
            const cantidad = parseFloat(item.CANTIDAD) || 0;
            
            grupo.procesos.push({
                proceso: item.proceso,
                cantidad: cantidad
            });
            
            grupo.cantidadTotal += cantidad;
        });

        this.datosAgrupados = Array.from(grupos.values());
    }

    /** Expandir/Colapsar departamento */
    toggleDepartamento(index: number): void {
        this.datosAgrupados[index].expandido = !this.datosAgrupados[index].expandido;
        this._cd.markForCheck();
    }

    /** Ordenar por columna */
    ordenar(campo: string): void {
        if (this.ordenActual.campo === campo) {
            this.ordenActual.direccion = this.ordenActual.direccion === 'asc' ? 'desc' : 'asc';
        } else {
            this.ordenActual.campo = campo;
            this.ordenActual.direccion = 'asc';
        }

        this.aplicarOrdenamiento();
        this._cd.markForCheck();
    }

    /** Aplicar ordenamiento actual */
    aplicarOrdenamiento(): void {
        const campo = this.ordenActual.campo;
        const direccion = this.ordenActual.direccion;

        if (this.procesoControl.value) {
            // Ordenar datos normales
            this.datosFiltrados.sort((a, b) => {
                let valorA = a[campo];
                let valorB = b[campo];

                if (campo === 'CANTIDAD') {
                    valorA = parseFloat(valorA) || 0;
                    valorB = parseFloat(valorB) || 0;
                }

                if (valorA < valorB) return direccion === 'asc' ? -1 : 1;
                if (valorA > valorB) return direccion === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Ordenar datos agrupados
            this.datosAgrupados.sort((a, b) => {
                let valorA = campo === 'CANTIDAD' ? a.cantidadTotal : a.departamento;
                let valorB = campo === 'CANTIDAD' ? b.cantidadTotal : b.departamento;

                if (valorA < valorB) return direccion === 'asc' ? -1 : 1;
                if (valorA > valorB) return direccion === 'asc' ? 1 : -1;
                return 0;
            });
        }
    }

    /** Calcular cantidad total */
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

    /** Contar departamentos únicos */
    contarDepartamentos(): number {
        if (this.procesoControl.value) {
            const departamentos = new Set(this.datosFiltrados.map(item => item.departamento));
            return departamentos.size;
        } else {
            return this.datosAgrupados.length;
        }
    }

    /** Track by function */
    trackByFn(index: number, item: any): string {
        return item.departamento || `${item.depto}-${item.proc}` || index.toString();
    }

    /** Toggle del panel grande */
    togglePanelFiltros(): void {
        this.mostrarPanelFiltros = !this.mostrarPanelFiltros;
        this._cd.markForCheck();
    }

    /** Cerrar con ESC */
    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.mostrarPanelFiltros || this.mostrarPanelFechas) {
            this.mostrarPanelFiltros = false;
            this.mostrarPanelFechas = false;
            this._cd.markForCheck();
        }
    }

    /** Contar filtros activos para el badge */
    filtrosActivosCount(): number {
        let count = 0;
        if (this.rangoFechaSeleccionado !== 'mes_actual') count++;
        if (this.deptoControl.value) count++;
        if (this.procesoControl.value) count++;
        return count;
    }

    /** Limpiar todos los filtros */
    limpiarTodosFiltros(): void {
        this.searchControl.setValue('');
        this.deptoControl.setValue('');
        this.procesoControl.setValue('');
        this.limpiarFiltroFechas();
        this.aplicarFiltros();
    }
}