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
import { ReportProdService } from '../reportprod.service';
import { ProcesosTabComponent } from './tabs/procesos/procesos-tab.compoonent';
import { SharedDataService } from './shared-data.service';
import { ProduccionTabComponent } from './tabs/produccion/produccion-tejido.compoonent';
import { TejidoRevisadoTabComponent } from './tabs/revisado/tejido-revisado.component';
import { PorRevisarTabComponent } from './tabs/por revisar/porrevisar-tab.component';
import { SaldosTabComponent } from './tabs/saldos/saldos.component';
import { EmbarquesTabComponent } from './tabs/embarques/embarques.component';
import { EstampadosTabComponent } from './tabs/estampados/estampados-tab.compoonent';
import { TintoreriaTabComponent } from './tabs/tintoreria/tintoreria-tab.compoonent';


interface DatoAgrupado {
    departamento: string;
    procesos: { proceso: string; cantidad: number }[];
    cantidadTotal: number;
    expandido?: boolean;
}

@Component({
    selector: 'reportprod-list',
    templateUrl: './reportprodList.component.html',
    styleUrls: ['./reportprodList.component.scss'],
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
        ProcesosTabComponent,
        ProduccionTabComponent,
        TejidoRevisadoTabComponent,
        PorRevisarTabComponent,
        SaldosTabComponent,
        EmbarquesTabComponent,
        EstampadosTabComponent,
        TintoreriaTabComponent

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

    // DATOS ORIGINALES Y FILTRADOS PARA TODOS LOS TABS
    datosTejido: any[] = [];
    datosTejidoFiltrados: any[] = [];
    datosRevisado: any[] = [];
    datosRevisadoFiltrados: any[] = [];
    datosPorRevisar: any[] = [];
    datosPorRevisarFiltrados: any[] = [];
    datosSaldos: any[] = [];
    datosSaldosFiltrados: any[] = [];
    datosEmbarques: any[] = [];
    datosEmbarquesFiltrados: any[] = [];

    isLoadingTejido = false;
    isLoadingRevisado = false;
    isLoadingPorRevisar = false;
    isLoadingSaldos = false;
    isLoadingEmbarques = false;


    selectedTabIndex = 0;

    // Controles de filtros
    searchControl = new FormControl('');
    deptoControl = new FormControl('');
    procesoControl = new FormControl('');
    rangoFechaControl = new FormControl('mes_actual');
    fechaInicioControl = new FormControl(null);
    fechaFinControl = new FormControl(null);
    verTodosControl = new FormControl(true);
    tipoEmbarqueControl = new FormControl('');

    rangoFechaSeleccionado: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo' = 'mes_actual';

    departamentosUnicos: string[] = [];
    procesosUnicos: string[] = [];
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

    ngOnInit(): void {
        const fechaInicio = new Date();
        fechaInicio.setDate(1);
        const fechaFin = new Date();

        this._sharedDataService.actualizarFiltros({
            rangoFecha: 'mes_actual',
            fechaInicio: fechaInicio,
            fechaFin: fechaFin
        });

        this.cargarDatosProcesos();
        this.configurarFiltros();
    }


    // 🔥 NUEVO MÉTODO: Solo carga datos para el tab de procesos
    private cargarDatosProcesos(): void {
        const filtros = this._sharedDataService.obtenerFiltros();
        const fechaInicio = filtros.fechaInicio || this.calcularFechaInicio('mes_actual');
        const fechaFin = filtros.fechaFin || new Date();

        this.isLoading = true;
        this._cd.markForCheck();

        this._reportService.getReportesProduccion(fechaInicio, fechaFin)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: response => {
                    this.datos = response;
                    this.extraerDatosUnicos();

                    // Aplicar filtros y actualizar servicio
                    this.aplicarFiltrosProcesos();

                    this.isLoading = false;
                    this._cd.markForCheck();
                },
                error: err => {
                    console.error('Error al cargar datos:', err);
                    this._snackBar.open('Error al cargar datos de producción', 'Cerrar', { duration: 5000 });
                    this.isLoading = false;
                    this._cd.markForCheck();
                }
            });
    }


    // 🔥 MÉTODO AUXILIAR: Calcular fecha inicio según rango
    private calcularFechaInicio(rango: string): Date {
        const fecha = new Date();
        switch (rango) {
            case 'hoy':
            case 'ayer':
                return fecha;
            case 'mes_actual':
                fecha.setDate(1);
                return fecha;
            case 'mes_anterior':
                fecha.setMonth(fecha.getMonth() - 1);
                fecha.setDate(1);
                return fecha;
            default:
                return fecha;
        }
    }

    // 🔥 NUEVO MÉTODO: Aplicar solo filtros de procesos
    private aplicarFiltrosProcesos(): void {
        const filtros = this._sharedDataService.obtenerFiltros();
        const busqueda = filtros.busqueda.toLowerCase();
        const deptoSeleccionado = filtros.departamento;
        const procesoSeleccionado = filtros.proceso;

        this.datosFiltrados = this.datos.filter(item => {
            // 🔥 NUEVA LÓGICA: Buscar en departamento, proceso Y artículo
            const coincideBusqueda = !busqueda ||
                item.departamento?.toLowerCase().includes(busqueda) ||
                item.proceso?.toLowerCase().includes(busqueda) ||
                item.ARTICULO?.toString().toLowerCase().includes(busqueda) ||
                item.CVE_ART?.toString().toLowerCase().includes(busqueda);

            const coincideDepto = !deptoSeleccionado || item.departamento === deptoSeleccionado;
            const coincideProceso = !procesoSeleccionado || item.proceso === procesoSeleccionado;
            return coincideBusqueda && coincideDepto && coincideProceso;
        });

        this._sharedDataService.actualizarDatos(
            this.datos,
            this.datosFiltrados
        );

        // 🔥 NO LLAMAR _cd.markForCheck() aquí para evitar recargar vista
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

    seleccionarRangoFecha(rango: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo'): void {
        this.rangoFechaSeleccionado = rango;

        if (rango === 'fecha_especifica' || rango === 'periodo') {
            return; // 🔥 Sin markForCheck
        }

        let fechaInicio: Date | undefined;
        let fechaFin: Date | undefined;

        if (rango !== 'todos') {
            fechaFin = new Date();
            switch (rango) {
                case 'hoy':
                    fechaInicio = new Date();
                    break;
                case 'ayer':
                    fechaInicio = new Date();
                    fechaInicio.setDate(fechaInicio.getDate() - 1);
                    fechaFin = new Date(fechaInicio);
                    break;
                case 'mes_actual':
                    fechaInicio = new Date();
                    fechaInicio.setDate(1);
                    break;
                case 'mes_anterior':
                    fechaInicio = new Date();
                    fechaInicio.setMonth(fechaInicio.getMonth() - 1);
                    fechaInicio.setDate(1);
                    fechaFin = new Date();
                    fechaFin.setDate(0);
                    break;
            }
        }

        this._sharedDataService.actualizarFiltros({
            rangoFecha: rango,
            fechaInicio: fechaInicio || null,
            fechaFin: fechaFin || null
        });

        this.cargarDatosProcesos();
        this.mostrarPanelFechas = false;
        // 🔥 SIN _cd.markForCheck() para no forzar re-render
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

        this._sharedDataService.actualizarFiltros({
            rangoFecha: this.rangoFechaSeleccionado,
            fechaInicio: fechaInicio,
            fechaFin: fechaFin
        });

        this.mostrarPanelFechas = false;
        // 🔥 SIN _cd.markForCheck()
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
            .subscribe(valor => {
                this._sharedDataService.actualizarFiltros({ busqueda: valor || '' });
                this.aplicarFiltrosProcesos();
                // 🔥 SIN _cd.markForCheck()
            });

        this.deptoControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(valor => {
                this._sharedDataService.actualizarFiltros({ departamento: valor || '' });
                this.aplicarFiltrosProcesos();
                // 🔥 SIN _cd.markForCheck()
            });

        this.procesoControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(valor => {
                this._sharedDataService.actualizarFiltros({ proceso: valor || '' });
                this.aplicarFiltrosProcesos();
                // 🔥 SIN _cd.markForCheck()
            });

        this.tipoEmbarqueControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(valor => {
                this._sharedDataService.actualizarFiltros({ tipoEmbarque: valor || '' });
            });
    }

    aplicarFiltros(): void {
        const busqueda = this.searchControl.value?.toLowerCase().trim() || '';
        const deptoSeleccionado = this.deptoControl.value || '';
        const procesoSeleccionado = this.procesoControl.value || '';
        const tipoSeleccionado = this.tipoEmbarqueControl.value || '';

        // FILTRAR DATOS PRINCIPALES
        this.datosFiltrados = this.datos.filter(item => {
            const coincideBusqueda = !busqueda ||
                item.departamento?.toLowerCase().includes(busqueda) ||
                item.proceso?.toLowerCase().includes(busqueda);
            const coincideDepto = !deptoSeleccionado || item.departamento === deptoSeleccionado;
            const coincideProceso = !procesoSeleccionado || item.proceso === procesoSeleccionado;
            return coincideBusqueda && coincideDepto && coincideProceso;
        });

        // FILTRAR TEJIDO
        this.datosTejidoFiltrados = this.datosTejido.filter(item => {
            return !busqueda || item.ARTICULO?.toString().toLowerCase().includes(busqueda);
        });

        // FILTRAR REVISADO
        this.datosRevisadoFiltrados = this.datosRevisado.filter(item => {
            return !busqueda || item.ARTICULO?.toString().toLowerCase().includes(busqueda);
        });

        // FILTRAR POR REVISAR
        this.datosPorRevisarFiltrados = this.datosPorRevisar.filter(item => {
            return !busqueda || item.ARTICULO?.toLowerCase().includes(busqueda);
        });

        // FILTRAR SALDOS
        this.datosSaldosFiltrados = this.datosSaldos.filter(item => {
            return !busqueda || item.ARTICULO?.toLowerCase().includes(busqueda);
        });

        // FILTRAR EMBARQUES
        this.datosEmbarquesFiltrados = this.datosEmbarques.filter(item => {
            const coincideBusqueda = !busqueda ||
                item.ARTICULO?.toLowerCase().includes(busqueda) ||
                item.TIPO?.toLowerCase().includes(busqueda);
            const coincideTipo = !tipoSeleccionado || item.TIPO === tipoSeleccionado;
            return coincideBusqueda && coincideTipo;
        });

        if (procesoSeleccionado) {
            this.datosAgrupados = [];
        } else {
            this.agruparDatosPorDepartamento();
        }

        // 👇 ACTUALIZAR EL SERVICIO COMPARTIDO
        this._sharedDataService.actualizarDatos(
            this.datos,
            this.datosFiltrados
        );

        this._sharedDataService.actualizarTejido(
            this.datos,
            this.datosTejidoFiltrados
        );

        this._sharedDataService.actualizarRevisado(
            this.datosRevisado,
            this.datosRevisadoFiltrados
        );

        this._sharedDataService.actualizarPorRevisar(
            this.datosPorRevisar,
            this.datosPorRevisarFiltrados
        );

        this._sharedDataService.actualizarSaldos(
            this.datosSaldos,
            this.datosSaldosFiltrados
        );

        this._sharedDataService.actualizarEmbarques(
            this.datosEmbarques,
            this.datosEmbarquesFiltrados
        );

        if (this.ordenActual.campo) {
            this.aplicarOrdenamiento();
        }

        this._cd.markForCheck();
    }


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

    // MÉTODOS DE CÁLCULO PARA SALDOS
    calcularTotalPesoSaldos(): number {
        return this.datosSaldosFiltrados.reduce((total, item) => total + (parseFloat(item.TOTAL_SALDO) || 0), 0);
    }

    calcularTotalPiezasSaldos(): number {
        return this.datosSaldosFiltrados.reduce((total, item) => total + (parseFloat(item.PIEZAS) || 0), 0);
    }

    contarArticulosSaldos(): number {
        return this.datosSaldosFiltrados.length;
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


    onTabChange(index: number): void {
        this.selectedTabIndex = index;
    }
}