import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { ApexOptions } from 'apexcharts';
// import { ResumenWebsocketService } from 'app/core/services/websockets/resumenwebsocket.service';
import { FinanceService } from 'app/modules/admin/dashboards/finance/finance.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { filter, map, Subject, takeUntil } from 'rxjs';
import { SharedDataService } from '../../list/shared-data.service';
import {
  PorRevisarTejido,
  ProduccionTejido,
  ReportProdService,
  RevisadoTejido,
  SaldosTejido,
} from '../../reportprod.service';
import { AreaResumen } from './types/areas.types';
import { ClienteAgrupado, FacturaDetalle } from './types/facturacion.types';

@Component({
  selector: 'inicio-view',
  templateUrl: './inicioview.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTabsModule,
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
  ivaTotal = 0;
  totalConIva = 0;
  isMobile = false;
  totalFacturas = 0;
  cantidadTotal = 0;
  facturasConIva = 0;
  facturasSinIva = 0;
  impuestosTotal = 0;
  terminoBusqueda = '';
  importeTotalSinIva = 0;
  loadingFacturacion = true;
  loadingSaldosTejido = true;
  loadingRevisadoTejido = true;
  loadingEmbarquesTejido = true;
  loadingPorRevisarTejido = true;
  loadingDetallesProcesos = true;
  loadingProduccionTejido = true;
  loadingGraficaFacturacion = true;
  loadingDistribucionProcesos = true;
  datosEmbarquesCompletos: any[] = [];
  accountBalanceOptions!: ApexOptions;
  private destroy$ = new Subject<void>();
  datosAgrupados: ClienteAgrupado[] = [];
  private wsRefresh$ = new Subject<any>();
  datosSaldosCompletos: SaldosTejido[] = [];
  filtros$ = this.sharedData.filtrosGlobales$;
  chartSaldosTejido: ApexOptions | null = null;
  datosRevisadoCompletos: RevisadoTejido[] = [];
  chartRevisadoTejido: ApexOptions | null = null;
  tipoEmbarqueSeleccionado: string | null = null;
  vistaActual: 'general' | 'detalle' = 'general';
  chartEmbarquesTejido: ApexOptions | null = null;
  articuloSeleccionadoSaldos: string | null = null;
  chartProduccionTejido: ApexOptions | null = null;
  chartPorRevisarTejido: ApexOptions | null = null;
  @ViewChild('chartEmbarques') chartEmbarques: any;
  datosProduccionCompletos: ProduccionTejido[] = [];
  datosPorRevisarCompletos: PorRevisarTejido[] = [];
  articuloSeleccionadoRevisado: string | null = null;
  cantidadesPorUnidad: { [key: string]: number } = {};
  chartDistribucionProcesos: ApexOptions | null = null;
  articuloSeleccionadoProduccion: string | null = null;
  articuloSeleccionadoPorRevisar: string | null = null;
  tipoEmbarqueSeleccionadoGrafica: string | null = null;
  @ViewChild(MatSort) recentTransactionsTableMatSort!: MatSort;
  private readonly CONVERSION_RATES = {
    LB_TO_KG: 0.453592,
    KG_TO_LB: 2.20462,
    OZ_TO_G: 28.3495,
    G_TO_OZ: 0.035274,
  };

  data: any = {
    previousStatement: { date: '', limit: 0, spent: 0, minimum: 0 },
    currentStatement: { date: '', limit: 0, spent: 0, minimum: 0 },
    accountBalance: { growRate: 0, ami: 0, series: [] },
    recentTransactions: [],
  };

  rangoTexto$ = this.filtros$.pipe(
    map((f) => {
      const opts: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      };
      const hoy = new Date();

      switch (f.rangoFecha) {
        case 'todos':
          return 'Todos los registros';
        case 'hoy':
          return `Hoy - ${hoy.toLocaleDateString('es-MX', opts)}`;
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
          return f.fechaInicio
            ? `Fecha: ${f.fechaInicio.toLocaleDateString('es-MX', opts)}`
            : 'Seleccionar fecha';
        case 'periodo':
          return f.fechaInicio && f.fechaFin
            ? `${f.fechaInicio.toLocaleDateString('es-MX', opts)} - ${f.fechaFin.toLocaleDateString('es-MX', opts)}`
            : 'Periodo de fechas';
        default:
          return 'Mes actual';
      }
    }),
  );

  areasResumen: AreaResumen[] = [
    {
      nombre: 'Facturación',
      icon: 'receipt_long',
      color: '#10b981',
      metrics: [
        { label: 'Peso total', value: 0, format: 'number' },
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
      color: '#10b981',
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
      nombre: 'Tejido',
      icon: 'category',
      color: '#6366f1',
      metrics: [
        { label: 'Cantidad total', value: 0, format: 'decimal' },
        { label: 'Piezas', value: 0, format: 'number' },
        { label: 'Departamentos', value: 0, format: 'number' },
      ],
      loading: true,
      detalles: [],
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

  constructor(
    private reportService: ReportProdService,
    private sharedData: SharedDataService,
    private cdr: ChangeDetectorRef,
    private breakpointObserver: BreakpointObserver,
    private _financeService: FinanceService,
    // private resumenwebsocket: ResumenWebsocketService,
  ) {}

  ngOnInit(): void {
    // this.resumenwebsocket.listenReportesActualizados((event) => {
    //   this.wsRefresh$.next(event);
    // });

    // this.wsRefresh$
    //   .pipe(
    //     takeUntil(this.destroy$),
    //     // 👇 si llegan varios en corto, solo refresca 1 vez
    //     debounceTime(500),
    //   )
    //   .subscribe((event) => {
    //     console.log('🔔 Reportes actualizados:', event);
    //     this.cargarTodasLasAreas({ silent: true });
    //     // this.mostrarNotificacion(event.mensaje);
    //   });

    this.sharedData.filtrosGlobales$.pipe(takeUntil(this.destroy$)).subscribe((filtros) => {
      this.terminoBusqueda = (filtros.busqueda || '').toLowerCase();
      this.cdr.markForCheck();
    });

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
        filter((recargar) => recargar === true),
      )
      .subscribe(() => {
        this.cargarTodasLasAreas();
        this.sharedData.confirmarRecargaConsumida();
      });
    this.sharedData.datosFacturado$.pipe(takeUntil(this.destroy$)).subscribe((facturado) => {
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
    // this.resumenwebsocket.stopListening();
  }

  private cargarTodasLasAreas(opts?: { silent?: boolean }): void {
    const silent = opts?.silent ?? false;
    const filtros = this.sharedData.obtenerFiltros();
    const fechaInicio =
      filtros.fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fechaFin = filtros.fechaFin || new Date();
    if (!silent) {
      this.loadingFacturacion = true;
      this.loadingGraficaFacturacion = true;
      this.loadingDistribucionProcesos = true;
      this.loadingDetallesProcesos = true;
      this.loadingProduccionTejido = true;
      this.loadingRevisadoTejido = true;
      this.loadingPorRevisarTejido = true;
      this.loadingSaldosTejido = true;
      this.loadingEmbarquesTejido = true;
      this.areasResumen.forEach((a) => (a.loading = true));
      this.cdr.markForCheck();
    }

    this.reportService
      .getAllReports(fechaInicio, fechaFin, true)
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
          this.crearGraficaDistribucionProcesos(datos);
          if (!silent) {
            this.loadingFacturacion = false;
            this.loadingGraficaFacturacion = false;
            this.loadingDistribucionProcesos = false;
            this.loadingDetallesProcesos = false;
            this.loadingProduccionTejido = false;
            this.loadingRevisadoTejido = false;
            this.loadingPorRevisarTejido = false;
            this.loadingSaldosTejido = false;
            this.loadingEmbarquesTejido = false;
            this.areasResumen.forEach((a) => (a.loading = false));
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando datos:', err);
          if (!silent) {
            this.loadingFacturacion = false;
            this.loadingGraficaFacturacion = false;
            this.loadingDistribucionProcesos = false;
            this.loadingDetallesProcesos = false;
            this.loadingProduccionTejido = false;
            this.loadingRevisadoTejido = false;
            this.loadingPorRevisarTejido = false;
            this.loadingSaldosTejido = false;
            this.loadingEmbarquesTejido = false;
            this.areasResumen.forEach((a) => (a.loading = false));
            this.cdr.markForCheck();
          }
        },
      });
  }

  seleccionarArticulo(
    tipo: 'produccion' | 'revisado' | 'porRevisar' | 'saldos',
    articulo: string,
  ): void {
    const map = {
      produccion: {
        prop: 'articuloSeleccionadoProduccion',
        area: 'Producción tejido',
        datos: this.datosProduccionCompletos,
        field: 'TOTAL_TJ',
      },
      revisado: {
        prop: 'articuloSeleccionadoRevisado',
        area: 'Tejido revisado',
        datos: this.datosRevisadoCompletos,
        field: 'TOTAL_RV',
      },
      porRevisar: {
        prop: 'articuloSeleccionadoPorRevisar',
        area: 'Por revisar',
        datos: this.datosPorRevisarCompletos,
        field: 'TOTAL_POR_REVISAR',
      },
      saldos: {
        prop: 'articuloSeleccionadoSaldos',
        area: 'Saldos',
        datos: this.datosSaldosCompletos,
        field: 'TOTAL_SALDO',
      },
    };

    const config = map[tipo];
    this[config.prop] = this[config.prop] === articulo ? null : articulo;
    this.actualizarMetricas(config.area, config.datos, this[config.prop], config.field);
  }

  private procesarProduccion(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    this.datosProduccionCompletos = data;
    const pesoTotal = data.reduce((sum, item) => sum + (Number(item.TOTAL_TJ) || 0), 0);
    const piezasTotal = data.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const articulos = data.length;
    const area = this.areasResumen.find((a) => a.nombre === 'Producción tejido');
    if (area) {
      area.metrics[0].value = pesoTotal;
      area.metrics[1].value = piezasTotal;
      area.metrics[2].value = articulos;
    }
    this.crearGraficaProduccionTejido(data);
  }

  private procesarAcabado(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    const cantidadTotal = data.reduce((sum, item) => sum + (Number(item.CANTIDAD) || 0), 0);
    const piezasTotal = data.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const procesos = data.length;
    const area = this.areasResumen.find((a) => a.nombre === 'Acabado real');
    if (area) {
      area.metrics[0].value = cantidadTotal;
      area.metrics[1].value = piezasTotal;
      area.metrics[2].value = procesos;
      area.detalles = data.map((item) => ({
        departamento: item.departamento || 'N/A',
        proceso: item.proceso || 'N/A',
        cantidad: Number(item.CANTIDAD) || 0,
        piezas: Number(item.PIEZAS) || 0,
      }));
    }
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
        return new Intl.NumberFormat('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value);
    }
  }

  cambiarVista(vista: 'general' | 'detalle'): void {
    this.vistaActual = vista;
    this.cdr.markForCheck();
  }

  trackByFn(index: number, item: any): any {
    return item?.id ?? index;
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

  private toNum(v: any): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/,/g, '').trim();
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  }

  get detallesAcabado() {
    return this.areasResumen.find((a) => a.nombre === 'Acabado real')?.detalles || [];
  }

  private crearGraficaDistribucionProcesos(datos: any): void {
    const procesos = [
      {
        nombre: 'Tejido',
        cantidad: datos.tejido.reduce((s: number, i: any) => s + (Number(i.CANTIDAD) || 0), 0),
        piezas: datos.tejido.reduce((s: number, i: any) => s + (Number(i.PIEZAS) || 0), 0),
        color: '#3b82f6',
      },
      {
        nombre: 'Tintorería',
        cantidad: datos.tintoreria.reduce((s: number, i: any) => s + (Number(i.CANTIDAD) || 0), 0),
        piezas: datos.tintoreria.reduce((s: number, i: any) => s + (Number(i.PIEZAS) || 0), 0),
        color: '#ec4899',
      },
      {
        nombre: 'Estampados',
        cantidad: datos.estampados.reduce((s: number, i: any) => s + (Number(i.CANTIDAD) || 0), 0),
        piezas: datos.estampados.reduce((s: number, i: any) => s + (Number(i.PIEZAS) || 0), 0),
        color: '#f59e0b',
      },
      {
        nombre: 'Acabado Real',
        cantidad: datos.acabado.reduce((s: number, i: any) => s + (Number(i.CANTIDAD) || 0), 0),
        piezas: datos.acabado.reduce((s: number, i: any) => s + (Number(i.PIEZAS) || 0), 0),
        color: '#06b6d4',
      },
    ];

    const textColor = '#c4c4c4';
    const mutedText = '#9ca3af';

    this.chartDistribucionProcesos = {
      series: [
        { name: 'Cantidad (kg)', data: procesos.map((p) => p.cantidad) },
        { name: 'Piezas', data: procesos.map((p) => p.piezas) },
      ],
      chart: {
        type: 'bar',
        height: this.isMobile ? 320 : 550,
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
        foreColor: textColor,
      },
      theme: { mode: 'dark' },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: this.isMobile ? '50%' : '60%',
          borderRadius: 4,
        },
      },

      colors: ['#10b981', '#3b82f6'],
      dataLabels: { enabled: false },

      stroke: { show: true, width: 2, colors: ['transparent'] },

      xaxis: {
        categories: procesos.map((p) => p.nombre),
        labels: {
          style: {
            fontSize: this.isMobile ? '10px' : '12px',
            colors: Array(procesos.length).fill(mutedText),
          },
          rotate: this.isMobile ? -45 : 0,
          rotateAlways: this.isMobile,
        },
        axisBorder: { show: true, color: 'rgba(255,255,255,0.15)' },
        axisTicks: { show: true, color: 'rgba(255,255,255,0.15)' },
      },

      yaxis: [
        {
          title: {
            text: this.isMobile ? '' : 'Cantidad (kg)',
            style: { fontSize: '11px', color: textColor },
          },
          labels: {
            style: { fontSize: this.isMobile ? '9px' : '11px', colors: [mutedText] },
            formatter: (val: number) =>
              this.isMobile ? this.formatValue(val, 'number') : this.formatValue(val, 'decimal'),
          },
        },
        {
          opposite: true,
          title: {
            text: this.isMobile ? '' : 'Piezas',
            style: { fontSize: '11px', color: textColor },
          },
          labels: {
            style: { fontSize: this.isMobile ? '9px' : '11px', colors: [mutedText] },
            formatter: (val: number) => this.formatValue(val, 'number'),
          },
        },
      ],

      fill: { opacity: 1 },

      tooltip: {
        theme: 'dark',
        y: {
          formatter: (val: number, opts: any) => {
            if (opts.seriesIndex === 0) return this.formatValue(val, 'decimal') + ' kg';
            return this.formatValue(val, 'number') + ' piezas';
          },
        },
      },

      legend: {
        show: true,
        position: this.isMobile ? 'bottom' : 'top',
        horizontalAlign: this.isMobile ? 'center' : 'left',
        fontSize: this.isMobile ? '10px' : '12px',
        labels: {
          colors: textColor,
          useSeriesColors: false,
        },
        markers: { size: this.isMobile ? 5 : 7 },
        itemMargin: {
          horizontal: this.isMobile ? 6 : 10,
          vertical: this.isMobile ? 4 : 6,
        },
      },

      grid: {
        borderColor: 'rgba(255,255,255,0.08)',
        padding: {
          left: this.isMobile ? 5 : 10,
          right: this.isMobile ? 5 : 10,
          bottom: this.isMobile ? 10 : 0,
        },
      },
    };
  }

  private actualizarMetricas(
    areaName: string,
    datos: any[],
    articuloSeleccionado: string | null,
    pesoField: string,
  ): void {
    const area = this.areasResumen.find((a) => a.nombre === areaName);
    if (!area) return;

    const datosFiltrados = articuloSeleccionado
      ? datos.filter((d) => d.ARTICULO === articuloSeleccionado)
      : datos;

    const peso = datosFiltrados.reduce((sum, item) => sum + (Number(item[pesoField]) || 0), 0);
    const piezas = datosFiltrados.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);

    area.metrics[0].value = peso;
    area.metrics[1].value = piezas;
    area.metrics[2].value = datosFiltrados.length;
    this.cdr.markForCheck();
  }

  private crearGraficaDonut(
    data: any[],
    chartProperty:
      | 'chartProduccionTejido'
      | 'chartRevisadoTejido'
      | 'chartPorRevisarTejido'
      | 'chartSaldosTejido',
    valueField: string,
    onClickCallback: (articulo: string) => void,
  ): void {
    if (!data?.length) {
      this[chartProperty] = null;
      return;
    }

    const COLORES = [
      '#10b981',
      '#3b82f6',
      '#f59e0b',
      '#ec4899',
      '#06b6d4',
      '#6366f1',
      '#14b8a6',
      '#f97316',
      '#84cc16',
      '#a855f7',
    ];
    const topN = 8;
    const datosOrdenados = [...data].sort(
      (a, b) => parseFloat(b[valueField]) - parseFloat(a[valueField]),
    );
    const topArticulos = datosOrdenados.slice(0, topN);
    const otrosArticulos = datosOrdenados.slice(topN);

    const series = topArticulos.map((item) => parseFloat(item[valueField]));
    const labels = topArticulos.map((item) => item.ARTICULO);

    if (otrosArticulos.length > 0) {
      const otrosTotal = otrosArticulos.reduce(
        (sum, item) => sum + parseFloat(item[valueField]),
        0,
      );
      series.push(otrosTotal);
      labels.push(`Otros (${otrosArticulos.length})`);
    }

    this[chartProperty] = {
      series,
      labels,
      chart: {
        type: 'donut',
        height: 176,
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
        events: {
          dataPointSelection: (event: any, chartContext: any, config: any) => {
            const articulo = labels[config.dataPointIndex];
            if (!articulo.startsWith('Otros')) onClickCallback(articulo);
          },
        },
      },
      colors: [...COLORES, '#9ca3af'],
      plotOptions: { pie: { donut: { size: '70%' } } },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['#fff'] },
      legend: { show: false },
      tooltip: { y: { formatter: (val: number) => `${val.toFixed(2)} kg` } },
    };
  }

  private crearGraficaProduccionTejido(data: any[]): void {
    this.crearGraficaDonut(data, 'chartProduccionTejido', 'TOTAL_TJ', (articulo) =>
      this.seleccionarArticulo('produccion', articulo),
    );
  }

  private crearGraficaRevisadoTejido(data: any[]): void {
    this.crearGraficaDonut(data, 'chartRevisadoTejido', 'TOTAL_RV', (articulo) =>
      this.seleccionarArticulo('revisado', articulo),
    );
  }

  private crearGraficaPorRevisarTejido(data: any[]): void {
    this.crearGraficaDonut(data, 'chartPorRevisarTejido', 'TOTAL_POR_REVISAR', (articulo) =>
      this.seleccionarArticulo('porRevisar', articulo),
    );
  }

  private crearGraficaSaldosTejido(data: any[]): void {
    this.crearGraficaDonut(data, 'chartSaldosTejido', 'TOTAL_SALDO', (articulo) =>
      this.seleccionarArticulo('saldos', articulo),
    );
  }

  private norm(v: any): string {
    return String(v ?? '')
      .trim()
      .toUpperCase();
  }

  /*
   * ESTAMPADO
   */
  private procesarEstampados(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    const cantidadTotal = data.reduce((sum, item) => sum + (Number(item.CANTIDAD) || 0), 0);
    const piezasTotal = data.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const procesos = data.length;
    const area = this.areasResumen.find((a) => a.nombre === 'Estampados');
    if (area) {
      area.metrics[0].value = cantidadTotal;
      area.metrics[1].value = piezasTotal;
      area.metrics[2].value = procesos;
      area.detalles = data.map((item) => ({
        departamento: item.departamento || 'N/A',
        proceso: item.proceso || 'N/A',
        cantidad: Number(item.CANTIDAD) || 0,
        piezas: Number(item.PIEZAS) || 0,
      }));
    }
  }
  get detallesEstampados() {
    return this.areasResumen.find((a) => a.nombre === 'Estampados')?.detalles || [];
  }

  /**
   * REVISADO
   */
  private procesarRevisado(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    this.datosRevisadoCompletos = data;
    const pesoTotal = data.reduce((sum, item) => sum + (Number(item.TOTAL_RV) || 0), 0);
    const piezasTotal = data.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const articulos = data.length;
    const area = this.areasResumen.find((a) => a.nombre === 'Tejido revisado');
    if (area) {
      area.metrics[0].value = pesoTotal;
      area.metrics[1].value = piezasTotal;
      area.metrics[2].value = articulos;
    }
    this.crearGraficaRevisadoTejido(data);
  }

  calcularTotalPesoRevisado(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Tejido revisado');
    return area?.metrics[0]?.value || 0;
  }

  calcularTotalPiezasRevisado(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Tejido revisado');
    return area?.metrics[1]?.value || 0;
  }

  contarArticulosRevisado(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Tejido revisado');
    return area?.metrics[2]?.value || 0;
  }

  /*
   * POR REVISAR
   */
  private procesarPorRevisar(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    this.datosPorRevisarCompletos = data;
    const pesoTotal = data.reduce((sum, item) => sum + (Number(item.TOTAL_POR_REVISAR) || 0), 0);
    const piezasTotal = data.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const articulos = data.length;
    const area = this.areasResumen.find((a) => a.nombre === 'Por revisar');
    if (area) {
      area.metrics[0].value = pesoTotal;
      area.metrics[1].value = piezasTotal;
      area.metrics[2].value = articulos;
    }
    this.crearGraficaPorRevisarTejido(data);
  }

  calcularTotalPesoPorRevisar(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Por revisar');
    return area?.metrics[0]?.value || 0;
  }

  calcularTotalPiezasPorRevisar(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Por revisar');
    return area?.metrics[1]?.value || 0;
  }

  calcularTotalArticulosPorRevisar(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Por revisar');
    return area?.metrics[2]?.value || 0;
  }

  /**
   * TINTORERIA
   */
  private procesarTintoreria(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    const cantidadTotal = data.reduce((sum, item) => sum + (Number(item.CANTIDAD) || 0), 0);
    const piezasTotal = data.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const procesos = data.length;
    const area = this.areasResumen.find((a) => a.nombre === 'Tintorería');
    if (area) {
      area.metrics[0].value = cantidadTotal;
      area.metrics[1].value = piezasTotal;
      area.metrics[2].value = procesos;

      area.detalles = data.map((item) => ({
        departamento: item.departamento || 'N/A',
        proceso: item.proceso || 'N/A',
        cantidad: Number(item.CANTIDAD) || 0,
        piezas: Number(item.PIEZAS) || 0,
      }));
    }
  }

  get detallesTintoreria() {
    return this.areasResumen.find((a) => a.nombre === 'Tintorería')?.detalles || [];
  }

  /**
   * TEJIDO
   */

  private procesarTejido(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    const cantidadTotal = data.reduce((sum, item) => sum + (Number(item.CANTIDAD) || 0), 0);
    const piezasTotal = data.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const departamentos = new Set(data.map((item) => item.departamento)).size;
    const area = this.areasResumen.find((a) => a.nombre === 'Tejido');
    if (area) {
      area.metrics[0].value = cantidadTotal;
      area.metrics[1].value = piezasTotal;
      area.metrics[2].value = departamentos;
      area.detalles = data.map((item) => ({
        departamento: item.departamento || 'N/A',
        proceso: item.proceso || 'N/A',
        cantidad: Number(item.CANTIDAD) || 0,
        piezas: Number(item.PIEZAS) || 0,
      }));
    }
  }

  get detallesTejido() {
    return this.areasResumen.find((a) => a.nombre === 'Tejido')?.detalles || [];
  }

  getMetric(area: string, index: number): number {
    return this.areasResumen.find((a) => a.nombre === area)?.metrics[index]?.value || 0;
  }

  /**
   * FACTURADO
   */

  private procesarFacturado1(resp: any): void {
    const payload = resp?.data ?? resp;
    if (!payload) return;

    const tot = payload.totales ?? {};
    const detalle: FacturaDetalle[] = payload.detalle ?? [];

    const subtotal = Number(tot.importe) || 0;
    const impuestos = Number(tot.impuestos) || 0;
    const cant = Number(tot.cant) || 0;
    const total = Number(tot.total) || 0;

    const cantidadTotal =
      Number(tot.cant) || detalle.reduce((sum, x) => sum + (Number(x.cant) || 0), 0);

    //  Guarda total con IVA para el card "Total"
    this.totalConIva = total;

    const area = this.areasResumen.find((a) => a.nombre === 'Facturación');
    if (area) {
      area.metrics[0].value = subtotal; // Subtotal
      area.metrics[1].value = impuestos; // IVA
      area.metrics[2].value = cantidadTotal; // Cantidad total
      area.metrics[2].value = cant; // Cantidad total
    }
  }

  private procesarFacturado(resp: any): void {
    const payload = resp?.data ?? resp;
    if (!payload) return;
    const tot = payload.totales ?? {};
    const detalle: FacturaDetalle[] = payload.detalle ?? [];
    const cant = Number(tot.cant) || 0;
    const total = Number(tot.total) || 0;

    const area = this.areasResumen.find((a) => a.nombre === 'Facturación');
    if (!area || area.metrics.length < 2) return;
    area.metrics[0].value = cant;
    area.metrics[1].value = total;
  }

  get cantidadesPorUnidadArray() {
    const unidades = Object.entries(this.cantidadesPorUnidad || {});
    let totalKG = 0;

    // Convertir todas las unidades a KG y sumarlas
    unidades.forEach(([um, cant]) => {
      const umUpper = um.toUpperCase();

      if (umUpper === 'KG' || umUpper === 'KGS') {
        totalKG += cant;
      } else if (umUpper === 'LB' || umUpper === 'LBS') {
        totalKG += cant * 0.453592; // Convertir LB a KG
      } else if (umUpper === 'OZ') {
        totalKG += cant * 0.0283495; // Convertir OZ a KG
      } else if (umUpper === 'G' || umUpper === 'GR') {
        totalKG += cant * 0.001; // Convertir G a KG
      }
      // Si hay otras unidades que no son de peso, las ignoramos para el total de KG
    });

    // Retornar solo el total en KG
    return [{ um: 'KG', cant: totalKG }];
  }

  get totalFacturacion(): number {
    return this.totalConIva || 0;
  }

  get cantidadFacturada(): number {
    return this.getMetric('Facturación', 2);
  }

  private getFechaFactura(item: any): Date | null {
    const raw = item.fecha || item.FECHA || item.fechaFactura || item.fecha_timbrado;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
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
        locales: [
          {
            name: 'es',
            options: {
              months: [
                'enero',
                'febrero',
                'marzo',
                'abril',
                'mayo',
                'junio',
                'julio',
                'agosto',
                'septiembre',
                'octubre',
                'noviembre',
                'diciembre',
              ],
              shortMonths: [
                'ene',
                'feb',
                'mar',
                'abr',
                'may',
                'jun',
                'jul',
                'ago',
                'sep',
                'oct',
                'nov',
                'dic',
              ],
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
                reset: 'Reset',
              },
            },
          },
        ],
      },
      colors: [cConIva, cSinIva],
      stroke: {
        curve: 'smooth',
        width: 2,
      },

      series: this.data?.accountBalance?.series ?? [],

      fill: {
        type: 'gradient',
        colors: [cConIva, cSinIva],
        gradient: {
          shadeIntensity: 0.2,
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 90, 100],
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
          fillColors: [cConIva, cSinIva],
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
    const getFactura = (x: any) => x.factura || x.FACTURA || x.cve_doc || x.CVE_DOC;
    const porFactura = new Map<string, { ts: number; iva: number; subtotal: number }>();
    for (const item of detalle) {
      const folio = String(getFactura(item) ?? '').trim();
      if (!folio) continue;
      const raw = getFecha(item);
      if (!raw) continue;
      const d = new Date(String(raw).replace(' ', 'T'));
      if (isNaN(d.getTime())) continue;
      const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const subtotal = this.toNum(item.importe);
      const iva = this.toNum(item.impuestos);
      if (!porFactura.has(folio)) porFactura.set(folio, { ts: dayKey, iva, subtotal });
    }

    const porDia = new Map<number, { iva: number; subtotal: number }>();
    for (const v of porFactura.values()) {
      const prev = porDia.get(v.ts) ?? { iva: 0, subtotal: 0 };
      prev.iva += v.iva;
      prev.subtotal += v.subtotal;
      porDia.set(v.ts, prev);
    }

    const days = Array.from(porDia.entries()).sort((a, b) => a[0] - b[0]);
    this.data.accountBalance = {
      growRate: 0,
      ami: days.length ? days.reduce((s, [, v]) => s + v.iva, 0) / days.length : 0,
      series: [
        { name: 'IVA', data: days.map(([ts, v]) => [ts, v.iva]) },
        { name: 'Subtotal', data: days.map(([ts, v]) => [ts, v.subtotal]) },
      ],
    };
  }

  private setCardsFacturadoPorFiltro(detalle: any[], from: Date, to: Date): void {
    const r = this.sumarPeriodo(detalle, from, to);
    this.data.previousStatement = {
      date: to.toISOString(),
      limit: r.importe,
      spent: r.facturas,
      minimum: r.impuestos,
    };

    this.data.currentStatement = {
      date: to.toISOString(),
      limit: r.impuestos,
      spent: r.facturas,
      minimum: r.impuestos,
    };
  }

  private onFacturadoLoaded(resp: any): void {
    const payload = resp?.data ?? resp;
    const tot = payload?.totales ?? {};
    const detalle: FacturaDetalle[] = payload?.detalle ?? [];

    this.importeTotalSinIva = Number(tot.importe) || 0;
    this.impuestosTotal = Number(tot.impuestos) || 0;
    this.totalConIva = Number(tot.total) || 0;

    this.ivaTotal = this.impuestosTotal || this.totalConIva - this.importeTotalSinIva;

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
        : detalle.filter(
            (x) =>
              (x.cliente ?? '').toLowerCase().includes(busqueda) ||
              (x.factura ?? '').toLowerCase().includes(busqueda),
          );
    } else {
      this.datosAgrupados = [];
    }
  }

  /**
   * SALDOS
   */

  calcularTotalPesoSaldos(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Saldos');
    return area?.metrics[0]?.value || 0;
  }

  calcularTotalPiezasSaldos(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Saldos');
    return area?.metrics[1]?.value || 0;
  }

  calcularTotalArticulosSaldos(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Saldos');
    return area?.metrics[2]?.value || 0;
  }

  private procesarSaldos(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    this.datosSaldosCompletos = data;
    const pesoTotal = data.reduce((sum, item) => sum + (Number(item.TOTAL_SALDO) || 0), 0);
    const piezasTotal = data.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const articulos = data.length;
    const area = this.areasResumen.find((a) => a.nombre === 'Saldos');
    if (area) {
      area.metrics[0].value = pesoTotal;
      area.metrics[1].value = piezasTotal;
      area.metrics[2].value = articulos;
    }
    this.crearGraficaSaldosTejido(data);
  }

  /**
   * EMBARQUES
   */
  private parseLocalYMD(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private crearGraficaEmbarquesTejido(data: any[]): void {
    if (!data || data.length === 0) {
      this.chartEmbarquesTejido = null;
      return;
    }

    const tiposOrdenados = [
      { nombre: 'PRIMERA', color: '#3b82f6' },
      { nombre: 'PREFERIDA', color: '#6366f1' },
      { nombre: 'SEGUNDA', color: '#f59e0b' },
      { nombre: 'ORILLAS', color: '#14b8a6' },
      { nombre: 'RETAZO', color: '#f59e0b' },
      { nombre: 'MUESTRAS', color: '#a855f7' },
    ];

    const fechasMap = new Map<string, Map<string, number>>();
    data.forEach((item: any) => {
      const fechaStr = item.FECHA ? String(item.FECHA).split(' ')[0] : null;
      if (!fechaStr) return;
      const tipo = item.TIPO?.trim() || 'SIN CLASIFICAR';
      const cantidad = parseFloat(item.CANTIDAD) || 0;
      if (!fechasMap.has(fechaStr)) {
        fechasMap.set(fechaStr, new Map());
      }
      const tipoMap = fechasMap.get(fechaStr)!;
      tipoMap.set(tipo, (tipoMap.get(tipo) || 0) + cantidad);
    });

    const fechasOrdenadas = Array.from(fechasMap.keys()).sort((a, b) => {
      return this.parseLocalYMD(a).getTime() - this.parseLocalYMD(b).getTime();
    });

    const categories = fechasOrdenadas.map((fecha) => {
      const d = this.parseLocalYMD(fecha);
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    });

    const series = tiposOrdenados.map((tipo) => ({
      name: tipo.nombre,
      data: fechasOrdenadas.map((fecha) => {
        const tipoMap = fechasMap.get(fecha);
        return tipoMap?.get(tipo.nombre) || 0;
      }),
    }));

    const colors = tiposOrdenados.map((t) => t.color);
    const textColor = '#c4c4c4';
    const mutedText = '#9ca3af';

    this.chartEmbarquesTejido = {
      series: series,
      chart: {
        type: 'line',
        height: this.isMobile ? 280 : 320,
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
        animations: {
          enabled: true,
          speed: 400,
        },
        zoom: { enabled: false },
        foreColor: textColor,
        events: {
          legendClick: (chartContext: any, seriesIndex: number, config: any) => {
            const tipoClickeado = series[seriesIndex].name;
            if (this.tipoEmbarqueSeleccionadoGrafica === tipoClickeado) {
              this.tipoEmbarqueSeleccionadoGrafica = null;
              series.forEach((s, idx) => {
                chartContext.showSeries(s.name);
              });
            } else {
              this.tipoEmbarqueSeleccionadoGrafica = tipoClickeado;
              series.forEach((s, idx) => {
                if (s.name === tipoClickeado) {
                  chartContext.showSeries(s.name);
                } else {
                  chartContext.hideSeries(s.name);
                }
              });
            }
            this.actualizarMetricasEmbarquesGrafica();
            this.actualizarEstiloLeyenda();
            this.cdr.markForCheck();
            return false;
          },
        },
      },
      theme: { mode: 'dark' },
      colors: colors,
      stroke: {
        width: 3,
        curve: 'smooth',
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: categories,
        labels: {
          rotate: -45,
          rotateAlways: fechasOrdenadas.length > 7,
          style: {
            fontSize: this.isMobile ? '9px' : '10px',
            colors: Array(categories.length).fill(mutedText),
          },
          formatter: (val: string) => {
            if (!val || typeof val !== 'string') return '';
            return val;
          },
        },
        tickPlacement: 'on',
        tooltip: { enabled: false },
      },
      yaxis: {
        title: {
          text: 'Cantidad (kg)',
          style: {
            fontSize: '10px',
            color: textColor,
          },
        },
        labels: {
          formatter: (val: number) => {
            if (typeof val !== 'number' || isNaN(val)) return '0';
            return val.toFixed(0);
          },
          style: {
            fontSize: this.isMobile ? '9px' : '11px',
            colors: [mutedText],
          },
        },
      },
      legend: {
        show: true,
        position: this.isMobile ? 'bottom' : 'bottom',
        horizontalAlign: 'center',
        fontSize: this.isMobile ? '10px' : '11px',
        fontWeight: 500,
        labels: {
          colors: textColor,
          useSeriesColors: false,
        },
        markers: {
          size: 6,
          strokeWidth: 0,
        },
        itemMargin: {
          horizontal: 8,
          vertical: 4,
        },
        onItemClick: {
          toggleDataSeries: false,
        },
        onItemHover: {
          highlightDataSeries: false,
        },
      },
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        x: { show: true },
        y: {
          formatter: (val: number) => {
            if (typeof val !== 'number' || isNaN(val)) return '0.00 kg';
            return `${val.toFixed(2)} kg`;
          },
        },
      },
      grid: { show: false },
      markers: {
        size: 4,
        strokeWidth: 2,
        strokeColors: '#fff',
        hover: { size: 6 },
      },
    };
  }

  private actualizarEstiloLeyenda(): void {
    setTimeout(() => {
      const leyendaItems = document.querySelectorAll('.apexcharts-legend-series');
      leyendaItems.forEach((item: any) => {
        const seriesName = item.getAttribute('seriesname');
        if (!seriesName) return;
        item.style.opacity = '';
        item.style.transform = '';
        item.style.transition = 'all 0.3s ease';

        if (this.tipoEmbarqueSeleccionadoGrafica) {
          if (seriesName === this.tipoEmbarqueSeleccionadoGrafica) {
            item.style.opacity = '1';
            item.style.transform = 'scale(1.1)';
            item.style.fontWeight = 'bold';
          } else {
            item.style.opacity = '0.3';
            item.style.transform = 'scale(0.95)';
          }
        } else {
          item.style.opacity = '1';
          item.style.transform = 'scale(1)';
          item.style.fontWeight = 'normal';
        }
      });
    }, 50);
  }

  private actualizarMetricasEmbarquesGrafica(): void {
    const area = this.areasResumen.find((a) => a.nombre === 'Embarques');
    if (!area) return;
    const datosFiltrados = this.tipoEmbarqueSeleccionadoGrafica
      ? this.datosEmbarquesCompletos.filter(
          (d) => this.norm(d.TIPO) === this.norm(this.tipoEmbarqueSeleccionadoGrafica!),
        )
      : this.datosEmbarquesCompletos;
    const totalEmbarcado = datosFiltrados.reduce(
      (sum, item) => sum + (Number(item.CANTIDAD) || 0),
      0,
    );
    const tiposUnicos = new Set(datosFiltrados.map((d) => this.norm(d.TIPO)));
    const tipos = tiposUnicos.size;
    const articulos = new Set(datosFiltrados.map((item) => String(item.ARTICULO ?? '').trim()))
      .size;

    area.metrics[0].value = totalEmbarcado;
    area.metrics[1].value = tipos;
    area.metrics[2].value = articulos;

    this.cdr.markForCheck();
  }

  calcularTotalEmbarquesCard(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Embarques');
    return area?.metrics[0]?.value || 0;
  }

  calcularTiposEmbarqueCard(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Embarques');
    return area?.metrics[1]?.value || 0;
  }

  calcularArticulosEmbarquesCard(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Embarques');
    return area?.metrics[2]?.value || 0;
  }

  seleccionarTipoEmbarque(tipo: string): void {
    const t = this.norm(tipo);
    this.tipoEmbarqueSeleccionado = this.tipoEmbarqueSeleccionado === t ? null : t;
    this.actualizarMetricasEmbarques();
  }

  private actualizarMetricasEmbarques(): void {
    const area = this.areasResumen.find((a) => a.nombre === 'Embarques');
    if (!area) return;

    const datosFiltrados = this.tipoEmbarqueSeleccionado
      ? this.datosEmbarquesCompletos.filter(
          (d) => this.norm(d.TIPO) === this.tipoEmbarqueSeleccionado,
        )
      : this.datosEmbarquesCompletos;

    const totalEmbarcado = datosFiltrados.reduce(
      (sum, item) => sum + (Number(item.CANTIDAD) || 0),
      0,
    );
    const TIPOS_FIJOS = ['PRIMERA', 'PREFERIDA', 'SEGUNDA', 'ORILLAS', 'RETAZO', 'MUESTRAS'];
    const tipos = TIPOS_FIJOS.length;
    const articulos = new Set(datosFiltrados.map((item) => String(item.ARTICULO ?? '').trim()))
      .size;

    area.metrics[0].value = totalEmbarcado;
    area.metrics[1].value = tipos;
    area.metrics[2].value = articulos;

    this.cdr.markForCheck();
  }

  private procesarEmbarques(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    this.tipoEmbarqueSeleccionadoGrafica = null;

    this.datosEmbarquesCompletos = data;
    this.datosEmbarquesCompletos = data;
    const norm = (v: any) =>
      String(v ?? '')
        .trim()
        .toUpperCase();
    const totalEmbarcado = data.reduce((sum, item) => sum + (Number(item.CANTIDAD) || 0), 0);
    const TIPOS_FIJOS = ['PRIMERA', 'PREFERIDA', 'SEGUNDA', 'ORILLAS', 'RETAZO', 'MUESTRAS'];
    const tipos = TIPOS_FIJOS.length;
    const articulos = new Set(data.map((item) => String(item.ARTICULO ?? '').trim())).size;
    const area = this.areasResumen.find((a) => a.nombre === 'Embarques');
    if (area) {
      area.metrics[0].value = totalEmbarcado;
      area.metrics[1].value = tipos;
      area.metrics[2].value = articulos;
    }
    this.crearGraficaEmbarquesTejido(data);
  }

  limpiarFiltroEmbarques(): void {
    this.tipoEmbarqueSeleccionadoGrafica = null;
    this.crearGraficaEmbarquesTejido(this.datosEmbarquesCompletos);
    this.actualizarMetricasEmbarquesGrafica();
    this.cdr.markForCheck();
  }

  get datosAgrupadosFiltrados(): ClienteAgrupado[] {
    if (!this.terminoBusqueda) return this.datosAgrupados;
    const term = this.terminoBusqueda.toLowerCase();
    return this.datosAgrupados.filter(
      (cliente) =>
        cliente.cliente?.toLowerCase().includes(term) ||
        cliente.facturas?.some(
          (f) => f.factura?.toLowerCase().includes(term) || f.um?.toLowerCase().includes(term),
        ),
    );
  }

  get hayResultados(): boolean {
    return this.datosAgrupadosFiltrados.length > 0;
  }

  get areasResumenFiltradas(): AreaResumen[] {
    if (!this.terminoBusqueda) return this.areasResumen;
    return this.areasResumen.filter(
      (area) =>
        area.nombre.toLowerCase().includes(this.terminoBusqueda) ||
        area.metrics?.some((m) => m.label.toLowerCase().includes(this.terminoBusqueda)),
    );
  }

  limpiarBusqueda(): void {
    this.sharedData.actualizarFiltros({ busqueda: '' });
  }

  get areasResumenGeneralFiltradas() {
    if (!this.terminoBusqueda) return null;
    const term = this.terminoBusqueda.toLowerCase();
    return this.areasResumen.filter(
      (a) =>
        a.nombre.toLowerCase().includes(term) ||
        a.metrics?.some((m) => m.label.toLowerCase().includes(term)),
    );
  }

  get seccionesVisibles(): Set<string> {
    if (!this.terminoBusqueda) {
      return new Set([
        'Facturación',
        'Distribución de procesos',
        'Tejido',
        'Tintorería',
        'Estampados',
        'Acabado real',
        'Producción tejido',
        'Tejido revisado',
        'Por revisar',
        'Saldos',
        'Embarques',
      ]);
    }
    const term = this.terminoBusqueda.toLowerCase();

    const nombres: { [key: string]: string[] } = {
      Facturación: ['facturación', 'facturacion', 'total', 'peso', 'factura'],
      Tejido: ['tejido'],
      Tintorería: ['tintorería', 'tintoreria', 'teñido', 'tenido', 'tintor'],
      Estampados: ['estampados', 'estampado'],
      'Acabado real': ['acabado', 'acabado real', 'control de calidad', 'calidad'],
      'Producción tejido': ['producción', 'produccion', 'produccion tejido', 'tejido'],
      'Tejido revisado': ['revisado', 'tejido revisado', 'tejido'],
      'Por revisar': ['por revisar', 'revisar'],
      Saldos: ['saldos', 'saldo'],
      Embarques: ['embarques', 'embarque'],
    };

    const visible = new Set<string>();
    for (const [seccion, keywords] of Object.entries(nombres)) {
      if (keywords.some((k) => k.includes(term) || term.includes(k))) {
        visible.add(seccion);
      }
    }

    const seccionesProcesos = ['Tejido', 'Tintorería', 'Estampados', 'Acabado real'];
    if (seccionesProcesos.some((s) => visible.has(s))) {
      visible.add('Distribución de procesos');
    }

    return visible;
  }

  esVisible(seccion: string): boolean {
    return this.seccionesVisibles.has(seccion);
  }

  get hayResultadosGeneral(): boolean {
    return !this.terminoBusqueda || this.seccionesVisibles.size > 0;
  }
}
