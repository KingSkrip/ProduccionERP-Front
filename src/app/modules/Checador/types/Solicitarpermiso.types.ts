export interface SolicitarPermisoPayload {
  checador_catalogo_permiso_id: number;
  tipo?: 'normal' | 'extraordinario';
  fecha_inicio: string;
  fecha_fin: string;
  hora_inicio?: string;
  hora_fin?: string;
  no_regresa: boolean;
  motivo: string;
  tipo_pago_tiempo?: 'tiempo_por_tiempo' | 'dia_descanso' | 'sin_goce';
  fecha_reposicion?: string;
  hora_inicio_reposicion?: string;
  hora_fin_reposicion?: string;
  justificacion_pago_tiempo?: string;
}
