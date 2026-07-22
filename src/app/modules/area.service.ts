// areas/area.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Area } from './Checador/types/AreaTypes';

export interface FiltrosArea {
  activo?: boolean;
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
export class AreaService {
  private readonly baseUrl = `${APP_CONFIG.apiUrl}areas`;

  private readonly _areas$ = new BehaviorSubject<Area[]>([]);
  readonly areas$ = this._areas$.asObservable();

  constructor(private http: HttpClient) {}

  listar(filtros: FiltrosArea = {}): Observable<ApiCollectionPaginada<Area>> {
    let params = new HttpParams();

    if (filtros.activo !== undefined) {
      params = params.set('activo', filtros.activo ? 1 : 0);
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

    return this.http.get<ApiCollectionPaginada<Area>>(this.baseUrl, { params });
  }

  /** Lista sin paginar, para selects/combos (ej. filtro "Área" en RH) */
  activas(): Observable<Area[]> {
    return this.http
      .get<Area[]>(`${this.baseUrl}/activas`)
      .pipe(tap((areas) => this._areas$.next(areas)));
  }

  encontrar(id: number): Observable<Area> {
    return this.http.get<Area>(`${this.baseUrl}/${id}`);
  }

  crear(data: Partial<Area>): Observable<Area> {
    return this.http.post<Area>(this.baseUrl, data);
  }

  actualizar(id: number, data: Partial<Area>): Observable<Area> {
    return this.http.put<Area>(`${this.baseUrl}/${id}`, data);
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  toggleActivo(id: number): Observable<Area> {
    return this.http.patch<Area>(`${this.baseUrl}/${id}/toggle-activo`, {});
  }
}