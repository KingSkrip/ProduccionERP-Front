export interface TurnoDia {
  dia_semana: number;
  es_laborable: boolean;
  es_descanso: boolean;
  hora_entrada: string | null;
  hora_salida: string | null;
  entra_dia_anterior: boolean;
  sale_dia_siguiente: boolean;
}