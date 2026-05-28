import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { SimpleUser } from 'app/modules/mailbox/mailbox.service';
import { catchError, map, Observable, shareReplay, throwError } from 'rxjs';

// Lo que devuelve el backend (GET)
export interface CitaAPI {
  id: number;
  cita_type_id: number;
  id_user: number;
  id_visitante: number;
  nombre_visitante?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo?: string;
  sala?: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  notas?: string;
  usuario?: { id: number; nombre?: string };
  visitante?: { id: number; nombre?: string };
  con_vehiculo?: 0 | 1 | boolean;
  es_externa?: boolean;
  asistencia?: string | null;
  nombre_proveedor?: string;
  nombre_organizador?: string;
  es_organizador?: string;
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

// ─── INTERFACES JUNTAS ───────────────────────────────────────────

export interface JuntaPayload {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  participantes: number[];
  asunto?: string;
  sala?: string;
  estado?: 'pendiente' | 'confirmada' | 'cancelada';
  notas?: string;
}

export interface JuntaAPI {
  id: number;
  id_user: number;
  id_visitante: number;
  nombre_visitante?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo?: string;
  sala?: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  notas?: string;
  cita_type_id: 2;
}

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private _apiUrl = `${APP_CONFIG.apiUrl}citas`;
  private _juntasUrl = `${APP_CONFIG.apiUrl}juntas`;
  private readonly apiUrl = APP_CONFIG.apiUrl;
  private _usuariosInternosCache$: Observable<SimpleUser[]> | null = null;
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

  //JUNTAS

  // ─── JUNTAS ──────────────────────────────────────────────────────
getUsuariosDisponiblesJuntas(q = '', limit = 200): Observable<SimpleUser[]> {
  // Si no hay búsqueda, usar caché
  if (!q) {
    if (!this._usuariosInternosCache$) {
      this._usuariosInternosCache$ = this._http
        .get<any>(`${this.apiUrl}users/all-juntas`, {
          params: new HttpParams().set('q', '').set('limit', '500'),
        })
        .pipe(
          map((resp: any) => {
            const usuarios = Array.isArray(resp) ? resp : (resp?.data ?? []);
            return usuarios.map((u: any) => ({
              ...u,
              nombre: u.nombre?.toUpperCase(),
            }));
          }),
          shareReplay(1), // ← cachea el resultado para todas las suscripciones futuras
          catchError((err) => {
            this._usuariosInternosCache$ = null; // limpiar caché si hay error
            return throwError(() => err);
          }),
        );
    }
    return this._usuariosInternosCache$;
  }

  // Con búsqueda, no cachear
  return this._http
    .get<any>(`${this.apiUrl}users/all-juntas`, {
      params: new HttpParams().set('q', q).set('limit', String(limit)),
    })
    .pipe(
      map((resp: any) => {
        const usuarios = Array.isArray(resp) ? resp : (resp?.data ?? []);
        return usuarios.map((u: any) => ({
          ...u,
          nombre: u.nombre?.toUpperCase(),
        }));
      }),
      catchError((err) => throwError(() => err)),
    );
}

clearUsuariosCache(): void {
  this._usuariosInternosCache$ = null;
}

  createJunta(payload: JuntaPayload): Observable<JuntaAPI> {
    return this._http.post<JuntaAPI>(this._juntasUrl, payload);
  }

  updateJunta(id: number, payload: Partial<JuntaPayload>): Observable<JuntaAPI> {
    return this._http.put<JuntaAPI>(`${this._juntasUrl}/${id}`, payload);
  }

  deleteJunta(id: number): Observable<{ message: string }> {
    return this._http.delete<{ message: string }>(`${this._juntasUrl}/${id}`);
  }

  updateEstadoJunta(
    id: number,
    estado: 'pendiente' | 'confirmada' | 'cancelada',
  ): Observable<JuntaAPI> {
    return this._http.patch<JuntaAPI>(`${this._juntasUrl}/${id}/estado`, { estado });
  }

  updateAsistenciaJunta(
    id: number,
    asistencia: 'pendiente' | 'confirmada' | 'rechazada',
  ): Observable<JuntaAPI> {
    return this._http.patch<JuntaAPI>(`${this._juntasUrl}/${id}/asistencia`, { asistencia });
  }
}
