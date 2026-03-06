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

// 'total' = vista de importes | 'peso' = vista de cantidades por día
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
    };
  } = {};
  totalesFacturado: FacturadoTotales | null = null;
  detalleFacturado: FacturadoDetalle[] = [];
  subtotalesPorDia: SubtotalPorDia[] = [];
  filtros: any = null;
  loading = true;

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

  // KGs únicos por UM agrupados del total
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
      dia._facturas.add(item.factura); // ← facturas únicas, no partidas
      dia.cant += item.cant ?? 0;
      dia.importe += item.importe ?? 0;
      dia.impuestos += item.impuestos ?? 0; // ← leer IVA directo del item
      dia.total += item.total ?? 0;
    }

    return Array.from(mapa.values())
      .map(({ _facturas, ...dia }) => ({ ...dia, facturas: _facturas.size })) // ← contar únicas
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

    // Agregar días con facturas
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

    // Mezclar días con notas de venta
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
}
