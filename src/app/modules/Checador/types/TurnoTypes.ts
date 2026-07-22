import { TurnoDia } from "./TurnoDia";

export interface Turno {
  id: number;
  firebird_empresa: string;
  clave: string;
  nombre: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  entra_dia_anterior: boolean;
  sale_dia_siguiente: boolean;
  status_id: number;
  dias: TurnoDia[];
}