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

export interface ClienteAgrupado {
  clave: string;
  nombre: string;
  rfc: string;
  status: string;
  total_saldo: number;
  total_cargos: number;
  total_abonos: number;
  total_documentos: number;
  documentos_vencidos: number;
  monto_vencido: number;
  documentos: EstadoCuenta[];
  expandido: boolean;
}

export interface ResumenEstadoCuenta {
  vendedor?: {
    cve_vend: string;
  };
  cliente?: {
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
  private _apiUrl = `${APP_CONFIG.apiUrl}estados-Cu3nt4Ag3nT32`;

  constructor(private _httpClient: HttpClient) {}

  getEstadosCuenta(): Observable<ApiResponse<EstadoCuenta[]>> {
    return this._httpClient.get<ApiResponse<EstadoCuenta[]>>(this._apiUrl);
  }

  getResumen(): Observable<ApiResponse<ResumenEstadoCuenta>> {
    return this._httpClient.get<ApiResponse<ResumenEstadoCuenta>>(`${this._apiUrl}/resumen`);
  }

  getEstadoCuenta(documento: string): Observable<ApiResponse<EstadoCuenta>> {
    return this._httpClient.get<ApiResponse<EstadoCuenta>>(`${this._apiUrl}/${documento}`);
  }

  getEstadosCuentaPorAnio(anio: number): Observable<ApiResponse<EstadoCuenta[]>> {
    return this._httpClient.get<ApiResponse<EstadoCuenta[]>>(`${this._apiUrl}/anio/${anio}`);
  }

  descargarPDF(documento: string): Observable<Blob> {
    return this._httpClient.get(`${this._apiUrl}/${documento}/pdf`, { responseType: 'blob' });
  }

  descargarMultiples(documentos: string[]): Observable<Blob> {
    return this._httpClient.post(
      `${this._apiUrl}/descargar-multiples`,
      { documentos },
      { responseType: 'blob' },
    );
  }

  enviarPorEmail(documento: string, email: string): Observable<ApiResponse<any>> {
    return this._httpClient.post<ApiResponse<any>>(`${this._apiUrl}/${documento}/enviar-email`, {
      email,
    });
  }

  actualizarEstado(documento: string, status: string): Observable<ApiResponse<any>> {
    return this._httpClient.patch<ApiResponse<any>>(`${this._apiUrl}/${documento}/estado`, {
      status,
    });
  }

  eliminarEstadoCuenta(documento: string): Observable<ApiResponse<void>> {
    return this._httpClient.delete<ApiResponse<void>>(`${this._apiUrl}/${documento}`);
  }

  /**
   * Agrupar estados de cuenta por cliente
   */
  agruparPorCliente(estadosCuenta: EstadoCuenta[]): ClienteAgrupado[] {
    const hoy = new Date();
    const mapaClientes = new Map<string, ClienteAgrupado>();

    for (const ec of estadosCuenta) {
      if (!mapaClientes.has(ec.clave)) {
        mapaClientes.set(ec.clave, {
          clave: ec.clave,
          nombre: ec.nombre,
          rfc: ec.rfc,
          status: ec.status,
          total_saldo: ec.total_saldo,
          total_cargos: 0,
          total_abonos: 0,
          total_documentos: 0,
          documentos_vencidos: 0,
          monto_vencido: 0,
          documentos: [],
          expandido: false,
        });
      }

      const cliente = mapaClientes.get(ec.clave)!;
      cliente.documentos.push(ec);
      cliente.total_cargos += ec.cargos;
      cliente.total_abonos += ec.abonos;
      cliente.total_documentos++;

      if (ec.saldo > 0 && new Date(ec.fecha_vencimiento) < hoy) {
        cliente.documentos_vencidos++;
        cliente.monto_vencido += ec.saldo;
      }
    }

    return Array.from(mapaClientes.values()).sort((a, b) => b.total_saldo - a.total_saldo);
  }
}