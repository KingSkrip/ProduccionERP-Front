export interface Puesto {
  id: number;
  nombre: string;
  descripcion: string | null;
  es_gerente: boolean;
  es_jefe_area: boolean;
  es_rh: boolean;
  es_subordinado: boolean;
  activo: boolean;
}