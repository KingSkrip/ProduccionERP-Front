export interface Cita {
  id?: number;
  ids?: number[];                              // ← proveedor: grupo de ids
  visitantes?: { id: number; nombre: string }[]; // ← proveedor: lista
  con_vehiculo?: boolean;                      // ← proveedor
  id_visitante?: number;
  paciente: string;
  motivo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  notas?: string;
  dia?: string;
  mes?: string;
  
   usuario_id?: number;
   esExterna?: boolean;
   nombre_proveedor?: string;
}