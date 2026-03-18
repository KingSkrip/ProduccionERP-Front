import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Observable } from 'rxjs';

export interface ClienteConPedidos {
  cve_clie: string;
  nombre: string;
  pedidos: Pedido[];
  totalPedidos: number;
  completos: number;
  parciales: number;
  sinDef: number;
}

export interface Partida {
  CVE_PED: string;
  ARTICULO: string;
  CANTIDAD: number | string;
}

export interface Cardigan {
  CVE_PED: string;
  DESCRIPCION: string;
  CANTIDAD: number | string;
}

export interface Pedido {
  id: number;
  anio: number;
  cve_ped: string; // = columna PEDIDO del SP (ej: 260181)
  pedido_n: string; // = PEDIDON (ej: 181)
  cve_clie: string; // = CVE_CTE sanitizado (ej: "122")
  nombre: string; // = CLIENTE
  referencia: string; // = REFERENCIA
  tipo_venta: string;
  estatus: string; // ACTIVO / etc
  autorizado: string;
  condicion: string; // "Credito" | "Sin definir"
  credito: string; // "SI" | "NO"
  dias_credito: number;
  agente: string;
  fecha_elab: string | null;
  fecha_entrega: string | null;
  fecha_pago: string | null;
  usuario: string;
  observaciones: string;
  status: string; // "Completo" | "Parcial" | "Sin Def."
  articulos: Partida[];
  cardigans: Cardigan[];
   kg_total: number;
}

export interface ResumenPedidos {
  total_pedidos: number;
  pedidos_vencidos: number;
  completos: number;
  parciales: number;
  sin_def: number;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total_clients: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  pagination?: PaginationMeta;
  anio?: number;
  message?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private _apiUrl = `${APP_CONFIG.apiUrl}agentes/pedidos`;

  constructor(private _httpClient: HttpClient) {}

getPedidos(page = 1, perPage = 5, condicion = 'todas'): Observable<ApiResponse<Pedido[]>> {
  return this._httpClient.get<ApiResponse<Pedido[]>>(this._apiUrl, {
    params: { page: page.toString(), per_page: perPage.toString(), condicion },
  });
}

  getDetallePedido(cvePed: string): Observable<{
    success: boolean;
    articulos: Partida[];
    cardigans: Cardigan[];
  }> {
    return this._httpClient.get<any>(`${this._apiUrl}/${cvePed}/detalle`);
  }

  getResumen(): Observable<ApiResponse<ResumenPedidos>> {
    return this._httpClient.get<ApiResponse<ResumenPedidos>>(`${this._apiUrl}/resumen`);
  }

  getPedidosPorAnio(anio: number): Observable<ApiResponse<Pedido[]>> {
    return this._httpClient.get<ApiResponse<Pedido[]>>(`${this._apiUrl}/anio/${anio}`);
  }

  getPedido(cvePed: string): Observable<ApiResponse<Pedido>> {
    return this._httpClient.get<ApiResponse<Pedido>>(`${this._apiUrl}/${cvePed}`);
  }

  descargarPDF(cvePed: string): Observable<Blob> {
    return this._httpClient.get(`${this._apiUrl}/${cvePed}/pdf`, { responseType: 'blob' });
  }

  descargarMultiples(pedidos: string[]): Observable<Blob> {
    return this._httpClient.post(
      `${this._apiUrl}/descargar-multiples`,
      { pedidos },
      { responseType: 'blob' },
    );
  }

  enviarPorEmail(cvePed: string, email: string): Observable<ApiResponse<void>> {
    return this._httpClient.post<ApiResponse<void>>(`${this._apiUrl}/${cvePed}/email`, { email });
  }
}
