import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { fuseAnimations } from '@fuse/animations';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { FacturadoResumenResponse, ReportProdService } from '../../../reportprod.service';
import { SharedDataService } from '../../shared-data.service';

interface FacturaDetalle {
  cliente: string;
  factura: string;
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

@Component({
  selector: 'tabs-facturado-tab',
  templateUrl: './facturado-tab.component.html',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, MatButtonModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: fuseAnimations,
})
export class FacturadoTabComponent implements OnInit, OnDestroy {
  // Datos originales y agrupados
  datosOriginales: FacturadoResumenResponse | null = null;
  datosAgrupados: ClienteAgrupado[] = [];
  totalFacturado = 0;

  // Estados
  isLoading = false;
  cargaInicial = false;
  datosFacturadoOriginal: any = null;
  importeTotalSinIva = 0;
  impuestosTotal = 0;
  totalConIva = 0;
  totalFacturas = 0;

  subtotalGeneral = 0;
  impuestosGeneral = 0;
  totalFacturadoConNV = 0;

  private readonly CONVERSION_RATES = {
    LB_TO_KG: 0.453592,
    KG_TO_LB: 2.20462,
    OZ_TO_G: 28.3495,
    G_TO_OZ: 0.035274,
    OZ_TO_KG: 0.0283495,
    G_TO_KG: 0.001,
  };
  cantPTPR: number = 0;
  cantKG: number = 0;
  TotalKG: number = 0;
  cantHilos: number = 0;
  cantLB: number = 0;
  cantLBtoKG: number = 0;
  cantNotasVentaPTPR: number = 0;
  devolucionesCantPTPR: number = 0;
  devolucionesKG: number = 0;
  z100Tela: number = 0;
  Notas_VentaKG: number = 0;
  GTTela: number = 0;
  TotalG: number = 0;
  facatPTPR: number = 0;
  facatHilos: number = 0;
  devolucionesSubtotal: number = 0;
  z100TelaFact: number = 0;
  notasVentaTotal: number = 0;
  TotalFG: number = 0;
  private _unsubscribeAll = new Subject<void>();

  constructor(
    private _cd: ChangeDetectorRef,
    private _reportService: ReportProdService,
    private _snackBar: MatSnackBar,
    private _sharedDataService: SharedDataService,
  ) {}

  ngOnInit(): void {
    this._sharedDataService.datosFacturado$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((resp) => {
        const payload = resp?.data ?? resp;
        const porLinea = payload?.por_linea ?? {};
        const notasPorLinea = payload?.notas_venta?.por_linea ?? {};
        const devoluciones = payload?.devoluciones ?? {};
        const devPorLinea = devoluciones?.por_linea ?? {};
        // PESO
        this.cantPTPR = Number(porLinea['PTPR']?.cant_kg_eq) || 0;
        //DEVOLUCIONES
        this.devolucionesKG = Number(devPorLinea['PTPR']?.cant_kg_eq) || 0;
        //NOTA DE VENTA
        this.Notas_VentaKG = Number(notasPorLinea['PTPR']?.cant) || 0;
        //OPERACION
        this.z100Tela = this.cantPTPR - this.devolucionesKG;
        //GRANTOTAL- PESO
        //TELA
        this.GTTela = this.z100Tela + this.Notas_VentaKG;
        //TELA
        this.cantHilos = Number(porLinea['HILOS']?.cant_kg_eq) || 0;
        //FINAL
        this.TotalG = this.GTTela + this.cantHilos;

        // FACTURADO-hilos
        this.facatHilos = Number(porLinea['HILOS']?.importe) || 0;
        // FACTURADO-tela
        this.facatPTPR = Number(porLinea['PTPR']?.total) || 0;
        //DEVOLUCIONES:
        this.devolucionesSubtotal = Number(devoluciones?.subtotal) || 0;
        //RESTA DE Z100
        this.z100TelaFact = this.facatPTPR - this.devolucionesSubtotal;
        //NOTAS DE VENTA
        this.notasVentaTotal = Number(payload?.notas_venta?.total) || 0;
        //GRAN TOTAL
        this.GTTela = this.z100TelaFact + this.notasVentaTotal;
        //FINAL
        this.TotalFG = this.facatHilos + this.GTTela;
        this._cd.markForCheck();
      });

    // Escuchar cambios en filtros globales
    this._sharedDataService.filtrosGlobales$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((filtros) => {
        if (this.cargaInicial) {
          this.aplicarFiltrosYAgrupar(filtros);
        }
      });

    // Escuchar cambios en fechas para recargar datos
    this._sharedDataService.recargarDatos$
      .pipe(
        takeUntil(this._unsubscribeAll),
        filter((recargar) => recargar === true),
      )
      .subscribe(() => {
        const filtros = this._sharedDataService.obtenerFiltros();
        this.cargarFacturado(filtros.fechaInicio, filtros.fechaFin);
        this._sharedDataService.confirmarRecargaConsumida();
      });

    // Carga inicial
    const filtros = this._sharedDataService.obtenerFiltros();
    this.cargarFacturado(filtros.fechaInicio, filtros.fechaFin);
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next();
    this._unsubscribeAll.complete();
  }

  private aplicarFiltrosYAgrupar(filtros: any): void {
    if (!this.datosOriginales?.detalle) {
      this.datosAgrupados = [];
      this.totalFacturado = 0;
      this._cd.markForCheck();
      return;
    }

    const busqueda = filtros.busqueda?.toLowerCase() || '';

    // Filtrar detalle
    const detalleFiltrado = this.datosOriginales.detalle.filter((item: FacturaDetalle) => {
      return (
        !busqueda ||
        item.cliente?.toLowerCase().includes(busqueda) ||
        item.factura?.toLowerCase().includes(busqueda)
      );
    });

    // Agrupar por cliente
    this.agruparPorCliente(detalleFiltrado);

    // Priorizar totales del backend si NO hay filtro de búsqueda
    if (!busqueda && this.datosOriginales.totales) {
      const totales = this.datosOriginales.totales;
      this.subtotalGeneral = totales.importe || 0;
      this.impuestosGeneral = totales.impuestos || 0;
      this.totalFacturado = totales.total || 0;
    } else {
      // Si hay filtro, recalcular desde agrupados
      this.subtotalGeneral = this.calcularImporteTotal();
      this.impuestosGeneral = this.calcularImpuestosTotal();
      this.totalFacturado = this.datosAgrupados.reduce(
        (sum, grupo) => sum + grupo.totalFacturado,
        0,
      );
    }

    this._cd.markForCheck();
  }

  private agruparPorCliente(detalle: FacturaDetalle[]): void {
    const agrupado = new Map<string, ClienteAgrupado>();

    detalle.forEach((item) => {
      const cliente = item.cliente || 'Sin cliente';

      if (!agrupado.has(cliente)) {
        agrupado.set(cliente, {
          cliente: cliente,
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

      // Agrupar cantidades por unidad de medida
      const unidad = item.um || 'N/A';
      if (!grupo.cantidadesPorUnidad[unidad]) {
        grupo.cantidadesPorUnidad[unidad] = 0;
      }
      grupo.cantidadesPorUnidad[unidad] += Number(item.cant) || 0;

      grupo.importeTotal += Number(item.importe) || 0;
      grupo.impuestosTotal += Number(item.impuestos) || 0;
      grupo.totalFacturado += Number(item.total) || 0;
    });

    // Convertir a array y ordenar por total descendente
    this.datosAgrupados = Array.from(agrupado.values()).sort(
      (a, b) => b.totalFacturado - a.totalFacturado,
    );
  }

  cargarFacturado(fechaInicio?: Date | null, fechaFin?: Date | null): void {
    if (this.isLoading) return;

    this.isLoading = true;
    this._cd.markForCheck();

    this._reportService
      .getFacturado(fechaInicio || undefined, fechaFin || undefined, true)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (data: FacturadoResumenResponse) => {
          // Tipado explícito
          this.datosOriginales = data;
          this.cargaInicial = true;
          const totales = data.totales || {};
          this.subtotalGeneral = data.totales?.importe ?? 0;
          this.impuestosGeneral = data.totales?.impuestos ?? 0;
          this.totalFacturado = data.totales?.total ?? 0;

          // Opcional: total con notas de venta
          const notasVenta = data.notas_venta?.total || 0;
          this.totalFacturadoConNV = this.totalFacturado + notasVenta;

          // Aplicar filtros y agrupar
          const filtros = this._sharedDataService.obtenerFiltros();
          this.aplicarFiltrosYAgrupar(filtros);

          // Actualizar servicio compartido
          this._sharedDataService.actualizarFacturado(data);

          this.isLoading = false;
          this._cd.markForCheck();
        },
        error: (err) => {
          console.error('Error al cargar facturado:', err);
          this._snackBar.open('Error al cargar datos de facturado', 'Cerrar', { duration: 3000 });
          this.isLoading = false;
          this._cd.markForCheck();
        },
      });
  }

  toggleCliente(index: number): void {
    this.datosAgrupados[index].expandido = !this.datosAgrupados[index].expandido;
    this._cd.markForCheck();
  }

  calcularTotalFacturas(): number {
    return this.datosAgrupados.reduce((sum, grupo) => sum + grupo.facturas.length, 0);
  }

  calcularCantidadTotal(): number {
    let total = 0;
    this.datosAgrupados.forEach((grupo) => {
      Object.values(grupo.cantidadesPorUnidad).forEach((cantidad) => {
        total += cantidad;
      });
    });
    return total;
  }

  calcularCantidadTotalPorUnidad(): { [key: string]: number } {
    let totalKG = 0;

    this.datosAgrupados.forEach((grupo) => {
      Object.entries(grupo.cantidadesPorUnidad).forEach(([unidad, cantidad]) => {
        const unidadUpper = unidad.toUpperCase();

        // Convertir todo a KG
        if (unidadUpper === 'KG' || unidadUpper === 'KGS') {
          totalKG += cantidad;
        } else if (unidadUpper === 'LB' || unidadUpper === 'LBS') {
          totalKG += cantidad * this.CONVERSION_RATES.LB_TO_KG;
        } else if (unidadUpper === 'OZ') {
          totalKG += cantidad * this.CONVERSION_RATES.OZ_TO_KG;
        } else if (unidadUpper === 'G' || unidadUpper === 'GR') {
          totalKG += cantidad * this.CONVERSION_RATES.G_TO_KG;
        }
        // Otras unidades se ignoran para el cálculo de peso
      });
    });

    // Retornar solo KG
    return { KG: totalKG };
  }

  calcularImporteTotal(): number {
    return this.datosAgrupados.reduce((sum, grupo) => sum + grupo.importeTotal, 0);
  }

  calcularImpuestosTotal(): number {
    return this.datosAgrupados.reduce((sum, grupo) => sum + grupo.impuestosTotal, 0);
  }

  limpiarFiltrosLocales(): void {
    this._sharedDataService.actualizarFiltros({
      busqueda: '',
      departamento: '',
      proceso: '',
    });
  }

  formatValue(value: number, type: 'decimal' | 'currency' = 'decimal'): string {
    if (value == null) return '0';

    if (type === 'currency') {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }).format(value);
    }

    // decimal
    return new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
