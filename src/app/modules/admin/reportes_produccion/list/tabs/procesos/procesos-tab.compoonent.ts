import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation, HostListener } from '@angular/core';
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
    selector: 'tabs-procesos-tab',
    templateUrl: './procesos-tab.component.html',
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
export class ProcesosTabComponent implements OnInit {

    datos: any[] = [];
    datosFiltrados: any[] = [];
    datosAgrupados: DatoAgrupado[] = [];
    isLoading = false;
    mostrarPanelFiltros = false;
    mostrarPanelFechas = false;
    searchControl = new FormControl('');
    deptoControl = new FormControl('');
    procesoControl = new FormControl('');
    rangoFechaControl = new FormControl('mes_actual');
    fechaInicioControl = new FormControl(null);
    fechaFinControl = new FormControl(null);
    verTodosControl = new FormControl(true);
    rangoFechaSeleccionado: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo' = 'mes_actual';
    departamentosUnicos: string[] = [];
    procesosUnicos: string[] = [];
    ordenActual: { campo: string; direccion: 'asc' | 'desc' } = { campo: '', direccion: 'asc' };
    private _unsubscribeAll = new Subject<void>();
    loading = false;

    constructor(
        private _cd: ChangeDetectorRef,
        private _reportService: ReportProdService,
        private _snackBar: MatSnackBar,
        private _bottomSheet: MatBottomSheet,
        private _sharedDataService: SharedDataService
    ) { }


    ngOnInit(): void {
        // Solo escuchar datos filtrados del servicio
        this._sharedDataService.datosFiltrados$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(datosFiltrados => {
                this.datosFiltrados = datosFiltrados ?? [];

                // Solo agrupar si hay filtro de proceso activo
                const filtros = this._sharedDataService.obtenerFiltros();
                if (filtros.proceso) {
                    this.datosAgrupados = [];
                } else {
                    this.agruparDatosPorDepartamento();
                }

                this._cd.markForCheck();
            });
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
        const deptoSeleccionado = this.deptoControl.value || '';
        const procesoSeleccionado = this.procesoControl.value || '';

        // FILTRAR DATOS PRINCIPALES
        this.datosFiltrados = this.datos.filter(item => {
            const coincideBusqueda = !busqueda ||
                item.departamento?.toLowerCase().includes(busqueda) ||
                item.proceso?.toLowerCase().includes(busqueda);
            const coincideDepto = !deptoSeleccionado || item.departamento === deptoSeleccionado;
            const coincideProceso = !procesoSeleccionado || item.proceso === procesoSeleccionado;
            return coincideBusqueda && coincideDepto && coincideProceso;
        });


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


    agruparDatosPorDepartamento(): void {
        const map = new Map<string, DatoAgrupado>();

        this.datosFiltrados.forEach(item => {
            const depto = item.departamento;
            const cantidad = Number(item.CANTIDAD) || 0;

            if (!map.has(depto)) {
                map.set(depto, {
                    departamento: depto,
                    procesos: [],
                    cantidadTotal: 0,
                    expandido: false
                });
            }

            const grupo = map.get(depto)!;
            grupo.procesos.push({
                proceso: item.proceso,
                cantidad
            });
            grupo.cantidadTotal += cantidad;
        });

        this.datosAgrupados = Array.from(map.values());
    }


    toggleDepartamento(index: number): void {
        this.datosAgrupados[index].expandido = !this.datosAgrupados[index].expandido;
        this._cd.markForCheck();
    }

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

    aplicarOrdenamiento(): void {
        const campo = this.ordenActual.campo;
        const direccion = this.ordenActual.direccion;

        if (this.procesoControl.value) {
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
            this.datosAgrupados.sort((a, b) => {
                let valorA = campo === 'CANTIDAD' ? a.cantidadTotal : a.departamento;
                let valorB = campo === 'CANTIDAD' ? b.cantidadTotal : b.departamento;

                if (valorA < valorB) return direccion === 'asc' ? -1 : 1;
                if (valorA > valorB) return direccion === 'asc' ? 1 : -1;
                return 0;
            });
        }
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

    contarDepartamentos(): number {
        if (this.procesoControl.value) {
            const departamentos = new Set(this.datosFiltrados.map(item => item.departamento));
            return departamentos.size;
        } else {
            return this.datosAgrupados.length;
        }
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
        if (this.deptoControl.value) count++;
        if (this.procesoControl.value) count++;
        return count;
    }

}