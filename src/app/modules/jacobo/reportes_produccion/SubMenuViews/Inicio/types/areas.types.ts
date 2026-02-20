export interface AreaDetalle {
  departamento: string;
  proceso: string;
  cantidad: number;
  piezas: number;
}

export interface AreaMetric {
  label: string;
  value: number;
  format?: 'currency' | 'decimal' | 'number';
}

export interface AreaResumen {
  nombre: string;
  icon: string;
  color: string;
  metrics: AreaMetric[];
  loading: boolean;
  detalles?: AreaDetalle[];
}
