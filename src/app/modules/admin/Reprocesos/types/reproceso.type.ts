export interface Reproceso {
  ORDEN: string;
  NESTATUS: number | null;
  ESTATUS: string | null;
  PEDIDO: string | null;
  PARTIDA: number | null;
  FECHA: string | null;
  CLIENTE: string | null;
  ARTICULO: string | null;
  CANTIDAD: number | null;
  'CANT. ENT.': number | null;
  COMPOSICION: string | null;
  ANCHO: string | null;
  PESO: number | null;
  'CODIGO COLOR': string | null;
  COLOR: string | null;
  ESTAMPADO: string | null;
  DIBUJO: string | null;
  'NOMBRE DIB.': string | null;
  VARIANTE: string | null;
  ROLLOS: number | null;
  LOTE: string | null;
  USUARIO: string | null;
  CVE_RUTA: number | null;
  RUTA: string | null;
  REPROCESO: number | null;
  REP: number | null;
  AGENTE: string | null;
  CVE_ORDEN: number | null;
  RPC: number | null;
  OBS: string | null;
  TIPO_REPORTE: string | null;
  ESTATUS_REPORTE: number | null;
  FOLIO: string | null;
  IDREPRRM: number;
}

export interface ReprocesosFiltros {
  buscar?: string;
  page?: number;
  per_page?: number;
}

export interface ReprocesosPaginado {
  data: Reproceso[];
  total: number;
  page: number;
  per_page: number;
  last_page: number;
}