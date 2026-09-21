export interface ScanEmbarque {
 CODIGO:     string;
  CODIGOENT:  number;
  FECHAYHORA: string;
  PROCESADO:  number;
}

export interface ScanEmbarquesResponse {
  data: ScanEmbarque[];
}


export interface ItemInventario {
  codigo: string;
  fechaHora: Date;
  estado: 'ya_inventariado' | 'no_inventariado' | 'invalido';
}