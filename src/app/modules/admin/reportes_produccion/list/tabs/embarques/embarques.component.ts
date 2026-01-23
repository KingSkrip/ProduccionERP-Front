import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { fuseAnimations } from '@fuse/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { ReportProdService } from '../../../reportprod.service';
import { SharedDataService } from '../../shared-data.service';

@Component({
    selector: 'tabs-embarques',
    templateUrl: './embarques.component.html',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations
})
export class EmbarquesTabComponent implements OnInit, OnDestroy {
    
    // Datos originales y filtrados
    datos: any[] = [];
    datosFiltrados: any[] = [];
    
    // Estados
    isLoading = false;
    cargaInicial = false;
    
    // Controles de filtro
    tipoEmbarqueControl = new FormControl('');
    tiposEmbarqueUnicos: string[] = [];

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
                // Sincronizar el control de tipo embarque con filtros globales
                if (this.tipoEmbarqueControl.value !== filtros.tipoEmbarque) {
                    this.tipoEmbarqueControl.setValue(filtros.tipoEmbarque, { emitEvent: false });
                }

                // Solo aplicar filtros si ya hemos cargado datos
                if (this.cargaInicial) {
                    this.aplicarFiltrosLocales(filtros);
                }
            });

        // Escuchar cambios en el control de tipo embarque
        this.tipoEmbarqueControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(tipo => {
                this._sharedDataService.actualizarFiltros({ tipoEmbarque: tipo || '' });
            });

        // Escuchar cambios en fechas para recargar datos
        this._sharedDataService.recargarDatos$
            .pipe(
                takeUntil(this._unsubscribeAll),
                filter(recargar => recargar === true)
            )
            .subscribe(() => {
                const filtros = this._sharedDataService.obtenerFiltros();
                this.cargarEmbarques(filtros.fechaInicio, filtros.fechaFin);
                this._sharedDataService.confirmarRecargaConsumida();
            });

        // Carga inicial con fechas por defecto
        const filtros = this._sharedDataService.obtenerFiltros();
        this.cargarEmbarques(filtros.fechaInicio, filtros.fechaFin);
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
        const tipoSeleccionado = filtros.tipoEmbarque || '';

        this.datosFiltrados = this.datos.filter(item => {
            const coincideBusqueda = !busqueda ||
                item.ARTICULO?.toString().toLowerCase().includes(busqueda) ||
                item.TIPO?.toString().toLowerCase().includes(busqueda);

            // Si el item tiene departamento, verificar coincidencia
            const coincideDepto = !deptoSeleccionado || 
                (item.departamento && item.departamento === deptoSeleccionado);
            
            const coincideTipo = !tipoSeleccionado || item.TIPO === tipoSeleccionado;
            
            return coincideBusqueda && coincideDepto && coincideTipo;
        });

        // Actualizar servicio compartido
        this._sharedDataService.actualizarEmbarques(this.datos, this.datosFiltrados);

        this._cd.markForCheck();
    }

    cargarEmbarques(fechaInicio?: Date | null, fechaFin?: Date | null): void {
        this.isLoading = true;
        this._cd.markForCheck();

        this._reportService.getEntregadoaEmbarques(
            fechaInicio || undefined,
            fechaFin || undefined
        ).pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (response) => {
                    this.datos = response || [];
                    this.cargaInicial = true;
                    
                    // Extraer tipos únicos de embarque
                    this.extraerTiposEmbarque();
                    
                    // Aplicar filtros actuales después de cargar datos
                    const filtros = this._sharedDataService.obtenerFiltros();
                    this.aplicarFiltrosLocales(filtros);

                    this.isLoading = false;
                    this._cd.markForCheck();
                },
                error: (err) => {
                    console.error('Error al cargar embarques:', err);
                    this._snackBar.open('Error al cargar datos de embarques', 'Cerrar', { duration: 3000 });
                    this.isLoading = false;
                    this._cd.markForCheck();
                }
            });
    }

    extraerTiposEmbarque(): void {
        const tiposSet = new Set<string>();
        this.datos.forEach(item => {
            if (item.TIPO) {
                tiposSet.add(item.TIPO);
            }
        });
        this.tiposEmbarqueUnicos = Array.from(tiposSet).sort();
    }

    limpiarFiltrosLocales(): void {
        this._sharedDataService.actualizarFiltros({
            busqueda: '',
            departamento: '',
            proceso: '',
            tipoEmbarque: ''
        });
    }

    // Getters para el template
    get datosEmbarquesFiltrados(): any[] {
        return this.datosFiltrados;
    }

    get isLoadingEmbarques(): boolean {
        return this.isLoading;
    }

    calcularTotalEmbarques(): number {
        return this.datosFiltrados.reduce((total, item) => {
            const cantidad = parseFloat(item.CANTIDAD) || 0;
            return total + cantidad;
        }, 0);
    }

    calcularPorTipo(tipo: string): number {
        const itemsFiltrados = this.datosFiltrados.filter(item => item.TIPO?.trim() === tipo);
        return itemsFiltrados.reduce((sum, item) => {
            const cantidad = parseFloat(item.CANTIDAD) || 0;
            return sum + cantidad;
        }, 0);
    }

    contarArticulosEmbarques(): number {
        const articulos = new Set(this.datosFiltrados.map(item => item.ARTICULO));
        return articulos.size;
    }

    contarTiposEmbarque(): number {
        const tipos = new Set(this.datosFiltrados.map(item => item.TIPO));
        return tipos.size;
    }
}