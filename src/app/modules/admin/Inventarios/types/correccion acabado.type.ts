export interface CorreccionAcabadoRequest {
  rollo: string; // ej. "0000413013"
}

export interface RolloAcabadoDatos {
  ID: number;
  ID_QR: string;
  'CVE ART': string;
  ARTICULO: string;
  CLIENTE: string;
  PEDIDO: number | string;
  OP: number | string;
  PEDIDOPART: number | string | null;
  'COD. COLOR': string;
  COLOR: string;
  TIPO_COD: number;
  TIPO: string;
  'PESO NETO': number;
  PIEZA: number | string;
  PSD_ESTATUS: number | string | null;
  ORDEN: number | string | null;
  OE_ESTATUS: number | null;
  PESO_BRUTO?: number;
TARA?: number;
LONGITUD?: number;
TONO?: string | null;
FECHA?: string | null;
MUESTRA?: number | string | null;
PL?: number | boolean | null;
}

export interface CorreccionAcabadoResponse {
  ok: boolean;
  rollo: string;
  clave: number;
  id_rollo: number;
  pieza: number | string | null;
  op: string;
  datos: RolloAcabadoDatos;
  peso: number;
}

export interface CorreccionAcabadoError {
  ok: false;
  motivo?: 'rollo_invalido' | 'rollo_no_encontrado';
  error?: string;
  rollo?: string;
}

export interface ArticuloCAResponse {
  ok: boolean;
  id: number;
  articulo: string;
  ancho: number;
  ancho_yds: number;
  gramaje: number;
  gramaje_oz: number;
  rendimiento: number;
  rendimiento_yd_lb: number;
}


export interface EditCAItem {
  rollo: string;
  op?: string | null;
  pieza?: number | string | null;
  articulo?: string | null;
  ancho?: number | null; // mts
  anchoYds?: number | null; // yds
  gramaje?: number | null; // grs/m2
  gramajeOz?: number | null; // oz/yd2
  rendimiento?: number | null; // m/Kg
  rendimientoYdLb?: number | null; // yd/Lb
  peso?: number | null; // kg
}

export interface EditCAResultado {
  rollo: string;
  cantidad: number;
  unidad: UnidadCA;
  precio: number;
  moneda: MonedaCA;
  kilogramos: number | null;
  libras: number | null;
  metros: number | null;
  yardas: number | null;
}

export type UnidadCA = 'KGS' | 'LBS' | 'MTS' | 'YDS';
export type MonedaCA = 'MXN' | 'USD';



