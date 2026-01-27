export interface FacturaDetalle {
  cliente: string;
  factura: string;
  fecha: string;
  cant: number;
  um: string;
  importe: number;
  impuestos: number;
  total: number;
}

export interface ClienteAgrupado {
  cliente: string;
  facturas: FacturaDetalle[];
  cantidadesPorUnidad: Record<string, number>;
  importeTotal: number;
  impuestosTotal: number;
  totalFacturado: number;
  expandido: boolean;
}
