import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy, ViewEncapsulation, HostListener } from '@angular/core';
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
import { debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import { ReportProdService } from '../../../reportprod.service';
import { SharedDataService } from '../../shared-data.service';

interface DatoAgrupado {
    departamento: string;
    procesos: {
        proceso: string;
        cantidad: number;
        piezas: number;
    }[];
    cantidadTotal: number;
    piezasTotal: number;
    expandido?: boolean;
}

@Component({
    selector: 'tabs-estampados-tab',
    templateUrl: './estampados-tab.component.html',
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
export class EstampadosTabComponent implements OnInit, OnDestroy {

    datos: any[] = [];
    datosFiltrados: any[] = [];
    datosAgrupados: DatoAgrupado[] = [];
    loading = false;
    cargaInicial = false;

    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _cd: ChangeDetectorRef,
        private _reportService: ReportProdService,
        private _snackBar: MatSnackBar,
        private _sharedDataService: SharedDataService
    ) { }

    ngOnInit(): void {
        // Escuchar cambios en filtros globales (búsqueda, departamento, proceso)
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
                this.cargarEstampados(filtros.fechaInicio, filtros.fechaFin);
                this._sharedDataService.confirmarRecargaConsumida();
            });

        // Carga inicial con fechas por defecto
        const filtros = this._sharedDataService.obtenerFiltros();
        this.cargarEstampados(filtros.fechaInicio, filtros.fechaFin);
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private aplicarFiltrosLocales(filtros: any): void {
        if (this.datos.length === 0) return;

        const busqueda = filtros.busqueda?.toLowerCase() || '';
        const deptoSeleccionado = filtros.departamento || '';
        const procesoSeleccionado = filtros.proceso || '';

        this.datosFiltrados = this.datos.filter(item => {
            const coincideBusqueda = !busqueda ||
                item.departamento?.toLowerCase().includes(busqueda) ||
                item.proceso?.toLowerCase().includes(busqueda) ||
                item.ARTICULO?.toString().toLowerCase().includes(busqueda);

            const coincideDepto = !deptoSeleccionado || item.departamento === deptoSeleccionado;
            const coincideProceso = !procesoSeleccionado || item.proceso === procesoSeleccionado;
            
            return coincideBusqueda && coincideDepto && coincideProceso;
        });

        this.agruparDatosPorDepartamento();
        this._cd.markForCheck();
    }

    cargarEstampados(fechaInicio?: Date | null, fechaFin?: Date | null): void {
        this.loading = true;
        this._cd.markForCheck();

        this._reportService.getEstampados(
            fechaInicio || undefined,
            fechaFin || undefined
        ).subscribe({
            next: (data) => {
                this.datos = data;
                this.cargaInicial = true;
                
                // Aplicar filtros actuales después de cargar datos
                const filtros = this._sharedDataService.obtenerFiltros();
                this.aplicarFiltrosLocales(filtros);

                // Actualizar servicio compartido
                this._sharedDataService.actualizarEstampados(data);

                this.loading = false;
                this._cd.markForCheck();
            },
            error: () => {
                this.loading = false;
                this._snackBar.open('Error al cargar estampados', 'Cerrar', { duration: 3000 });
                this._cd.markForCheck();
            }
        });
    }

    agruparDatosPorDepartamento(): void {
        const map = new Map<string, DatoAgrupado>();

        this.datosFiltrados.forEach(item => {
            const depto = item.departamento;
            const cantidad = Number(item.CANTIDAD) || 0;
            const piezas = Number(item.PIEZAS) || 0;

            if (!map.has(depto)) {
                map.set(depto, {
                    departamento: depto,
                    procesos: [],
                    cantidadTotal: 0,
                    piezasTotal: 0,
                    expandido: false
                });
            }

            const grupo = map.get(depto)!;
            grupo.procesos.push({
                proceso: item.proceso,
                cantidad,
                piezas
            });

            grupo.cantidadTotal += cantidad;
            grupo.piezasTotal += piezas;
        });

        this.datosAgrupados = Array.from(map.values());
    }

    toggleDepartamento(index: number): void {
        this.datosAgrupados[index].expandido = !this.datosAgrupados[index].expandido;
        this._cd.markForCheck();
    }

    calcularCantidadTotal(): number {
        return this.datosAgrupados.reduce((total, grupo) =>
            total + grupo.cantidadTotal, 0
        );
    }

    contarDepartamentos(): number {
        return this.datosAgrupados.length;
    }

    limpiarFiltrosLocales(): void {
        this._sharedDataService.actualizarFiltros({
            busqueda: '',
            departamento: '',
            proceso: ''
        });
    }

    trackByFn(index: number, item: any): string {
        return item.departamento || item.CVE_ART || `${item.depto}-${item.proc}` || index.toString();
    }
}