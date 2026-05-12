export interface Cita {
  id?: number;
  ids?: number[];
  visitantes?: { id: number; nombre: string; firebird_user_clave?: number }[];
  con_vehiculo?: boolean;
  id_visitante?: number;
  paciente: string;
  motivo: string;
  fecha: string;
  horaInicio: string;
  lugar?: string;
  horaFin: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  notas?: string;
  dia?: string;
  mes?: string;
  usuario_id?: number;
  esExterna?: boolean;
  nombre_proveedor?: string;
  cita_type_id?: number;
  id_user?: number;
  sala?: string;
  firebird_user_clave?: number;
  
  nombre_visitante?: string;
  asistencia?: string;
  visitante?: {
    id: number;
    firebird_user_clave?: number;
    firebird_tb_clave?: number;
    firebird_empresa?: string;
  };
} 