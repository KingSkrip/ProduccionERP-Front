// turnos/turno.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Turno } from './Checador/types/TurnoTypes';
import { TurnoDia } from './Checador/types/TurnoDia';

export interface FiltrosTurno {
  firebird_empresa?: string;
  status_id?: number;
  search?: string;
  per_page?: number;
  page?: number;
}

interface ApiCollectionPaginada<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

@Injectable({ providedIn: 'root' })
export class TurnoService {
  private readonly baseUrl = `${APP_CONFIG.apiUrl}turnos`;

  private readonly _turnos$ = new BehaviorSubject<Turno[]>([]);
  readonly turnos$ = this._turnos$.asObservable();

  constructor(private http: HttpClient) {}

  listar(filtros: FiltrosTurno = {}): Observable<ApiCollectionPaginada<Turno>> {
    let params = new HttpParams();

    if (filtros.firebird_empresa) {
      params = params.set('firebird_empresa', filtros.firebird_empresa);
    }
    if (filtros.status_id) {
      params = params.set('status_id', filtros.status_id);
    }
    if (filtros.search) {
      params = params.set('search', filtros.search);
    }
    if (filtros.per_page) {
      params = params.set('per_page', filtros.per_page);
    }
    if (filtros.page) {
      params = params.set('page', filtros.page);
    }

    return this.http.get<ApiCollectionPaginada<Turno>>(this.baseUrl, { params });
  }

  /** Lista sin paginar, para el select de filtro "Turno" en RH */
  activos(): Observable<Turno[]> {
    return this.http
      .get<Turno[]>(`${this.baseUrl}/activos`)
      .pipe(tap((turnos) => this._turnos$.next(turnos)));
  }

  encontrar(id: number): Observable<Turno> {
    return this.http.get<Turno>(`${this.baseUrl}/${id}`);
  }

  crear(data: Partial<Turno>): Observable<Turno> {
    return this.http.post<Turno>(this.baseUrl, data);
  }

  actualizar(id: number, data: Partial<Turno>): Observable<Turno> {
    return this.http.put<Turno>(`${this.baseUrl}/${id}`, data);
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  actualizarDia(id: number, diaSemana: number, data: Partial<TurnoDia>): Observable<TurnoDia> {
    return this.http.patch<TurnoDia>(`${this.baseUrl}/${id}/dias/${diaSemana}`, data);
  }
}