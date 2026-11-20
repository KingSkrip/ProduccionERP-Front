import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Observable } from 'rxjs';
import { LiberarReprocesoResponse, Reproceso, ReprocesosFiltros, ReprocesosPaginado } from './types/reproceso.type';

@Injectable({
  providedIn: 'root',
})
export class ReprocesosService {
  private readonly baseUrl = `${APP_CONFIG.apiUrl}reprocesos`;

  constructor(private http: HttpClient) {}

  /** Lista reprocesos con búsqueda y paginación */
  getReprocesos(filtros: ReprocesosFiltros = {}): Observable<ReprocesosPaginado> {
    let params = new HttpParams();

    Object.entries(filtros).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<ReprocesosPaginado>(this.baseUrl, { params });
  }

  /** Obtiene un reproceso por IDREPRRM */
  getReproceso(id: number): Observable<Reproceso> {
    return this.http.get<Reproceso>(`${this.baseUrl}/${id}`);
  }

  /** Libera un reproceso por IDREPRRM (y genera la OT de tejido si aplica) */
liberarReproceso(id: number): Observable<LiberarReprocesoResponse> {
  return this.http.post<LiberarReprocesoResponse>(`${this.baseUrl}/${id}/liberar`, {});
}
}
