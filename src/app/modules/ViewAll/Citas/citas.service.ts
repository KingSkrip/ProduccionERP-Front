import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Observable } from 'rxjs';

// Lo que devuelve el backend (GET)
export interface CitaAPI {
  id: number;
  id_user: number;
  id_visitante: number;
  nombre_visitante?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo?: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  notas?: string;
  usuario?: { id: number; nombre?: string };
  visitante?: { id: number; nombre?: string };
  con_vehiculo?: 0 | 1 | boolean;
  es_externa?: boolean;
  nombre_proveedor?: string;
}

// Lo que manda el frontend (POST/PUT) — el backend extrae id_user del JWT
export interface CitaPayload {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  nombre_visitante?: string;
  motivo?: string;
  visitantes?: number[];
  estado?: 'pendiente' | 'confirmada' | 'cancelada';
  notas?: string;
}

@Injectable({ providedIn: 'root' })
export class CitasService {
  private _apiUrl = `${APP_CONFIG.apiUrl}citas`;

  constructor(private _http: HttpClient) {}

  getCitas(): Observable<CitaAPI[]> {
    return this._http.get<CitaAPI[]>(this._apiUrl);
  }

  getCita(id: number): Observable<CitaAPI> {
    return this._http.get<CitaAPI>(`${this._apiUrl}/${id}`);
  }

  createCita(payload: CitaPayload): Observable<CitaAPI> {
    return this._http.post<CitaAPI>(this._apiUrl, payload);
  }
  // citas/proveedor

  updateCita(id: number, payload: Partial<CitaPayload>): Observable<CitaAPI> {
    return this._http.put<CitaAPI>(`${this._apiUrl}/${id}`, payload);
  }

updateEstado(id: number, estado: 'pendiente' | 'confirmada' | 'cancelada'): Observable<CitaAPI> {
  return this._http.patch<CitaAPI>(`${this._apiUrl}/${id}/estado`, { estado });
}
  deleteCita(id: number): Observable<{ message: string }> {
    return this._http.delete<{ message: string }>(`${this._apiUrl}/${id}`);
  }

  getCitasPorFecha(fecha: string): Observable<CitaAPI[]> {
    return this._http.get<CitaAPI[]>(`${this._apiUrl}?fecha=${fecha}`);
  }

  getUsuariosPermitidosParaAllUsers(): Observable<any[]> {
    return this._http.get<any[]>(`${APP_CONFIG.apiUrl}usuarios-permitidosAllUsers`);
  }

  //PROVEDORES
  getUsuariosPermitidosParaProvedores(): Observable<any[]> {
    return this._http.get<any[]>(`${APP_CONFIG.apiUrl}usuarios-permitidos`);
  }

  createCitaProvedores(payload: CitaPayload): Observable<CitaAPI> {
    return this._http.post<CitaAPI>(`${this._apiUrl}/proveedor`, payload);
  }

  getCitasProveedor(): Observable<any[]> {
    return this._http.get<any[]>(`${this._apiUrl}/index/proveedor`);
  }

  updateCitaProveedor(payload: any): Observable<any> {
    return this._http.put(`${this._apiUrl}/proveedor/update`, payload);
  }

  deleteCitaProveedor(ids: number[]): Observable<any> {
    return this._http.delete(`${this._apiUrl}/proveedor/destroy`, { body: { ids } });
  }

  getCitasAdmin(): Observable<CitaAPI[]> {
  return this._http.get<CitaAPI[]>(`${this._apiUrl}/admin/todas`);
}
}
