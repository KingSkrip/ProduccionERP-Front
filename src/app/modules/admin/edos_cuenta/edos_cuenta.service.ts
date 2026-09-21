import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Observable } from 'rxjs';

export interface EstadoCuenta {
  clave: string;
  nombre: string;
  rfc: string;
  status: string;
  documento: string;
  fecha_aplicacion: string;
  fecha_vencimiento: string;
  cargos: number;
  abonos: number;
  saldo: number;
  total_saldo: number;
  total: number;
  total_cargos: number;
  total_abonos: number;
  total_saldos: number;
}

export interface ResumenEstadoCuenta {
  cliente: {
    clave: string;
    nombre: string;
    rfc: string;
    status: string;
  };
  totales: {
    cargos: number;
    abonos: number;
    saldo_total: number;
  };
  documentos: {
    total: number;
    vencidos: number;
    monto_vencido: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  total_cargos?: number;
  total_abonos?: number;
  total_saldos?: number;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class EdosCuentaService {
  private _apiUrl = `${APP_CONFIG.apiUrl}estados-cuenta`;

  constructor(private _httpClient: HttpClient) {}

  /**
   * Obtener todos los estados de cuenta del usuario
   */
  getEstadosCuenta(): Observable<ApiResponse<EstadoCuenta[]>> {
    return this._httpClient.get<ApiResponse<EstadoCuenta[]>>(this._apiUrl);
  }

  /**
   * Obtener resumen de estados de cuenta
   */
  getResumen(): Observable<ApiResponse<ResumenEstadoCuenta>> {
    return this._httpClient.get<ApiResponse<ResumenEstadoCuenta>>(`${this._apiUrl}/resumen`);
  }

  /**
   * Obtener estado de cuenta por documento
   */
  getEstadoCuenta(documento: string): Observable<ApiResponse<EstadoCuenta>> {
    return this._httpClient.get<ApiResponse<EstadoCuenta>>(`${this._apiUrl}/${documento}`);
  }

  /**
   * Obtener estados de cuenta por año
   */
  getEstadosCuentaPorAnio(anio: number): Observable<ApiResponse<EstadoCuenta[]>> {
    return this._httpClient.get<ApiResponse<EstadoCuenta[]>>(`${this._apiUrl}/anio/${anio}`);
  }

  /**
   * Descargar PDF de un estado de cuenta
   */
  descargarPDF(documento: string): Observable<Blob> {
    return this._httpClient.get(`${this._apiUrl}/${documento}/pdf`, {
      responseType: 'blob',
    });
  }

  /**
   * Descargar múltiples estados de cuenta
   */
  descargarMultiples(documentos: string[]): Observable<Blob> {
    return this._httpClient.post(
      `${this._apiUrl}/descargar-multiples`,
      { documentos },
      { responseType: 'blob' },
    );
  }

  /**
   * Enviar estado de cuenta por email
   */
  enviarPorEmail(documento: string, email: string): Observable<ApiResponse<any>> {
    return this._httpClient.post<ApiResponse<any>>(`${this._apiUrl}/${documento}/enviar-email`, {
      email,
    });
  }

  /**
   * Actualizar estado de un documento
   */
  actualizarEstado(documento: string, status: string): Observable<ApiResponse<any>> {
    return this._httpClient.patch<ApiResponse<any>>(`${this._apiUrl}/${documento}/estado`, {
      status,
    });
  }

  /**
   * Eliminar estado de cuenta
   */
  eliminarEstadoCuenta(documento: string): Observable<ApiResponse<void>> {
    return this._httpClient.delete<ApiResponse<void>>(`${this._apiUrl}/${documento}`);
  }
}
