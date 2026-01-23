import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CommonModule, CurrencyPipe } from '@angular/common';
import {
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ApexOptions } from 'apexcharts';
import { FinanceService } from 'app/modules/admin/dashboards/finance/finance.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { filter, forkJoin, Subject, takeUntil, map, BehaviorSubject } from 'rxjs';
import { SharedDataService } from '../../list/shared-data.service';
import { ReportProdService } from '../../reportprod.service';

interface MetricCard {
    title: string;
    value: number;
    subtitle?: string;
    icon: string;
    color: string;
    loading: boolean;
    format?: 'currency' | 'number' | 'decimal';
    area: string;
}

interface AreaResumen {
    nombre: string;
    icon: string;
    color: string;
    metrics: { label: string; value: number; format?: string }[];
    loading: boolean;
}

interface FacturaDetalle {
    cliente: string;
    factura: string;
    fecha: string;
    cant: number;
    um: string;
    importe: number;
    impuestos: number;
    total: number;
}

interface ClienteAgrupado {
    cliente: string;
    facturas: FacturaDetalle[];
    cantidadesPorUnidad: { [key: string]: number };
    importeTotal: number;
    impuestosTotal: number;
    totalFacturado: number;
    expandido: boolean;
}


interface AreaResumen {
    nombre: string;
    icon: string;
    color: string;
    metrics: { label: string; value: number; format?: string }[];
    loading: boolean;
    detalles?: Array<{
        departamento: string;
        proceso: string;
        cantidad: number;
        piezas: number;
    }>;
}

@Component({
    selector: 'inicio-view',
    templateUrl: './inicioview.component.html',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatButtonToggleModule,
        NgApexchartsModule,

        MatButtonModule,
        MatMenuModule,
        MatDividerModule,
        MatTableModule,
        MatSortModule,
        MatProgressBarModule,
        CurrencyPipe,
    ],
})
export class InicioViewComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();
    vistaActual: 'general' | 'detalle' = 'general';
    isMobile = false;
    datosAgrupados: ClienteAgrupado[] = [];

    @ViewChild(MatSort) recentTransactionsTableMatSort!: MatSort;
    data: any = {
        previousStatement: { date: '', limit: 0, spent: 0, minimum: 0 },
        currentStatement: { date: '', limit: 0, spent: 0, minimum: 0 },
        accountBalance: { growRate: 0, ami: 0, series: [] },
        recentTransactions: [],
    };
    recentTransactionsDataSource: MatTableDataSource<any> =
        new MatTableDataSource();
    recentTransactionsTableColumns: string[] = [
        'transactionId',
        'date',
        'name',
        'amount',
        'status',
    ];

    chartDistribucionProcesos: ApexOptions | null = null;

    cantidadTotal = 0;
    cantidadesPorUnidad: { [key: string]: number } = {};
    cantidadesTotalesPorUnidad: Record<string, number> = {};
    facturasConIva = 0;
    facturasSinIva = 0;
    accountBalanceOptions!: ApexOptions;
    filtros$ = this.sharedData.filtrosGlobales$;

    rangoTexto$ = this.filtros$.pipe(
        map(f => {
            const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
            const hoy = new Date();

            switch (f.rangoFecha) {
                case 'todos': return 'Todos los registros';
                case 'hoy': return `Hoy - ${hoy.toLocaleDateString('es-MX', opts)}`;
                case 'ayer': {
                    const ayer = new Date();
                    ayer.setDate(ayer.getDate() - 1);
                    return `Ayer - ${ayer.toLocaleDateString('es-MX', opts)}`;
                }
                case 'mes_actual': {
                    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                    return `${inicioMes.toLocaleDateString('es-MX', opts)} - ${hoy.toLocaleDateString('es-MX', opts)}`;
                }
                case 'mes_anterior': {
                    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
                    return `${inicio.toLocaleDateString('es-MX', opts)} - ${fin.toLocaleDateString('es-MX', opts)}`;
                }
                case 'fecha_especifica':
                    return f.fechaInicio ? `Fecha: ${f.fechaInicio.toLocaleDateString('es-MX', opts)}` : 'Seleccionar fecha';
                case 'periodo':
                    return (f.fechaInicio && f.fechaFin)
                        ? `${f.fechaInicio.toLocaleDateString('es-MX', opts)} - ${f.fechaFin.toLocaleDateString('es-MX', opts)}`
                        : 'Periodo de fechas';
                default:
                    return 'Mes actual';
            }
        })
    );

    metricsGenerales: MetricCard[] = [
        {
            title: 'Total facturado',
            value: 0,
            subtitle: 'MXN',
            icon: 'paid',
            color: '#10b981',
            loading: true,
            format: 'currency',
            area: 'facturado',
        },
        {
            title: 'Producción tejido',
            value: 0,
            subtitle: 'kg',
            icon: 'straighten',
            color: '#3b82f6',
            loading: true,
            format: 'decimal',
            area: 'produccion',
        },
        {
            title: 'Tejido revisado',
            value: 0,
            subtitle: 'kg',
            icon: 'verified',
            color: '#8b5cf6',
            loading: true,
            format: 'decimal',
            area: 'revisado',
        },
        {
            title: 'Tintorería',
            value: 0,
            subtitle: 'kg',
            icon: 'palette',
            color: '#ec4899',
            loading: true,
            format: 'decimal',
            area: 'tintoreria',
        },
        {
            title: 'Estampados',
            value: 0,
            subtitle: 'kg',
            icon: 'print',
            color: '#f59e0b',
            loading: true,
            format: 'decimal',
            area: 'estampados',
        },
        {
            title: 'Acabado real',
            value: 0,
            subtitle: 'kg',
            icon: 'verified_user',
            color: '#06b6d4',
            loading: true,
            format: 'decimal',
            area: 'acabado',
        },
    ];

    areasResumen: AreaResumen[] = [
        {
            nombre: 'Facturación',
            icon: 'receipt_long',
            color: '#10b981',
            metrics: [
                { label: 'Total facturado', value: 0, format: 'currency' },
                { label: 'Facturas', value: 0, format: 'number' },
                { label: 'Cantidad total', value: 0, format: 'decimal' },
            ],
            loading: true,
        },
        {
            nombre: 'Producción tejido',
            icon: 'straighten',
            color: '#3b82f6',
            metrics: [
                { label: 'Peso total', value: 0, format: 'decimal' },
                { label: 'Piezas', value: 0, format: 'number' },
                { label: 'Artículos', value: 0, format: 'number' },
            ],
            loading: true,
        },
        {
            nombre: 'Tejido revisado',
            icon: 'verified',
            color: '#8b5cf6',
            metrics: [
                { label: 'Peso revisado', value: 0, format: 'decimal' },
                { label: 'Piezas', value: 0, format: 'number' },
                { label: 'Artículos', value: 0, format: 'number' },
            ],
            loading: true,
        },
        {
            nombre: 'Por revisar',
            icon: 'pending',
            color: '#f97316',
            metrics: [
                { label: 'Peso pendiente', value: 0, format: 'decimal' },
                { label: 'Piezas', value: 0, format: 'number' },
                { label: 'Artículos', value: 0, format: 'number' },
            ],
            loading: true,
        },
        {
            nombre: 'Saldos',
            icon: 'inventory',
            color: '#eab308',
            metrics: [
                { label: 'Peso en saldo', value: 0, format: 'decimal' },
                { label: 'Piezas', value: 0, format: 'number' },
                { label: 'Artículos', value: 0, format: 'number' },
            ],
            loading: true,
        },
        {
            nombre: 'Embarques',
            icon: 'local_shipping',
            color: '#14b8a6',
            metrics: [
                { label: 'Total embarcado', value: 0, format: 'decimal' },
                { label: 'Tipos de embarque', value: 0, format: 'number' },
                { label: 'Artículos', value: 0, format: 'number' },
            ],
            loading: true,
        },
        {
            nombre: 'Procesos tejido',
            icon: 'category',
            color: '#6366f1',
            metrics: [
                { label: 'Cantidad total', value: 0, format: 'decimal' },
                { label: 'Piezas', value: 0, format: 'number' },
                { label: 'Departamentos', value: 0, format: 'number' },
            ],
            loading: true,
        },
        {
            nombre: 'Tintorería',
            icon: 'palette',
            color: '#ec4899',
            metrics: [
                { label: 'Cantidad total', value: 0, format: 'decimal' },
                { label: 'Piezas', value: 0, format: 'number' },
                { label: 'Procesos', value: 0, format: 'number' },
            ],
            loading: true,
            detalles: [],
        },
        {
            nombre: 'Estampados',
            icon: 'print',
            color: '#f59e0b',
            metrics: [
                { label: 'Cantidad total', value: 0, format: 'decimal' },
                { label: 'Piezas', value: 0, format: 'number' },
                { label: 'Procesos', value: 0, format: 'number' },
            ],
            loading: true,
            detalles: [],
        },
        {
            nombre: 'Acabado real',
            icon: 'verified_user',
            color: '#06b6d4',
            metrics: [
                { label: 'Cantidad total', value: 0, format: 'decimal' },
                { label: 'Piezas', value: 0, format: 'number' },
                { label: 'Procesos', value: 0, format: 'number' },
            ],
            loading: true,
            detalles: [],
        },
    ];

    chartFacturacion: ApexOptions | null = null;
    chartProduccion: ApexOptions | null = null;
    chartComparativa: ApexOptions | null = null;
    chartEmbarques: ApexOptions | null = null;
    private ultimoDetalleFacturado: any[] = [];

    constructor(
        private reportService: ReportProdService,
        private sharedData: SharedDataService,
        private cdr: ChangeDetectorRef,
        private breakpointObserver: BreakpointObserver,
        private _financeService: FinanceService
    ) { }

    ngOnInit(): void {

        this.breakpointObserver
            .observe([Breakpoints.Handset])
            .pipe(takeUntil(this.destroy$))
            .subscribe((result) => {
                this.isMobile = result.matches;
                this.cdr.markForCheck();
            });

        this.sharedData.recargarDatos$
            .pipe(
                takeUntil(this.destroy$),
                filter((recargar) => recargar === true)
            )
            .subscribe(() => {
                this.cargarTodasLasAreas();
                this.sharedData.confirmarRecargaConsumida();
            });

        this._financeService.data$
            .pipe(takeUntil(this.destroy$))
            .subscribe((data) => {
                if (!data) return;

                this.recentTransactionsDataSource.data = data.recentTransactions ?? [];

                this.data = {
                    ...this.data,
                    recentTransactions: data.recentTransactions ?? this.data.recentTransactions,

                };

                this.cdr.markForCheck();
            });


        this.sharedData.datosFacturado$
            .pipe(takeUntil(this.destroy$))
            .subscribe((facturado) => {

                const payload = facturado?.data ?? facturado;
                const detalle = payload?.detalle ?? [];

                if (!detalle.length) {
                    this.data.previousStatement = { date: '', limit: 0, spent: 0, minimum: 0 };
                    this.data.currentStatement = { date: '', limit: 0, spent: 0, minimum: 0 };
                    this.data.accountBalance = { growRate: 0, ami: 0, series: [] };
                    this._prepareChartData();
                    this.cdr.markForCheck();
                    return;
                }

                const filtros = this.sharedData.obtenerFiltros();

                const from = filtros.fechaInicio
                    ? new Date(filtros.fechaInicio)
                    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

                const to = filtros.fechaFin ? new Date(filtros.fechaFin) : new Date();

                const toExclusive = new Date(to);
                toExclusive.setHours(0, 0, 0, 0);
                toExclusive.setDate(toExclusive.getDate() + 1);

                this.setCardsFacturadoPorFiltro(detalle, from, toExclusive);

                this.procesarFacturadoParaGrafica(detalle);

                this._prepareChartData();
                this.cdr.markForCheck();
            });

        this.cargarTodasLasAreas();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private cargarTodasLasAreas(): void {
        const filtros = this.sharedData.obtenerFiltros();
        const fechaInicio =
            filtros.fechaInicio ||
            new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const fechaFin = filtros.fechaFin || new Date();

        this.metricsGenerales.forEach((m) => (m.loading = true));
        this.areasResumen.forEach((a) => (a.loading = true));
        this.cdr.markForCheck();

        forkJoin({
            facturado: this.reportService.getFacturado(
                fechaInicio,
                fechaFin,
                true
            ),
            produccion: this.reportService.getProduccionTejido(
                fechaInicio,
                fechaFin
            ),
            revisado: this.reportService.getRevisadoTejido(
                fechaInicio,
                fechaFin
            ),
            porRevisar: this.reportService.getPorRevisarTejido(
                fechaInicio,
                fechaFin
            ),
            saldos: this.reportService.getSaldosTejido(fechaInicio, fechaFin),
            embarques: this.reportService.getEntregadoaEmbarques(
                fechaInicio,
                fechaFin
            ),
            tejido: this.reportService.getTejidoResumen(fechaInicio, fechaFin),
            tintoreria: this.reportService.getTintoreria(fechaInicio, fechaFin),
            estampados: this.reportService.getEstampados(fechaInicio, fechaFin),
            acabado: this.reportService.getAcabado(fechaInicio, fechaFin),
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (datos) => {
                    this.sharedData.setDatosFacturado(datos.facturado);

                    this.procesarFacturado(datos.facturado);
                    this.onFacturadoLoaded(datos.facturado);
                    this.procesarProduccion(datos.produccion);
                    this.procesarRevisado(datos.revisado);
                    this.procesarPorRevisar(datos.porRevisar);
                    this.procesarSaldos(datos.saldos);
                    this.procesarEmbarques(datos.embarques);
                    this.procesarTejido(datos.tejido);
                    this.procesarTintoreria(datos.tintoreria);
                    this.procesarEstampados(datos.estampados);
                    this.procesarAcabado(datos.acabado);

                    this.crearGraficaComparativa(datos);

                    this.crearGraficaDistribucionProcesos(datos); 

                    this.metricsGenerales.forEach((m) => (m.loading = false));
                    this.areasResumen.forEach((a) => (a.loading = false));
                    this.cdr.markForCheck();
                },
                error: (err) => {
                    this.metricsGenerales.forEach((m) => (m.loading = false));
                    this.areasResumen.forEach((a) => (a.loading = false));
                    this.cdr.markForCheck();
                },
            });
    }

    private procesarFacturado(resp: any): void {
        const payload = resp?.data ?? resp;
        if (!payload) return;

        const tot = payload.totales ?? {};
        const detalle = payload.detalle ?? [];

        const totalFacturado = Number(tot.total) || 0;
        const facturas = Number(tot.facturas) || 0;
        const cantidad = Number(tot.cant) || 0;

        const metricGeneral = this.metricsGenerales.find(m => m.area === 'facturado');
        if (metricGeneral) metricGeneral.value = totalFacturado;

        const area = this.areasResumen.find(a => a.nombre === 'Facturación');
        if (area) {
            area.metrics[0].value = totalFacturado;
            area.metrics[1].value = facturas;
            area.metrics[2].value = cantidad;
        }

        if (Array.isArray(detalle) && detalle.length) {
            this.crearGraficaFacturacion(detalle);
        }
    }


    private procesarProduccion(data: any[]): void {
        if (!data || !Array.isArray(data)) return;

        const pesoTotal = data.reduce(
            (sum, item) => sum + (Number(item.TOTAL_TJ) || 0),
            0
        );
        const piezasTotal = data.reduce(
            (sum, item) => sum + (Number(item.PIEZAS) || 0),
            0
        );
        const articulos = data.length;

        const metricGeneral = this.metricsGenerales.find(
            (m) => m.area === 'produccion'
        );
        if (metricGeneral) metricGeneral.value = pesoTotal;

        const area = this.areasResumen.find(
            (a) => a.nombre === 'Producción tejido'
        );
        if (area) {
            area.metrics[0].value = pesoTotal;
            area.metrics[1].value = piezasTotal;
            area.metrics[2].value = articulos;
        }
    }

    private procesarRevisado(data: any[]): void {
        if (!data || !Array.isArray(data)) return;

        const pesoTotal = data.reduce(
            (sum, item) => sum + (Number(item.TOTAL_RV) || 0),
            0
        );
        const piezasTotal = data.reduce(
            (sum, item) => sum + (Number(item.PIEZAS) || 0),
            0
        );
        const articulos = data.length;

        const metricGeneral = this.metricsGenerales.find(
            (m) => m.area === 'revisado'
        );
        if (metricGeneral) metricGeneral.value = pesoTotal;

        const area = this.areasResumen.find(
            (a) => a.nombre === 'Tejido revisado'
        );
        if (area) {
            area.metrics[0].value = pesoTotal;
            area.metrics[1].value = piezasTotal;
            area.metrics[2].value = articulos;
        }
    }

    private procesarPorRevisar(data: any[]): void {
        if (!data || !Array.isArray(data)) return;

        const pesoTotal = data.reduce(
            (sum, item) => sum + (Number(item.TOTAL_POR_REVISAR) || 0),
            0
        );
        const piezasTotal = data.reduce(
            (sum, item) => sum + (Number(item.PIEZAS) || 0),
            0
        );
        const articulos = data.length;

        const area = this.areasResumen.find((a) => a.nombre === 'Por revisar');
        if (area) {
            area.metrics[0].value = pesoTotal;
            area.metrics[1].value = piezasTotal;
            area.metrics[2].value = articulos;
        }
    }

    private procesarSaldos(data: any[]): void {
        if (!data || !Array.isArray(data)) return;

        const pesoTotal = data.reduce(
            (sum, item) => sum + (Number(item.TOTAL_SALDO) || 0),
            0
        );
        const piezasTotal = data.reduce(
            (sum, item) => sum + (Number(item.PIEZAS) || 0),
            0
        );
        const articulos = data.length;

        const area = this.areasResumen.find((a) => a.nombre === 'Saldos');
        if (area) {
            area.metrics[0].value = pesoTotal;
            area.metrics[1].value = piezasTotal;
            area.metrics[2].value = articulos;
        }
    }

    private procesarEmbarques(data: any[]): void {
        if (!data || !Array.isArray(data)) return;

        const totalEmbarcado = data.reduce(
            (sum, item) => sum + (Number(item.CANTIDAD) || 0),
            0
        );
        const tipos = new Set(data.map((item) => item.TIPO?.trim())).size;
        const articulos = new Set(data.map((item) => item.ARTICULO)).size;

        const area = this.areasResumen.find((a) => a.nombre === 'Embarques');
        if (area) {
            area.metrics[0].value = totalEmbarcado;
            area.metrics[1].value = tipos;
            area.metrics[2].value = articulos;
        }

        this.crearGraficaEmbarques(data);
    }

    private procesarTejido(data: any[]): void {
        if (!data || !Array.isArray(data)) return;

        const cantidadTotal = data.reduce(
            (sum, item) => sum + (Number(item.CANTIDAD) || 0),
            0
        );
        const piezasTotal = data.reduce(
            (sum, item) => sum + (Number(item.PIEZAS) || 0),
            0
        );
        const departamentos = new Set(data.map((item) => item.departamento))
            .size;

        const area = this.areasResumen.find(
            (a) => a.nombre === 'Procesos tejido'
        );
        if (area) {
            area.metrics[0].value = cantidadTotal;
            area.metrics[1].value = piezasTotal;
            area.metrics[2].value = departamentos;
        }

        this.crearGraficaProduccion(data);
    }

    private procesarTintoreria(data: any[]): void {
        if (!data || !Array.isArray(data)) return;

        const cantidadTotal = data.reduce(
            (sum, item) => sum + (Number(item.CANTIDAD) || 0),
            0
        );
        const piezasTotal = data.reduce(
            (sum, item) => sum + (Number(item.PIEZAS) || 0),
            0
        );
        const procesos = data.length;

        const metricGeneral = this.metricsGenerales.find(
            (m) => m.area === 'tintoreria'
        );
        if (metricGeneral) metricGeneral.value = cantidadTotal;

        const area = this.areasResumen.find((a) => a.nombre === 'Tintorería');
        if (area) {
            area.metrics[0].value = cantidadTotal;
            area.metrics[1].value = piezasTotal;
            area.metrics[2].value = procesos;

            area.detalles = data.map(item => ({
                departamento: item.departamento || 'N/A',
                proceso: item.proceso || 'N/A',
                cantidad: Number(item.CANTIDAD) || 0,
                piezas: Number(item.PIEZAS) || 0
            }));
        }
    }

    private procesarEstampados(data: any[]): void {
        if (!data || !Array.isArray(data)) return;

        const cantidadTotal = data.reduce(
            (sum, item) => sum + (Number(item.CANTIDAD) || 0),
            0
        );
        const piezasTotal = data.reduce(
            (sum, item) => sum + (Number(item.PIEZAS) || 0),
            0
        );
        const procesos = data.length;

        const metricGeneral = this.metricsGenerales.find(
            (m) => m.area === 'estampados'
        );
        if (metricGeneral) metricGeneral.value = cantidadTotal;

        const area = this.areasResumen.find((a) => a.nombre === 'Estampados');
        if (area) {
            area.metrics[0].value = cantidadTotal;
            area.metrics[1].value = piezasTotal;
            area.metrics[2].value = procesos;
            area.detalles = data.map(item => ({
                departamento: item.departamento || 'N/A',
                proceso: item.proceso || 'N/A',
                cantidad: Number(item.CANTIDAD) || 0,
                piezas: Number(item.PIEZAS) || 0
            }));
        }
    }

    private procesarAcabado(data: any[]): void {
        if (!data || !Array.isArray(data)) return;

        const cantidadTotal = data.reduce(
            (sum, item) => sum + (Number(item.CANTIDAD) || 0),
            0
        );
        const piezasTotal = data.reduce(
            (sum, item) => sum + (Number(item.PIEZAS) || 0),
            0
        );
        const procesos = data.length;

        const metricGeneral = this.metricsGenerales.find(
            (m) => m.area === 'acabado'
        );
        if (metricGeneral) metricGeneral.value = cantidadTotal;

        const area = this.areasResumen.find((a) => a.nombre === 'Acabado real');
        if (area) {
            area.metrics[0].value = cantidadTotal;
            area.metrics[1].value = piezasTotal;
            area.metrics[2].value = procesos;
            area.detalles = data.map(item => ({
                departamento: item.departamento || 'N/A',
                proceso: item.proceso || 'N/A',
                cantidad: Number(item.CANTIDAD) || 0,
                piezas: Number(item.PIEZAS) || 0
            }));
        }
    }

    private crearGraficaFacturacion(detalle: any[]): void {
        const clientesMap = new Map<string, number>();

        const round3 = (n: number) =>
            Math.round((n + Number.EPSILON) * 1000) / 1000;

        detalle.forEach((item) => {
            const cliente = (item.cliente || 'Sin cliente').toString().trim();
            const total = round3(Number(item.total) || 0);

            clientesMap.set(
                cliente,
                round3((clientesMap.get(cliente) || 0) + total)
            );
        });

        const clientes = Array.from(clientesMap.entries()).sort(
            (a, b) => b[1] - a[1]
        );

        const labels = clientes.map((c) => c[0]);
        const values = clientes.map((c) => round3(c[1]));

        const short = (s: string, n = this.isMobile ? 14 : 18) =>
            s.length > n ? s.slice(0, n - 1) + '…' : s;

        this.chartFacturacion = {
            series: values,

            labels: labels.map((l) => short(l)),

            chart: {
                type: 'donut',
                height: this.isMobile ? 320 : 380,
                fontFamily: 'Inter, sans-serif',
                toolbar: { show: false },
            },

            colors: [
                '#10b981',
                '#3b82f6',
                '#f59e0b',
                '#8b5cf6',
                '#ec4899',
                '#06b6d4',
                '#6366f1',
                '#14b8a6',
                '#f97316',
                '#84cc16',
            ],

            plotOptions: {
                pie: {
                    donut: {
                        size: '72%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Total',
                                fontSize: '12px',
                                formatter: (w: any) => {
                                    const total = round3(
                                        w.globals.seriesTotals.reduce(
                                            (a: number, b: number) => a + b,
                                            0
                                        )
                                    );
                                    return this.formatValue(total, 'currency');
                                },
                            },
                        },
                    },
                },
            },

            dataLabels: {
                enabled: false,
            },

            stroke: {
                show: true,
                width: 3,
                colors: ['#fff'],
            },

            legend: {
                show: true,
                position: this.isMobile ? 'bottom' : 'right',
                fontSize: '11px',
                markers: { size: 7 },
                itemMargin: { horizontal: 8, vertical: 6 },
                formatter: (name: string, opts: any) => {
                    const val = round3(opts.w.globals.series[opts.seriesIndex]);
                    return `${name} · ${this.formatValue(round3(val), 'currency')}`;
                },
            },

            tooltip: {
                y: {
                    formatter: (val: number) =>
                        this.formatValue(round3(val), 'currency'),
                },
            },
            responsive: [
                {
                    breakpoint: 768,
                    options: {
                        legend: { position: 'bottom' },
                    },
                },
            ],
        };
    }

    private crearGraficaProduccion(data: any[]): void {
        const deptosMap = new Map<string, number>();

        data.forEach((item: any) => {
            const depto = item.departamento || 'Sin departamento';
            const cantidad = deptosMap.get(depto) || 0;
            deptosMap.set(depto, cantidad + (Number(item.CANTIDAD) || 0));
        });

        const topDeptos = Array.from(deptosMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        this.chartProduccion = {
            series: [
                {
                    name: 'Cantidad (kg)',
                    data: topDeptos.map((d) => d[1]),
                },
            ],
            chart: {
                type: 'bar',
                height: this.isMobile ? 250 : 300,
                fontFamily: 'Inter, sans-serif',
            },
            xaxis: {
                categories: topDeptos.map((d) => d[0]),
            },
            colors: ['#3b82f6'],
            dataLabels: {
                enabled: false,
            },
            plotOptions: {
                bar: {
                    borderRadius: 8,
                    horizontal: false,
                },
            },
        };
    }

    private crearGraficaEmbarques(data: any[]): void {
        const tiposMap = new Map<string, number>();

        data.forEach((item: any) => {
            const tipo = item.TIPO?.trim() || 'Sin tipo';
            const cantidad = tiposMap.get(tipo) || 0;
            tiposMap.set(tipo, cantidad + (Number(item.CANTIDAD) || 0));
        });

        const tipos = Array.from(tiposMap.entries()).sort(
            (a, b) => b[1] - a[1]
        );

        this.chartEmbarques = {
            series: tipos.map((t) => t[1]),
            chart: {
                type: 'pie',
                height: this.isMobile ? 250 : 300,
                fontFamily: 'Inter, sans-serif',
            },
            labels: tipos.map((t) => t[0]),
            colors: ['#14b8a6', '#06b6d4', '#0891b2', '#0e7490'],
            legend: {
                position: this.isMobile ? 'bottom' : 'right',
                fontSize: '11px',
            },
            dataLabels: {
                enabled: true,
                formatter: (val: number) => `${val.toFixed(1)}%`,
            },
        };
    }

    private crearGraficaComparativa(datos: any): void {
        const areas = [
            {
                nombre: 'Tejido',
                valor: datos.tejido.reduce(
                    (s: number, i: any) => s + (Number(i.CANTIDAD) || 0),
                    0
                ),
            },
            {
                nombre: 'Tintorería',
                valor: datos.tintoreria.reduce(
                    (s: number, i: any) => s + (Number(i.CANTIDAD) || 0),
                    0
                ),
            },
            {
                nombre: 'Estampados',
                valor: datos.estampados.reduce(
                    (s: number, i: any) => s + (Number(i.CANTIDAD) || 0),
                    0
                ),
            },
            {
                nombre: 'Acabado',
                valor: datos.acabado.reduce(
                    (s: number, i: any) => s + (Number(i.CANTIDAD) || 0),
                    0
                ),
            },
        ];

        this.chartComparativa = {
            series: [
                {
                    name: 'Producción (kg)',
                    data: areas.map((a) => a.valor),
                },
            ],
            chart: {
                type: 'bar',
                height: this.isMobile ? 250 : 300,
                fontFamily: 'Inter, sans-serif',
            },
            xaxis: {
                categories: areas.map((a) => a.nombre),
            },
            colors: ['#6366f1'],
            dataLabels: {
                enabled: true,
                formatter: (val: number) => this.formatValue(val, 'decimal'),
            },
            plotOptions: {
                bar: {
                    borderRadius: 8,
                    horizontal: false,
                    distributed: true,
                },
            },
            legend: {
                show: false,
            },
        };
    }

    formatValue(value: number, format?: string): string {
        switch (format) {
            case 'currency':
                return new Intl.NumberFormat('es-MX', {
                    style: 'currency',
                    currency: 'MXN',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(value);
            case 'decimal':
                return new Intl.NumberFormat('es-MX', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(value);
            case 'number':
            default:
                return new Intl.NumberFormat('es-MX').format(value);
        }
    }

    get totalArticulos(): number {
        const produccion = this.areasResumen.find(
            (a) => a.nombre === 'Producción tejido'
        );
        const revisado = this.areasResumen.find(
            (a) => a.nombre === 'Tejido revisado'
        );
        return (
            (produccion?.metrics[2]?.value || 0) +
            (revisado?.metrics[2]?.value || 0)
        );
    }

    get totalPiezas(): number {
        const produccion = this.areasResumen.find(
            (a) => a.nombre === 'Producción tejido'
        );
        const tintoreria = this.areasResumen.find(
            (a) => a.nombre === 'Tintorería'
        );
        return (
            (produccion?.metrics[1]?.value || 0) +
            (tintoreria?.metrics[1]?.value || 0)
        );
    }

    get totalPorRevisar(): number {
        const porRevisar = this.areasResumen.find(
            (a) => a.nombre === 'Por revisar'
        );
        return porRevisar?.metrics[0]?.value || 0;
    }

    get totalSaldos(): number {
        const saldos = this.areasResumen.find((a) => a.nombre === 'Saldos');
        return saldos?.metrics[0]?.value || 0;
    }

    cambiarVista(vista: 'general' | 'detalle'): void {
        this.vistaActual = vista;
        this.cdr.markForCheck();
    }

    ngAfterViewInit(): void {
        this.recentTransactionsDataSource.sort = this.recentTransactionsTableMatSort;
    }

    trackByFn(index: number, item: any): any {
        return item?.id ?? index;
    }

    private _prepareChartData(): void {
        const cConIva = '#0ea5e9';
        const cSinIva = '#f97316';

        this.accountBalanceOptions = {
            chart: {
                animations: { speed: 400, animateGradually: { enabled: false } },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                width: '100%',
                height: 320,
                type: 'area',
                sparkline: { enabled: true },
                toolbar: { show: false },
                defaultLocale: 'es',
                locales: [{
                    name: 'es',
                    options: {
                        months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
                        shortMonths: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
                        days: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
                        shortDays: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
                        toolbar: {
                            exportToSVG: 'Descargar SVG',
                            exportToPNG: 'Descargar PNG',
                            exportToCSV: 'Descargar CSV',
                            selection: 'Selección',
                            selectionZoom: 'Zoom selección',
                            zoomIn: 'Acercar',
                            zoomOut: 'Alejar',
                            pan: 'Mover',
                            reset: 'Reset'
                        }
                    }
                }]
            },
            colors: [cConIva, cSinIva],
            stroke: {
                curve: 'smooth',
                width: 2
            },

            series: this.data?.accountBalance?.series ?? [],

            fill: {
                type: 'gradient',
                colors: [cConIva, cSinIva],
                gradient: {
                    shadeIntensity: 0.2,
                    opacityFrom: 0.35,
                    opacityTo: 0.05,
                    stops: [0, 90, 100]
                },
            },

            xaxis: { type: 'datetime' },

            legend: {
                show: true,
                position: 'top',
                horizontalAlign: 'left',
                markers: {
                    size: 8,
                    strokeWidth: 0,
                    fillColors: [cConIva, cSinIva]
                },
            },

            tooltip: {
                shared: true,
                followCursor: true,
                theme: 'dark',
                x: { format: 'dd MMM yyyy' },
                y: {
                    formatter: (value: number) =>
                        new Intl.NumberFormat('es-MX', {
                            style: 'currency',
                            currency: 'MXN',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        }).format(value),
                },
            },
        };
    }


    private procesarFacturadoParaGrafica(detalle: any[]): void {
        const getFecha = (x: any) => x.fecha || x.FECHA || x.fechaFactura || x.fecha_timbrado;

        const map = new Map<number, { conIva: number; sinIva: number }>();

        for (const item of detalle) {
            const raw = getFecha(item);
            if (!raw) continue;

            const d = new Date(String(raw).replace(' ', 'T'));
            if (isNaN(d.getTime())) continue;

            const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

            const importe = Number(item.importe) || 0;
            const total = Number(item.total) || 0;

            const prev = map.get(dayKey) ?? { conIva: 0, sinIva: 0 };

            prev.sinIva += importe;
            prev.conIva += total;

            map.set(dayKey, prev);
        }

        const days = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);

        this.data.accountBalance = {
            growRate: 0,
            ami: days.length ? days.reduce((s, [, v]) => s + v.conIva, 0) / days.length : 0,
            series: [
                { name: 'Con IVA', data: days.map(([ts, v]) => [ts, v.conIva]) },
                { name: 'Sin IVA', data: days.map(([ts, v]) => [ts, v.sinIva]) },
            ],
        };
    }

    private setCardsFacturadoPorFiltro(detalle: any[], from: Date, to: Date): void {
        const r = this.sumarPeriodo(detalle, from, to);
        this.data.previousStatement = {
            date: to.toISOString(),
            limit: r.importe,
            spent: r.facturas,
            minimum: r.impuestos
        };

        this.data.currentStatement = {
            date: to.toISOString(),
            limit: r.total,
            spent: r.facturas,
            minimum: r.impuestos
        };
    }

    private getFechaFactura(item: any): Date | null {
        const raw = item.fecha || item.FECHA || item.fechaFactura || item.fecha_timbrado;
        if (!raw) return null;

        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }

    private sumarPeriodo(detalle: any[], from: Date, to: Date) {
        let total = 0;
        let importe = 0;
        let impuestos = 0;
        let facturas = 0;

        for (const item of detalle) {
            const f = this.getFechaFactura(item);
            if (!f) continue;

            if (f >= from && f < to) {
                total += this.toNum(item.total);
                importe += this.toNum(item.importe);
                impuestos += this.toNum(item.impuestos);
                facturas += 1;
            }
        }

        return { total, importe, impuestos, facturas };
    }


    private setCardsFacturado(detalle: any[]): void {
        const now = new Date();

        const startCur = new Date(now.getFullYear(), now.getMonth(), 1);
        const startNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endPrev = startCur;

        const cur = this.sumarPeriodo(detalle, startCur, startNext);
        const prev = this.sumarPeriodo(detalle, startPrev, endPrev);

        this.data.currentStatement = {
            date: startNext.toISOString(),
            limit: cur.total,
            spent: cur.importe,
            minimum: cur.impuestos
        };

        this.data.previousStatement = {
            date: endPrev.toISOString(),
            limit: prev.total,
            spent: prev.importe,
            minimum: prev.impuestos
        };
    }



    private toNum(v: any): number {
        if (v == null) return 0;
        if (typeof v === 'number') return v;
        const s = String(v).replace(/,/g, '').trim();
        const n = Number(s);
        return isNaN(n) ? 0 : n;
    }

    calcularImporteTotal(): number {

        if (!this.datosAgrupados || !Array.isArray(this.datosAgrupados)) {
            return 0;
        }

        const total = this.datosAgrupados.reduce((sum, grupo, index) => {
            const importe = Number(grupo.importeTotal) || 0;
            return sum + importe;
        }, 0);


        return total;
    }

    importeTotalSinIva = 0;
    datosFacturadoOriginal: any = null;

    impuestosTotal = 0;
    totalConIva = 0;
    totalFacturas = 0;


    private recalcularImporteTotal(): void {
        this.importeTotalSinIva = (this.datosAgrupados ?? [])
            .reduce((sum, g) => sum + (Number(g.importeTotal) || 0), 0);
    }


    private onFacturadoLoaded(resp: any): void {
        const payload = resp?.data ?? resp;
        const tot = payload?.totales ?? {};
        const detalle: FacturaDetalle[] = payload?.detalle ?? [];

        this.importeTotalSinIva = Number(tot.importe) || 0;
        this.impuestosTotal = Number(tot.impuestos) || 0;
        this.totalConIva = Number(tot.total) || 0;
        this.totalFacturas = Number(tot.facturas) || 0;

        this.cantidadTotal = Number(tot.cant) || 0;
        this.cantidadesPorUnidad = {};

        for (const item of detalle) {
            const unidad = (item.um || 'N/A').trim();
            const cantidad = Number(item.cant) || 0;

            if (!this.cantidadesPorUnidad[unidad]) {
                this.cantidadesPorUnidad[unidad] = 0;
            }
            this.cantidadesPorUnidad[unidad] += cantidad;
        }

        let conIva = 0;
        let sinIva = 0;

        for (const x of detalle) {
            const imp = Number((x as any).impuestos) || 0;
            if (imp > 0) conIva++;
            else sinIva++;
        }

        this.facturasConIva = conIva;
        this.facturasSinIva = sinIva;

        if (detalle.length) {
            const filtros = this.sharedData.obtenerFiltros();
            const busqueda = (filtros.busqueda ?? '').toLowerCase().trim();

            const detalleFiltrado = !busqueda
                ? detalle
                : detalle.filter(x =>
                    (x.cliente ?? '').toLowerCase().includes(busqueda) ||
                    (x.factura ?? '').toLowerCase().includes(busqueda)
                );

            this.agruparPorCliente(detalleFiltrado);
        } else {
            this.datosAgrupados = [];
        }
    }



    private agruparPorCliente(detalle: FacturaDetalle[]): void {
        const agrupado = new Map<string, ClienteAgrupado>();

        for (const item of detalle) {
            const cliente = (item.cliente || 'Sin cliente').trim?.() ?? 'Sin cliente';

            if (!agrupado.has(cliente)) {
                agrupado.set(cliente, {
                    cliente,
                    facturas: [],
                    cantidadesPorUnidad: {},
                    importeTotal: 0,
                    impuestosTotal: 0,
                    totalFacturado: 0,
                    expandido: false,
                });
            }

            const grupo = agrupado.get(cliente)!;
            grupo.facturas.push(item);

            const unidad = item.um || 'N/A';
            grupo.cantidadesPorUnidad[unidad] =
                (grupo.cantidadesPorUnidad[unidad] || 0) + (Number(item.cant) || 0);

            grupo.importeTotal += Number(item.importe) || 0;
            grupo.impuestosTotal += Number(item.impuestos) || 0;
            grupo.totalFacturado += Number(item.total) || 0;
        }

        this.datosAgrupados = Array.from(agrupado.values()).sort(
            (a, b) => b.totalFacturado - a.totalFacturado
        );
    }

    get detallesTintoreria() {
        return this.areasResumen.find(a => a.nombre === 'Tintorería')?.detalles || [];
    }

    get detallesEstampados() {
        return this.areasResumen.find(a => a.nombre === 'Estampados')?.detalles || [];
    }

    get detallesAcabado() {
        return this.areasResumen.find(a => a.nombre === 'Acabado real')?.detalles || [];
    }





    // Agrégala después de crearGraficaComparativa
private crearGraficaDistribucionProcesos(datos: any): void {
    const procesos = [
        {
            nombre: 'Tintorería',
            cantidad: datos.tintoreria.reduce(
                (s: number, i: any) => s + (Number(i.CANTIDAD) || 0),
                0
            ),
            piezas: datos.tintoreria.reduce(
                (s: number, i: any) => s + (Number(i.PIEZAS) || 0),
                0
            ),
            color: '#ec4899'
        },
        {
            nombre: 'Estampados',
            cantidad: datos.estampados.reduce(
                (s: number, i: any) => s + (Number(i.CANTIDAD) || 0),
                0
            ),
            piezas: datos.estampados.reduce(
                (s: number, i: any) => s + (Number(i.PIEZAS) || 0),
                0
            ),
            color: '#f59e0b'
        },
        {
            nombre: 'Acabado Real',
            cantidad: datos.acabado.reduce(
                (s: number, i: any) => s + (Number(i.CANTIDAD) || 0),
                0
            ),
            piezas: datos.acabado.reduce(
                (s: number, i: any) => s + (Number(i.PIEZAS) || 0),
                0
            ),
            color: '#06b6d4'
        }
    ];

    this.chartDistribucionProcesos = {
        series: [
            {
                name: 'Cantidad (kg)',
                data: procesos.map(p => p.cantidad)
            },
            {
                name: 'Piezas',
                data: procesos.map(p => p.piezas)
            }
        ],
        chart: {
            type: 'bar',
            height: 320,
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '60%',
                borderRadius: 8,
            }
        },
        colors: ['#8b5cf6', '#3b82f6'],
        dataLabels: {
            enabled: false
        },
        stroke: {
            show: true,
            width: 2,
            colors: ['transparent']
        },
        xaxis: {
            categories: procesos.map(p => p.nombre),
        },
        yaxis: [
            {
                title: {
                    text: 'Cantidad (kg)'
                },
                labels: {
                    formatter: (val: number) => this.formatValue(val, 'decimal')
                }
            },
            {
                opposite: true,
                title: {
                    text: 'Piezas'
                },
                labels: {
                    formatter: (val: number) => this.formatValue(val, 'number')
                }
            }
        ],
        fill: {
            opacity: 1
        },
        tooltip: {
            y: {
                formatter: (val: number, opts: any) => {
                    if (opts.seriesIndex === 0) {
                        return this.formatValue(val, 'decimal') + ' kg';
                    }
                    return this.formatValue(val, 'number') + ' piezas';
                }
            }
        },
        legend: {
            show: true,
            position: 'top',
            horizontalAlign: 'left'
        }
    };
}

}
