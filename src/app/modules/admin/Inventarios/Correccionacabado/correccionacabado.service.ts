
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Observable } from 'rxjs';
import { ArticuloCAResponse, CorreccionAcabadoLoteRequest, CorreccionAcabadoLoteResponse, CorreccionAcabadoRequest, CorreccionAcabadoResponse, EliminarCARequest, EliminarCAResponse, EliminarLoteResponse, GuardarCARequest, GuardarCAResponse } from '../types/correccion acabado.type';



@Injectable({
  providedIn: 'root',
})
export class CorreccionAcabadoService {

  private readonly baseUrl = `${APP_CONFIG.apiUrl}scanner`;

  private readonly correccionUrl = `${this.baseUrl}/correccion-acabado`;

  constructor(private http: HttpClient) { }

  /**
   * Escanea un rollo para corrección de acabado.
   * POST /scanner/correccion-acabado
   */
  escanear(rollo: string): Observable<CorreccionAcabadoResponse> {
    const body: CorreccionAcabadoRequest = { rollo };

    return this.http.post<CorreccionAcabadoResponse>(
      this.correccionUrl,
      body
    );
  }

  /**
   * Consulta el artículo correspondiente a una OP.
   * GET /scanner/articulo?op=...
   */
  articulo(op: string): Observable<ArticuloCAResponse> {
    const params = new HttpParams().set('op', op);

    return this.http.get<ArticuloCAResponse>(
      `${this.baseUrl}/articulo`,
      { params }
    );
  }

  /**
   * Actualiza los datos de corrección de acabado.
   * PUT /scanner/edit
   */
  guardar(body: GuardarCARequest): Observable<GuardarCAResponse> {
    return this.http.put<GuardarCAResponse>(
      `${this.baseUrl}/edit`,
      body
    );
  }

  /**
   * Elimina un rollo de corrección de acabado.
   * POST /scanner/eliminar
   */
  eliminar(rollo: string): Observable<EliminarCAResponse> {
    const body: EliminarCARequest = { rollo };

    return this.http.post<EliminarCAResponse>(
      `${this.baseUrl}/eliminar`,
      body
    );
  }

  /**
   * Escanea un lote.
   * POST /scanner/lote
   */
  escanearLote(
    body: CorreccionAcabadoLoteRequest
  ): Observable<CorreccionAcabadoLoteResponse> {
    return this.http.post<CorreccionAcabadoLoteResponse>(
      `${this.baseUrl}/lote`,
      body
    );
  }

  /**
   * Registro manual por OP y pieza.
   * POST /scanner/correccion-acabado
   */
  escanearManual(
    op: string,
    pieza: string
  ): Observable<CorreccionAcabadoResponse> {
    const body: CorreccionAcabadoRequest = { op, pieza };

    return this.http.post<CorreccionAcabadoResponse>(
      this.correccionUrl,
      body
    );
  }

  /**
   * Elimina varios rollos.
   * POST /scanner/eliminar-lote
   */
  eliminarLote(rollos: string[]): Observable<EliminarLoteResponse> {
    return this.http.post<EliminarLoteResponse>(
      `${this.baseUrl}/eliminar-lote`,
      { rollos }
    );
  }
}
