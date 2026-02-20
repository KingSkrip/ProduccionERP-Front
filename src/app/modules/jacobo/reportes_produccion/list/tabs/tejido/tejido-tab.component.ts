import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { fuseAnimations } from '@fuse/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
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
    selector: 'tabs-tejido-tab',
    templateUrl: './tejido-tab.component.html',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations
})
export class TejidoTabComponent implements OnInit, OnDestroy {

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
                this.cargarTejido(filtros.fechaInicio, filtros.fechaFin);
                this._sharedDataService.confirmarRecargaConsumida();
            });

        // Carga inicial con fechas por defecto
        const filtros = this._sharedDataService.obtenerFiltros();
        this.cargarTejido(filtros.fechaInicio, filtros.fechaFin);
    }

    private aplicarFiltrosLocales(filtros: any): void {
        if (this.datos.length === 0) return;

        const busqueda = filtros.busqueda?.toLowerCase() || '';
        const deptoSeleccionado = filtros.departamento || '';

        this.datosFiltrados = this.datos.filter(item => {
            const coincideBusqueda = !busqueda ||
                item.departamento?.toLowerCase().includes(busqueda) ||
                item.proceso?.toLowerCase().includes(busqueda) ||
                item.ARTICULO?.toString().toLowerCase().includes(busqueda);

            const coincideDepto = !deptoSeleccionado || item.departamento === deptoSeleccionado;
            
            return coincideBusqueda && coincideDepto;
        });

        this.agruparDatosPorDepartamento();
        this._cd.markForCheck();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    cargarTejido(fechaInicio?: Date | null, fechaFin?: Date | null): void {
        this.loading = true;
        this._cd.markForCheck();

        this._reportService.getTejidoResumen(
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
                this._sharedDataService.actualizarTejidoResumen(data, this.datosFiltrados);

                this.loading = false;
                this._cd.markForCheck();
            },
            error: () => {
                this.loading = false;
                this._snackBar.open('Error al cargar Tejido', 'Cerrar', { duration: 3000 });
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
}