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
import { FinanceService } from 'app/modules/admin/dashboards/finance/finance.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { filter, forkJoin, map, Subject, takeUntil } from 'rxjs';
import { SharedDataService } from '../../list/shared-data.service';
import {
  PorRevisarTejido,
  ProduccionTejido,
  ReportProdService,
  RevisadoTejido,
  SaldosTejido,
} from '../../reportprod.service';

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
  chartDistribucionProcesos: ApexOptions | null = null;
  importeTotalSinIva = 0;
  impuestosTotal = 0;
  totalConIva = 0;
  totalFacturas = 0;
  cantidadTotal = 0;
  cantidadesPorUnidad: { [key: string]: number } = {};
  facturasConIva = 0;
  facturasSinIva = 0;
  accountBalanceOptions!: ApexOptions;
  filtros$ = this.sharedData.filtrosGlobales$;
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
  ivaTotal = 0;

  loadingFacturacion = true;
  loadingGraficaFacturacion = true;
  loadingDistribucionProcesos = true;
  loadingDetallesProcesos = true;
  loadingProduccionTejido = true;
  loadingRevisadoTejido = true;
  loadingPorRevisarTejido = true;
  loadingSaldosTejido = true;
  loadingEmbarquesTejido = true;
  datosEmbarquesCompletos: any[] = [];
  chartEmbarquesTejido: ApexOptions | null = null;

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
      nombre: 'Procesos tejido',
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
  datosProduccionCompletos: ProduccionTejido[] = [];
  datosRevisadoCompletos: RevisadoTejido[] = [];
  datosPorRevisarCompletos: PorRevisarTejido[] = [];
  datosSaldosCompletos: SaldosTejido[] = [];

  // Para manejar la selección de artículos
  articuloSeleccionadoProduccion: string | null = null;
  articuloSeleccionadoRevisado: string | null = null;
  articuloSeleccionadoPorRevisar: string | null = null;
  articuloSeleccionadoSaldos: string | null = null;

  // Gráficas de las cards
  chartProduccionTejido: ApexOptions | null = null;
  chartRevisadoTejido: ApexOptions | null = null;
  chartPorRevisarTejido: ApexOptions | null = null;
  chartSaldosTejido: ApexOptions | null = null;

  constructor(
    private reportService: ReportProdService,
    private sharedData: SharedDataService,
    private cdr: ChangeDetectorRef,
    private breakpointObserver: BreakpointObserver,
    private _financeService: FinanceService,
  ) {}

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
        filter((recargar) => recargar === true),
      )
      .subscribe(() => {
        this.cargarTodasLasAreas();
        this.sharedData.confirmarRecargaConsumida();
      });

    // this._financeService.data$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
    //   if (!data) return;
    //   this.recentTransactionsDataSource.data = data.recentTransactions ?? [];
    //   this.data = {
    //     ...this.data,
    //     recentTransactions: data.recentTransactions ?? this.data.recentTransactions,
    //   };
    //   this.cdr.markForCheck();
    // });

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
  }

  private cargarTodasLasAreas(): void {
    const filtros = this.sharedData.obtenerFiltros();
    const fechaInicio =
      filtros.fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fechaFin = filtros.fechaFin || new Date();
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
    forkJoin({
      facturado: this.reportService.getFacturado(fechaInicio, fechaFin, true),
      embarques: this.reportService.getEntregadoaEmbarques(fechaInicio, fechaFin),
      tejido: this.reportService.getTejidoResumen(fechaInicio, fechaFin),
      tintoreria: this.reportService.getTintoreria(fechaInicio, fechaFin),
      estampados: this.reportService.getEstampados(fechaInicio, fechaFin),
      acabado: this.reportService.getAcabado(fechaInicio, fechaFin),
      produccion: this.reportService.getProduccionTejido(fechaInicio, fechaFin),
      revisado: this.reportService.getRevisadoTejido(fechaInicio, fechaFin),
      porRevisar: this.reportService.getPorRevisarTejido(fechaInicio, fechaFin),
      saldos: this.reportService.getSaldosTejido(fechaInicio, fechaFin),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (datos) => {
          // Procesar datos
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
        },
        error: (err) => {
          console.error('Error cargando datos:', err);

          // 🔥 Desactivar loaders también en caso de error
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

    const area = this.areasResumen.find((a) => a.nombre === 'Facturación');
    if (area) {
      area.metrics[0].value = totalFacturado;
      area.metrics[1].value = facturas;
      area.metrics[2].value = cantidad;
    }
  }

  private procesarProduccion(data: any[]): void {
    if (!data || !Array.isArray(data)) return;

    // 🔥 Guardar datos completos
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

    // 🔥 Crear gráfica de anillo
    this.crearGraficaProduccionTejido(data);
  }

  private procesarRevisado(data: any[]): void {
    if (!data || !Array.isArray(data)) return;

    // 🔥 Guardar datos completos
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

    // 🔥 Crear gráfica de anillo
    this.crearGraficaRevisadoTejido(data);
  }

  private procesarPorRevisar(data: any[]): void {
    if (!data || !Array.isArray(data)) return;

    // 🔥 Guardar datos completos
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

    // 🔥 Crear gráfica de anillo
    this.crearGraficaPorRevisarTejido(data);
  }

  private procesarSaldos(data: any[]): void {
    if (!data || !Array.isArray(data)) return;

    // 🔥 Guardar datos completos
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

    // 🔥 Crear gráfica de anillo
    this.crearGraficaSaldosTejido(data);
  }

  private procesarEmbarques(data: any[]): void {
    if (!data || !Array.isArray(data)) return;

    // Guardar datos completos
    this.datosEmbarquesCompletos = data;

    // Normalizar tipo (evita diferencias de mayúsculas/espacios)
    const norm = (v: any) =>
      String(v ?? '')
        .trim()
        .toUpperCase();

    const totalEmbarcado = data.reduce((sum, item) => sum + (Number(item.CANTIDAD) || 0), 0);

    // ✅ Tipos fijos del negocio (siempre 6)
    const TIPOS_FIJOS = ['PRIMERA', 'PREFERIDA', 'SEGUNDA', 'ORILLAS', 'RETAZO', 'MUESTRAS'];
    const tipos = TIPOS_FIJOS.length;

    // Artículos únicos
    const articulos = new Set(data.map((item) => String(item.ARTICULO ?? '').trim())).size;

    const area = this.areasResumen.find((a) => a.nombre === 'Embarques');
    if (area) {
      area.metrics[0].value = totalEmbarcado;
      area.metrics[1].value = tipos;
      area.metrics[2].value = articulos;
    }

    // (Opcional) si tu filtro por tipo usa trim() normal, mejor normalizar también:
    // this.datosEmbarquesCompletos = data.map(x => ({ ...x, TIPO: norm(x.TIPO) }));

    // Crear gráfica
    this.crearGraficaEmbarquesTejido(data);
  }

  private procesarTejido(data: any[]): void {
    if (!data || !Array.isArray(data)) return;
    const cantidadTotal = data.reduce((sum, item) => sum + (Number(item.CANTIDAD) || 0), 0);
    const piezasTotal = data.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const departamentos = new Set(data.map((item) => item.departamento)).size;

    const area = this.areasResumen.find((a) => a.nombre === 'Procesos tejido');
    if (area) {
      area.metrics[0].value = cantidadTotal;
      area.metrics[1].value = piezasTotal;
      area.metrics[2].value = departamentos;

      // 🔥 AGREGANDO LOS DETALLES PARA TEJIDO
      area.detalles = data.map((item) => ({
        departamento: item.departamento || 'N/A',
        proceso: item.proceso || 'N/A',
        cantidad: Number(item.CANTIDAD) || 0,
        piezas: Number(item.PIEZAS) || 0,
      }));
    }
  }

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
        return new Intl.NumberFormat('es-MX').format(value);
    }
  }

  cambiarVista(vista: 'general' | 'detalle'): void {
    this.vistaActual = vista;
    this.cdr.markForCheck();
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
      { name: 'Sin IVA', data: days.map(([ts, v]) => [ts, v.subtotal]) },
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

  private toNum(v: any): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/,/g, '').trim();
    const n = Number(s);
    return isNaN(n) ? 0 : n;
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
      // this.agruparPorCliente(detalleFiltrado);
    } else {
      this.datosAgrupados = [];
    }
  }

  // private agruparPorCliente(detalle: FacturaDetalle[]): void {
  //   const agrupado = new Map<string, ClienteAgrupado>();
  //   for (const item of detalle) {
  //     const cliente = (item.cliente || 'Sin cliente').trim?.() ?? 'Sin cliente';
  //     if (!agrupado.has(cliente)) {
  //       agrupado.set(cliente, {
  //         cliente,
  //         facturas: [],
  //         cantidadesPorUnidad: {},
  //         importeTotal: 0,
  //         impuestosTotal: 0,
  //         totalFacturado: 0,
  //         expandido: false,
  //       });
  //     }
  //     const grupo = agrupado.get(cliente)!;
  //     grupo.facturas.push(item);
  //     const unidad = item.um || 'N/A';
  //     grupo.cantidadesPorUnidad[unidad] =
  //       (grupo.cantidadesPorUnidad[unidad] || 0) + (Number(item.cant) || 0);
  //     grupo.importeTotal += Number(item.importe) || 0;
  //     grupo.impuestosTotal += Number(item.impuestos) || 0;
  //     grupo.totalFacturado += Number(item.total) || 0;
  //   }
  //   this.datosAgrupados = Array.from(agrupado.values()).sort(
  //     (a, b) => b.totalFacturado - a.totalFacturado,
  //   );
  // }

  get detallesTintoreria() {
    return this.areasResumen.find((a) => a.nombre === 'Tintorería')?.detalles || [];
  }

  get detallesEstampados() {
    return this.areasResumen.find((a) => a.nombre === 'Estampados')?.detalles || [];
  }

  get detallesAcabado() {
    return this.areasResumen.find((a) => a.nombre === 'Acabado real')?.detalles || [];
  }

  // 🔥 AGREGANDO GETTER PARA LOS DETALLES DE TEJIDO
  get detallesTejido() {
    return this.areasResumen.find((a) => a.nombre === 'Procesos tejido')?.detalles || [];
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

    this.chartDistribucionProcesos = {
      series: [
        {
          name: 'Cantidad (kg)',
          data: procesos.map((p) => p.cantidad),
        },
        {
          name: 'Piezas',
          data: procesos.map((p) => p.piezas),
        },
      ],
      chart: {
        type: 'bar',
        height: this.isMobile ? 320 : 550,
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: this.isMobile ? '50%' : '60%',
          borderRadius: 4,
        },
      },
      colors: ['#10b981', '#3b82f6'],
      dataLabels: {
        enabled: false,
      },
      stroke: {
        show: true,
        width: 2,
        colors: ['transparent'],
      },
      xaxis: {
        categories: procesos.map((p) => p.nombre),
        labels: {
          style: {
            fontSize: this.isMobile ? '10px' : '12px',
          },
          rotate: this.isMobile ? -45 : 0,
          rotateAlways: this.isMobile,
        },
      },
      yaxis: [
        {
          title: {
            text: this.isMobile ? '' : 'Cantidad (kg)',
            style: {
              fontSize: '11px',
            },
          },
          labels: {
            style: {
              fontSize: this.isMobile ? '9px' : '11px',
            },
            formatter: (val: number) =>
              this.isMobile ? this.formatValue(val, 'number') : this.formatValue(val, 'decimal'),
          },
        },
        {
          opposite: true,
          title: {
            text: this.isMobile ? '' : 'Piezas',
            style: {
              fontSize: '11px',
            },
          },
          labels: {
            style: {
              fontSize: this.isMobile ? '9px' : '11px',
            },
            formatter: (val: number) => this.formatValue(val, 'number'),
          },
        },
      ],
      fill: {
        opacity: 1,
      },
      tooltip: {
        theme: 'dark',
        y: {
          formatter: (val: number, opts: any) => {
            if (opts.seriesIndex === 0) {
              return this.formatValue(val, 'decimal') + ' kg';
            }
            return this.formatValue(val, 'number') + ' piezas';
          },
        },
      },
      legend: {
        show: true,
        position: this.isMobile ? 'bottom' : 'top',
        horizontalAlign: this.isMobile ? 'center' : 'left',
        fontSize: this.isMobile ? '10px' : '12px',
        markers: {
          size: this.isMobile ? 5 : 7,
        },
        itemMargin: {
          horizontal: this.isMobile ? 6 : 10,
          vertical: this.isMobile ? 4 : 6,
        },
      },
      grid: {
        padding: {
          left: this.isMobile ? 5 : 10,
          right: this.isMobile ? 5 : 10,
          bottom: this.isMobile ? 10 : 0,
        },
      },
    };
  }

  calcularTotalPesoTejido(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Producción tejido');
    return area?.metrics[0]?.value || 0;
  }

  calcularTotalPiezasTejido(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Producción tejido');
    return area?.metrics[1]?.value || 0;
  }

  contarArticulosTejido(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Producción tejido');
    return area?.metrics[2]?.value || 0;
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

  calcularTotalPesoPorRevisar(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Por revisar');
    return area?.metrics[0]?.value || 0;
  }

  calcularTotalPiezasPorRevisar(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Por revisar');
    return area?.metrics[1]?.value || 0;
  }

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

  calcularTotalArticulosPorRevisar(): number {
    const area = this.areasResumen.find((a) => a.nombre === 'Por revisar');
    return area?.metrics[2]?.value || 0;
  }

  private crearGraficaProduccionTejido(data: any[]): void {
    if (!data || data.length === 0) {
      this.chartProduccionTejido = null;
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

    // Ordenar y tomar top N
    const datosOrdenados = [...data].sort(
      (a, b) => parseFloat(b.TOTAL_TJ) - parseFloat(a.TOTAL_TJ),
    );

    const topArticulos = datosOrdenados.slice(0, topN);
    const otrosArticulos = datosOrdenados.slice(topN);

    const series = topArticulos.map((item) => parseFloat(item.TOTAL_TJ));
    const labels = topArticulos.map((item) => item.ARTICULO);

    // Agregar "Otros" si hay más
    if (otrosArticulos.length > 0) {
      const otrosTotal = otrosArticulos.reduce((sum, item) => sum + parseFloat(item.TOTAL_TJ), 0);
      series.push(otrosTotal);
      labels.push(`Otros (${otrosArticulos.length})`);
    }

    this.chartProduccionTejido = {
      series: series,
      labels: labels,
      chart: {
        type: 'donut',
        height: 176,
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
        events: {
          dataPointSelection: (event: any, chartContext: any, config: any) => {
            const articulo = labels[config.dataPointIndex];
            if (!articulo.startsWith('Otros')) {
              this.seleccionarArticuloProduccion(articulo);
            }
          },
        },
      },
      colors: [...COLORES, '#9ca3af'],
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        show: true,
        width: 2,
        colors: ['#fff'],
      },
      legend: {
        show: false,
      },
      tooltip: {
        y: {
          formatter: (val: number) => `${val.toFixed(2)} kg`,
        },
      },
    };
  }

  private crearGraficaRevisadoTejido(data: any[]): void {
    if (!data || data.length === 0) {
      this.chartRevisadoTejido = null;
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
      (a, b) => parseFloat(b.TOTAL_RV) - parseFloat(a.TOTAL_RV),
    );

    const topArticulos = datosOrdenados.slice(0, topN);
    const otrosArticulos = datosOrdenados.slice(topN);

    const series = topArticulos.map((item) => parseFloat(item.TOTAL_RV));
    const labels = topArticulos.map((item) => item.ARTICULO);

    if (otrosArticulos.length > 0) {
      const otrosTotal = otrosArticulos.reduce((sum, item) => sum + parseFloat(item.TOTAL_RV), 0);
      series.push(otrosTotal);
      labels.push(`Otros (${otrosArticulos.length})`);
    }

    this.chartRevisadoTejido = {
      series: series,
      labels: labels,
      chart: {
        type: 'donut',
        height: 176,
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
        events: {
          dataPointSelection: (event: any, chartContext: any, config: any) => {
            const articulo = labels[config.dataPointIndex];
            if (!articulo.startsWith('Otros')) {
              this.seleccionarArticuloRevisado(articulo);
            }
          },
        },
      },
      colors: [...COLORES, '#9ca3af'],
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        show: true,
        width: 2,
        colors: ['#fff'],
      },
      legend: {
        show: false,
      },
      tooltip: {
        y: {
          formatter: (val: number) => `${val.toFixed(2)} kg`,
        },
      },
    };
  }

  private crearGraficaPorRevisarTejido(data: any[]): void {
    if (!data || data.length === 0) {
      this.chartPorRevisarTejido = null;
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
      (a, b) => parseFloat(b.TOTAL_POR_REVISAR) - parseFloat(a.TOTAL_POR_REVISAR),
    );

    const topArticulos = datosOrdenados.slice(0, topN);
    const otrosArticulos = datosOrdenados.slice(topN);

    const series = topArticulos.map((item) => parseFloat(item.TOTAL_POR_REVISAR));
    const labels = topArticulos.map((item) => item.ARTICULO);

    if (otrosArticulos.length > 0) {
      const otrosTotal = otrosArticulos.reduce(
        (sum, item) => sum + parseFloat(item.TOTAL_POR_REVISAR),
        0,
      );
      series.push(otrosTotal);
      labels.push(`Otros (${otrosArticulos.length})`);
    }

    this.chartPorRevisarTejido = {
      series: series,
      labels: labels,
      chart: {
        type: 'donut',
        height: 176,
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
        events: {
          dataPointSelection: (event: any, chartContext: any, config: any) => {
            const articulo = labels[config.dataPointIndex];
            if (!articulo.startsWith('Otros')) {
              this.seleccionarArticuloPorRevisar(articulo);
            }
          },
        },
      },
      colors: [...COLORES, '#9ca3af'],
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        show: true,
        width: 2,
        colors: ['#fff'],
      },
      legend: {
        show: false,
      },
      tooltip: {
        y: {
          formatter: (val: number) => `${val.toFixed(2)} kg`,
        },
      },
    };
  }

  private crearGraficaSaldosTejido(data: any[]): void {
    if (!data || data.length === 0) {
      this.chartSaldosTejido = null;
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
      (a, b) => parseFloat(b.TOTAL_SALDO) - parseFloat(a.TOTAL_SALDO),
    );

    const topArticulos = datosOrdenados.slice(0, topN);
    const otrosArticulos = datosOrdenados.slice(topN);

    const series = topArticulos.map((item) => parseFloat(item.TOTAL_SALDO));
    const labels = topArticulos.map((item) => item.ARTICULO);

    if (otrosArticulos.length > 0) {
      const otrosTotal = otrosArticulos.reduce(
        (sum, item) => sum + parseFloat(item.TOTAL_SALDO),
        0,
      );
      series.push(otrosTotal);
      labels.push(`Otros (${otrosArticulos.length})`);
    }

    this.chartSaldosTejido = {
      series: series,
      labels: labels,
      chart: {
        type: 'donut',
        height: 176,
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
        events: {
          dataPointSelection: (event: any, chartContext: any, config: any) => {
            const articulo = labels[config.dataPointIndex];
            if (!articulo.startsWith('Otros')) {
              this.seleccionarArticuloSaldos(articulo);
            }
          },
        },
      },
      colors: [...COLORES, '#9ca3af'],
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        show: true,
        width: 2,
        colors: ['#fff'],
      },
      legend: {
        show: false,
      },
      tooltip: {
        y: {
          formatter: (val: number) => `${val.toFixed(2)} kg`,
        },
      },
    };
  }

  // Métodos para seleccionar artículos
  seleccionarArticuloProduccion(articulo: string): void {
    if (this.articuloSeleccionadoProduccion === articulo) {
      this.articuloSeleccionadoProduccion = null;
    } else {
      this.articuloSeleccionadoProduccion = articulo;
    }
    this.actualizarMetricasProduccion();
  }

  seleccionarArticuloRevisado(articulo: string): void {
    if (this.articuloSeleccionadoRevisado === articulo) {
      this.articuloSeleccionadoRevisado = null;
    } else {
      this.articuloSeleccionadoRevisado = articulo;
    }
    this.actualizarMetricasRevisado();
  }

  seleccionarArticuloPorRevisar(articulo: string): void {
    if (this.articuloSeleccionadoPorRevisar === articulo) {
      this.articuloSeleccionadoPorRevisar = null;
    } else {
      this.articuloSeleccionadoPorRevisar = articulo;
    }
    this.actualizarMetricasPorRevisar();
  }

  seleccionarArticuloSaldos(articulo: string): void {
    if (this.articuloSeleccionadoSaldos === articulo) {
      this.articuloSeleccionadoSaldos = null;
    } else {
      this.articuloSeleccionadoSaldos = articulo;
    }
    this.actualizarMetricasSaldos();
  }

  // Métodos para actualizar las métricas según selección
  private actualizarMetricasProduccion(): void {
    const area = this.areasResumen.find((a) => a.nombre === 'Producción tejido');
    if (!area) return;

    const datosFiltrados = this.articuloSeleccionadoProduccion
      ? this.datosProduccionCompletos.filter(
          (d) => d.ARTICULO === this.articuloSeleccionadoProduccion,
        )
      : this.datosProduccionCompletos;

    const peso = datosFiltrados.reduce((sum, item) => sum + (Number(item.TOTAL_TJ) || 0), 0);
    const piezas = datosFiltrados.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const articulos = datosFiltrados.length;

    area.metrics[0].value = peso;
    area.metrics[1].value = piezas;
    area.metrics[2].value = articulos;

    this.cdr.markForCheck();
  }

  private actualizarMetricasRevisado(): void {
    const area = this.areasResumen.find((a) => a.nombre === 'Tejido revisado');
    if (!area) return;

    const datosFiltrados = this.articuloSeleccionadoRevisado
      ? this.datosRevisadoCompletos.filter((d) => d.ARTICULO === this.articuloSeleccionadoRevisado)
      : this.datosRevisadoCompletos;

    const peso = datosFiltrados.reduce((sum, item) => sum + (Number(item.TOTAL_RV) || 0), 0);
    const piezas = datosFiltrados.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const articulos = datosFiltrados.length;

    area.metrics[0].value = peso;
    area.metrics[1].value = piezas;
    area.metrics[2].value = articulos;

    this.cdr.markForCheck();
  }

  private actualizarMetricasPorRevisar(): void {
    const area = this.areasResumen.find((a) => a.nombre === 'Por revisar');
    if (!area) return;

    const datosFiltrados = this.articuloSeleccionadoPorRevisar
      ? this.datosPorRevisarCompletos.filter(
          (d) => d.ARTICULO === this.articuloSeleccionadoPorRevisar,
        )
      : this.datosPorRevisarCompletos;

    const peso = datosFiltrados.reduce(
      (sum, item) => sum + (Number(item.TOTAL_POR_REVISAR) || 0),
      0,
    );
    const piezas = datosFiltrados.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const articulos = datosFiltrados.length;

    area.metrics[0].value = peso;
    area.metrics[1].value = piezas;
    area.metrics[2].value = articulos;

    this.cdr.markForCheck();
  }

  private actualizarMetricasSaldos(): void {
    const area = this.areasResumen.find((a) => a.nombre === 'Saldos');
    if (!area) return;

    const datosFiltrados = this.articuloSeleccionadoSaldos
      ? this.datosSaldosCompletos.filter((d) => d.ARTICULO === this.articuloSeleccionadoSaldos)
      : this.datosSaldosCompletos;

    const peso = datosFiltrados.reduce((sum, item) => sum + (Number(item.TOTAL_SALDO) || 0), 0);
    const piezas = datosFiltrados.reduce((sum, item) => sum + (Number(item.PIEZAS) || 0), 0);
    const articulos = datosFiltrados.length;

    area.metrics[0].value = peso;
    area.metrics[1].value = piezas;
    area.metrics[2].value = articulos;

    this.cdr.markForCheck();
  }

  // Cambiar el método de selección para que sea por TIPO
  tipoEmbarqueSeleccionado: string | null = null;

  private norm(v: any) {
    return String(v ?? '')
      .trim()
      .toUpperCase();
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

  // Getters para usar en el template de embarques
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

  // gráfica de LÍNEAS múltiples en embarques
  private crearGraficaEmbarquesTejido(data: any[]): void {
    if (!data || data.length === 0) {
      this.chartEmbarquesTejido = null;
      return;
    }

    // Tipos conocidos con colores específicos
    const tiposOrdenados = [
      { nombre: 'PRIMERA', color: '#3b82f6' },
      { nombre: 'PREFERIDA', color: '#6366f1' },
      { nombre: 'SEGUNDA', color: '#f59e0b' },
      { nombre: 'ORILLAS', color: '#14b8a6' },
      { nombre: 'RETAZO', color: '#f59e0b' },
      { nombre: 'MUESTRAS', color: '#a855f7' },
    ];

    // 🔥 Agrupar por FECHA y TIPO
    const fechasMap = new Map<string, Map<string, number>>();

    data.forEach((item: any) => {
      // Parsear la fecha (viene como string del backend)
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

    // Ordenar fechas cronológicamente
    const fechasOrdenadas = Array.from(fechasMap.keys()).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    // Formatear fechas para el eje X
    const categories = fechasOrdenadas.map((fecha) => {
      const d = new Date(fecha);
      return d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
      });
    });

    // Crear una serie (línea) por cada tipo de embarque
    const series = tiposOrdenados.map((tipo) => ({
      name: tipo.nombre,
      data: fechasOrdenadas.map((fecha) => {
        const tipoMap = fechasMap.get(fecha);
        return tipoMap?.get(tipo.nombre) || 0;
      }),
    }));

    const colors = tiposOrdenados.map((t) => t.color);

    this.chartEmbarquesTejido = {
      series: series,
      chart: {
        type: 'line',
        height: this.isMobile ? 280 : 320,
        fontFamily: 'Inter, sans-serif',
        toolbar: {
          show: false, // ✅ Ocultar toolbar
        },
        animations: {
          enabled: true,
          speed: 400,
        },
        zoom: {
          enabled: false, // ✅ Deshabilitar zoom
        },
      },
      colors: colors,
      stroke: {
        width: 3,
        curve: 'smooth',
      },
      dataLabels: {
        enabled: false,
      },
      xaxis: {
        categories: categories,
        labels: {
          rotate: -45,
          rotateAlways: fechasOrdenadas.length > 7,
          style: {
            fontSize: this.isMobile ? '9px' : '10px',
          },
          formatter: (val: string) => {
            if (!val || typeof val !== 'string') {
              return '';
            }
            return val;
          },
        },
        tickPlacement: 'on',
        tooltip: {
          enabled: false,
        },
      },
      yaxis: {
        title: {
          text: 'Cantidad (kg)',
          style: {
            fontSize: '12px',
          },
        },
        labels: {
          formatter: (val: number) => {
            if (typeof val !== 'number' || isNaN(val)) {
              return '0';
            }
            return val.toFixed(0);
          },
          style: {
            fontSize: this.isMobile ? '9px' : '11px',
          },
        },
      },
      legend: {
        show: true,
        position: this.isMobile ? 'bottom' : 'bottom',
        horizontalAlign: 'center',
        fontSize: this.isMobile ? '10px' : '11px',
        fontWeight: 500,
        markers: {
          size: 6,
          strokeWidth: 0,
        },
        itemMargin: {
          horizontal: 8,
          vertical: 4,
        },
      },
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        x: {
          show: true,
        },
        y: {
          formatter: (val: number) => {
            if (typeof val !== 'number' || isNaN(val)) {
              return '0.00 kg';
            }
            return `${val.toFixed(2)} kg`;
          },
        },
      },
      grid: {
        show: false, // ✅ Ocultar todas las líneas del grid
      },
      markers: {
        size: 4,
        strokeWidth: 2,
        strokeColors: '#fff',
        hover: {
          size: 6,
        },
      },
    };
  }
}
