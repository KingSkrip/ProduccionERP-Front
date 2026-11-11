import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Observable } from 'rxjs';
import {
  ArticuloCAResponse,
  CorreccionAcabadoRequest,
  CorreccionAcabadoResponse,
} from '../types/correccion acabado.type';

@Injectable({
  providedIn: 'root',
})
export class CorreccionAcabadoService {
  // POST {apiUrl}scanner/correccion-acabado
  private readonly baseUrl = `${APP_CONFIG.apiUrl}scanner/correccion-acabado`;

  constructor(private http: HttpClient) {}

  /** Envía el rollo escaneado; el back regresa OP, pieza y datos. */
  escanear(rollo: string): Observable<CorreccionAcabadoResponse> {
    const body: CorreccionAcabadoRequest = { rollo };

    return this.http.post<CorreccionAcabadoResponse>(this.baseUrl, body);
  }

articulo(op: string): Observable<ArticuloCAResponse> {
  const params = new HttpParams().set('op', op);
  return this.http.get<ArticuloCAResponse>(`${this.baseUrl}/articulo`, { params });
}
}
