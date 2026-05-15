export interface ScanEmbarque {
 CODIGO:     string;
  CODIGOENT:  number;
  FECHAYHORA: string;
  PROCESADO:  number;
}

export interface ScanEmbarquesResponse {
  data: ScanEmbarque[];
}