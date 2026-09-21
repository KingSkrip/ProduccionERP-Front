
export interface CatalogoPermiso {
  id: number;
  nombre: string;
  clave?: string;
  descripcion?: string | null;
  duracion_default_minutos?: number | null;
  requiere_aprobacion?: boolean;
  requiere_horario?: boolean;
}
