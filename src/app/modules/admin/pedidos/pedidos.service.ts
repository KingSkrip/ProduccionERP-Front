import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Observable } from 'rxjs';

// ─── Interfaces actualizadas con los campos reales del SP ─────────────────────

export interface Partida {
  CVE_PED: string;
  ARTICULO: string;
  CANTIDAD: number;
}

export interface Cardigan {
  CVE_PED: string;
  DESCRIPCION: string;
  CANTIDAD: number;
}

export interface Pedido {
  id: number;
  anio: number;
  cve_ped: string;       // = columna PEDIDO del SP (ej: 260181)
  pedido_n: string;      // = PEDIDON (ej: 181)
  cve_clie: string;      // = CVE_CTE sanitizado (ej: "122")
  nombre: string;        // = CLIENTE
  referencia: string;    // = REFERENCIA
  tipo_venta: string;
  estatus: string;       // ACTIVO / etc
  autorizado: string;
  condicion: string;     // "Credito" | "Sin definir"
  credito: string;       // "SI" | "NO"
  dias_credito: number;
  agente: string;
  fecha_elab: string | null;
  fecha_entrega: string | null;
  fecha_pago: string | null;
  usuario: string;
  observaciones: string;
  status: string;        // "Completo" | "Parcial" | "Sin Def."
  partidas: Partida[];
  cardigans: Cardigan[];
}

export interface ResumenPedidos {
  total_pedidos: number;
  pedidos_vencidos: number;
  completos: number;
  parciales: number;
  sin_def: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  anio?: number;
  message?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private _apiUrl = `${APP_CONFIG.apiUrl}clientes/pedidos`;

  constructor(private _httpClient: HttpClient) {}

  getPedidos(): Observable<ApiResponse<Pedido[]>> {
    return this._httpClient.get<ApiResponse<Pedido[]>>(this._apiUrl);
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
    return this._httpClient.post(`${this._apiUrl}/descargar-multiples`, { pedidos }, { responseType: 'blob' });
  }

  enviarPorEmail(cvePed: string, email: string): Observable<ApiResponse<void>> {
    return this._httpClient.post<ApiResponse<void>>(`${this._apiUrl}/${cvePed}/email`, { email });
  }
}