import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { SharedDataService } from '../../../../list/shared-data.service';

export interface FacturadoDetalle {
  cliente: string;
  factura: string;
  fecha: string;
  cant: number;
  um: string;
  importe: number;
  impuestos: number;
  total: number;
  linea?: string;
}

export interface FacturadoTotales {
  facturas: number;
  cant: number;
  importe: number;
  impuestos: number;
  total: number;
}

export interface SubtotalPorDia {
  fecha: string;
  facturas: number;
  cant: number;
  importe: number;
  impuestos: number;
  total: number;
}

export interface NotasVentaResumen {
  registros: number;
  total: number;
  unidades?: { um: string; cant: number }[];
}

export interface LineaResumen {
  total: number;
  cant: number;
}

export type ModoComposer = 'total' | 'peso';

@Component({
  selector: 'composer-facturado',
  templateUrl: './composerfacturado.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatTooltipModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
  ],
})
export class ComposerFacturadoComponent implements OnInit, OnDestroy {
  private _unsub = new Subject<void>();

  modo: ModoComposer = 'total';
  notasVentaTotal: NotasVentaResumen | null = null;
  notasVentaPorDia: {
    [fecha: string]: {
      registros: number;
      total_nv: number;
      unidades: { um: string; cant: number }[];
      por_linea: {
        [linea: string]: { cant: number; total: number };
      };
    };
  } = {};
  totalesFacturado: FacturadoTotales | null = null;
  detalleFacturado: FacturadoDetalle[] = [];
  subtotalesPorDia: SubtotalPorDia[] = [];
  filtros: any = null;
  loading = true;

  // Desglose por línea Z100
  porLineaHILOS: LineaResumen = { total: 0, cant: 0 };
  porLineaPTPR: LineaResumen = { total: 0, cant: 0 };

  // Desglose por línea Z200
  notasPorLineaHILOS: LineaResumen = { total: 0, cant: 0 };
  notasPorLineaPTPR: LineaResumen = { total: 0, cant: 0 };

  constructor(
    private _sharedData: SharedDataService,
    private _dialogRef: MatDialogRef<ComposerFacturadoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { modo: ModoComposer },
  ) {}

  ngOnInit(): void {
    this.modo = this.data?.modo ?? 'total';
    this.filtros = this._sharedData.obtenerFiltros();

    this._sharedData.datosFacturado$.pipe(takeUntil(this._unsub)).subscribe((data) => {
      if (!data) return;
      this.totalesFacturado = data.totales ?? null;
      this.detalleFacturado = data.detalle ?? [];
      this.subtotalesPorDia = this._agruparPorDia(this.detalleFacturado);
      this.notasVentaTotal = data.notas_venta ?? null;
      this.notasVentaPorDia = data.notas_venta_por_dia ?? {};

      // Leer desglose por línea
      const porLinea = data.por_linea ?? {};
      const notasPorLinea = data.notas_venta?.por_linea ?? {};

      this.porLineaHILOS = {
        total: Number(porLinea['HILOS']?.total) || 0,
        cant: Number(porLinea['HILOS']?.cant) || 0,
      };
      this.porLineaPTPR = {
        total: Number(porLinea['PTPR']?.total) || 0,
        cant: Number(porLinea['PTPR']?.cant) || 0,
      };
      this.notasPorLineaHILOS = {
        total: Number(notasPorLinea['HILOS']?.total) || 0,
        cant: Number(notasPorLinea['HILOS']?.cant) || 0,
      };
      this.notasPorLineaPTPR = {
        total: Number(notasPorLinea['PTPR']?.total) || 0,
        cant: Number(notasPorLinea['PTPR']?.cant) || 0,
      };

      this.loading = false;
    });
  }

  ngOnDestroy(): void {
    this._unsub.next();
    this._unsub.complete();
  }

  cerrar(): void {
    this._dialogRef.close();
  }

  get resumenUMs(): { um: string; cant: number }[] {
    const mapa = new Map<string, number>();
    for (const item of this.detalleFacturado) {
      const um = item.um ?? 'N/A';
      mapa.set(um, (mapa.get(um) ?? 0) + (item.cant ?? 0));
    }
    return Array.from(mapa.entries()).map(([um, cant]) => ({ um, cant }));
  }

  private _agruparPorDia(detalle: FacturadoDetalle[]): SubtotalPorDia[] {
    const mapa = new Map<string, SubtotalPorDia & { _facturas: Set<string> }>();

    for (const item of detalle) {
      const fecha = item.fecha?.substring(0, 10) ?? 'Sin fecha';
      if (!mapa.has(fecha)) {
        mapa.set(fecha, {
          fecha,
          facturas: 0,
          cant: 0,
          importe: 0,
          impuestos: 0,
          total: 0,
          _facturas: new Set(),
        });
      }
      const dia = mapa.get(fecha)!;
      dia._facturas.add(item.factura);
      dia.cant += item.cant ?? 0;
      dia.importe += item.importe ?? 0;
      dia.impuestos += item.impuestos ?? 0;
      dia.total += item.total ?? 0;
    }

    return Array.from(mapa.values())
      .map(({ _facturas, ...dia }) => ({ ...dia, facturas: _facturas.size }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  get resumenPesoComposer() {
    const RATES: { [key: string]: number } = {
      KG: 1,
      KGS: 1,
      LB: 0.453592,
      LBS: 0.453592,
      OZ: 0.0283495,
      G: 0.001,
      GR: 0.001,
    };

    const mapa = new Map<string, number>();
    for (const item of this.detalleFacturado) {
      const um = (item.um ?? 'N/A').trim();
      mapa.set(um, (mapa.get(um) ?? 0) + (item.cant ?? 0));
    }

    const items = Array.from(mapa.entries()).map(([um, cant]) => {
      const rate = RATES[um.toUpperCase()] ?? 0;
      return { um, cant, kgEquivalente: cant * rate, esKG: rate === 1 };
    });

    const totalKG = items.reduce((sum, i) => sum + i.kgEquivalente, 0);
    return { items, totalKG };
  }

  // ─── Peso por línea Z100 ───
  get pesoHILOS(): number {
    return this.porLineaHILOS.cant;
  }
  get pesoPTPR(): number {
    return this.porLineaPTPR.cant;
  }

  // ─── Peso por línea Z200 ───
  get pesoNotasHILOS(): number {
    return this.notasPorLineaHILOS.cant;
  }
  get pesoNotasPTPR(): number {
    return this.notasPorLineaPTPR.cant;
  }

  // ─── Promedios Z100 ($/KG) ───
  get promedioHILOS(): number | null {
    return this.porLineaHILOS.cant > 0 ? this.porLineaHILOS.total / this.porLineaHILOS.cant : null;
  }
  get promedioPTPR(): number | null {
    return this.porLineaPTPR.cant > 0 ? this.porLineaPTPR.total / this.porLineaPTPR.cant : null;
  }

  // ─── Promedios Z200 ($/KG) ───
  get promedioNotasHILOS(): number | null {
    return this.notasPorLineaHILOS.cant > 0
      ? this.notasPorLineaHILOS.total / this.notasPorLineaHILOS.cant
      : null;
  }

  get promedioNotasPTPR(): number | null {
    return this.notasPorLineaPTPR.cant > 0
      ? (this.notasVentaTotal?.total ?? 0) / this.notasPorLineaPTPR.cant
      : null;
  }

  // ─── Totales generales por línea ───
  get totalGeneralHILOS(): number {
    return this.porLineaHILOS.total + this.notasPorLineaHILOS.total;
  }
  get totalGeneralPTPR(): number {
    return this.porLineaPTPR.total + (this.notasVentaTotal?.total ?? 0);
  }
  get pesoGeneralHILOS(): number {
    return this.porLineaHILOS.cant + this.notasPorLineaHILOS.cant;
  }
  get pesoGeneralPTPR(): number {
    return this.porLineaPTPR.cant + this.notasPorLineaPTPR.cant;
  }

  get diasUnificados(): {
    fecha: string;
    facturas: number;
    cant: number;
    importe: number;
    impuestos: number;
    total: number;
    notasVenta: {
      registros: number;
      total_nv: number;
      unidades: { um: string; cant: number }[];
    } | null;
    tieneFacturas: boolean;
  }[] {
    const mapa = new Map<string, any>();

    for (const dia of this.subtotalesPorDia) {
      const fecha = dia.fecha?.substring(0, 10) ?? '';
      mapa.set(fecha, {
        fecha,
        facturas: dia.facturas,
        cant: dia.cant,
        importe: dia.importe,
        impuestos: dia.impuestos,
        total: dia.total,
        notasVenta: null,
        tieneFacturas: true,
      });
    }

    for (const [fecha, nv] of Object.entries(this.notasVentaPorDia)) {
      if (mapa.has(fecha)) {
        mapa.get(fecha).notasVenta = nv;
      } else {
        mapa.set(fecha, {
          fecha,
          facturas: 0,
          cant: 0,
          importe: 0,
          impuestos: 0,
          TOTAL_NV: 0,
          notasVenta: nv,
          tieneFacturas: false,
        });
      }
    }

    return Array.from(mapa.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  get totalKGNotasVenta(): number {
    if (!this.notasVentaTotal?.unidades) return 0;
    const RATES: { [key: string]: number } = {
      KG: 1,
      KGS: 1,
      LB: 0.453592,
      LBS: 0.453592,
      OZ: 0.0283495,
      G: 0.001,
      GR: 0.001,
    };
    return this.notasVentaTotal.unidades.reduce((sum, u) => {
      const rate = RATES[(u.um ?? '').toUpperCase()] ?? 1;
      return sum + u.cant * rate;
    }, 0);
  }

  _lineasDia(dia: any): { key: string; total: number }[] {
    // filtra el detalle del día y agrupa por linea_producto
    const mapa = new Map<string, number>();
    for (const item of this.detalleFacturado) {
      const f = item.fecha?.substring(0, 10) ?? '';
      if (f !== dia.fecha?.substring(0, 10)) continue;
      const linea = (item as any).linea_producto ?? 'SIN_LINEA';
      mapa.set(linea, (mapa.get(linea) ?? 0) + (item.total ?? 0));
    }
    return Array.from(mapa.entries()).map(([key, total]) => ({ key, total }));
  }

  // KG por línea del día (Z100)
  _lineasDiaPeso(dia: any): { key: string; cant: number }[] {
    const mapa = new Map<string, number>();
    for (const item of this.detalleFacturado) {
      if ((item.fecha?.substring(0, 10) ?? '') !== dia.fecha?.substring(0, 10)) continue;
      const linea = (item as any).linea_producto ?? 'SIN_LINEA';
      mapa.set(linea, (mapa.get(linea) ?? 0) + (item.cant ?? 0));
    }
    return Array.from(mapa.entries()).map(([key, cant]) => ({ key, cant }));
  }

  // KG total Z200 del día (suma de unidades)
  _kgZ200Dia(dia: any): number {
    const nv = this.notasVentaPorDia[dia.fecha?.substring(0, 10) ?? ''];
    if (!nv?.unidades) return 0;
    return nv.unidades.reduce((s, u) => s + (u.cant ?? 0), 0);
  }

  _lineasDiaPesoOrdenado(dia: any): { key: string; cant: number }[] {
    const orden = ['PTPR', 'HILOS'];
    return this._lineasDiaPeso(dia).sort((a, b) => orden.indexOf(a.key) - orden.indexOf(b.key));
  }

  _lineasDiaOrdenado(dia: any): { key: string; total: number }[] {
    const orden = ['PTPR', 'HILOS'];
    return this._lineasDia(dia).sort((a, b) => orden.indexOf(a.key) - orden.indexOf(b.key));
  }
}
