// Tipo para la tabla vacaciones
export type Vacacion = {
  id: number;
  user_id: number;
  anio: number;           // año de la vacaciones
  dias_totales: number;   // total de días de vacaciones asignados
  dias_disfrutados: number; // días ya utilizados
  created_at?: string;    // opcional, fecha de creación
  updated_at?: string;    // opcional, fecha de actualización
};

// Tipo para el historial de vacaciones
export type VacacionHistorial = {
  id: number;
  vacacion_id: number;     // relación con Vacacion
  fecha_inicio: string;    // inicio del periodo de vacaciones
  fecha_fin: string;       // fin del periodo
  dias: number;            // número de días disfrutados en este periodo
  comentarios?: string;    // comentarios opcionales
  created_at?: string;
  updated_at?: string;
};
