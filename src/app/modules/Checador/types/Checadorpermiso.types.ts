import { EstadoPermiso } from '../../ViewAll/Permisos/permisos.service';
import { CatalogoPermiso } from './Catalogopermiso.types';

export interface ChecadorPermiso {
  id: number;
  user_firebird_identity_id: number;
  checador_catalogo_permiso_id: number;
  tipo: 'normal' | 'extraordinario' | null;
  fecha_inicio: string;
  fecha_fin: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  no_regresa: boolean;
  tipo_pago_tiempo: 'tiempo_por_tiempo' | 'dia_descanso' | 'sin_goce' | null;
  minutos_ausencia: number | null;
  fecha_reposicion: string | null;
  hora_inicio_reposicion: string | null;
  hora_fin_reposicion: string | null;
  justificacion_pago_tiempo: string | null;
  permiso_origen_id: number | null;
  motivo: string;
  estado: EstadoPermiso;
  estado_rh: EstadoPermiso | 'no_aplica';
  estado_jefe: EstadoPermiso | 'no_aplica';
  comentarios_rh?: string | null;
  comentarios_jefe?: string | null;
  fecha_resolucion_rh?: string | null;
  fecha_resolucion_jefe?: string | null;
  aprobado_por_jefe?: number | null;
  catalogo?: CatalogoPermiso;
  comentarios_aprobador?: string;
  identity?: {
    id: number;
    nombre: string | null;
    apellido: string | null;
    area?: { id: number; nombre: string } | null;
    puesto?: { id: number; nombre: string } | null;
     puestoActivo?: {
      jefe_id: number | null;
      jefe_aux_id: number | null;
    } | null;
  };
  created_at?: string;
}
