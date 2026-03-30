export interface Cita {
  id: number;
  id_visitante: number;
  paciente: string;
  motivo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: 'confirmada' | 'pendiente' | 'cancelada';
  notas?: string;
  dia?: string;
  mes?: string;
}