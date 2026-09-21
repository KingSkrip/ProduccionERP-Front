// puestos/puesto.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { Puesto } from './Checador/types/Puesto.types';

export interface FiltrosPuesto {
  activo?: boolean;
  es_jefe_area?: boolean;
  es_gerente?: boolean;
  es_rh?: boolean;
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
export class PuestoService {
  private readonly baseUrl = `${APP_CONFIG.apiUrl}puestos`;

  private readonly _puestos$ = new BehaviorSubject<Puesto[]>([]);
  readonly puestos$ = this._puestos$.asObservable();

  constructor(private http: HttpClient) {}

  listar(filtros: FiltrosPuesto = {}): Observable<ApiCollectionPaginada<Puesto>> {
    let params = new HttpParams();

    if (filtros.activo !== undefined) {
      params = params.set('activo', filtros.activo ? 1 : 0);
    }
    if (filtros.es_jefe_area) {
      params = params.set('es_jefe_area', 1);
    }
    if (filtros.es_gerente) {
      params = params.set('es_gerente', 1);
    }
    if (filtros.es_rh) {
      params = params.set('es_rh', 1);
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

    return this.http.get<ApiCollectionPaginada<Puesto>>(this.baseUrl, { params });
  }

  /** Lista sin paginar, para selects/combos (ej. filtro "Departamento" en RH) */
  activos(): Observable<Puesto[]> {
    return this.http
      .get<Puesto[]>(`${this.baseUrl}/activos`)
      .pipe(tap((puestos) => this._puestos$.next(puestos)));
  }

  encontrar(id: number): Observable<Puesto> {
    return this.http.get<Puesto>(`${this.baseUrl}/${id}`);
  }

  crear(data: Partial<Puesto>): Observable<Puesto> {
    return this.http.post<Puesto>(this.baseUrl, data);
  }

  actualizar(id: number, data: Partial<Puesto>): Observable<Puesto> {
    return this.http.put<Puesto>(`${this.baseUrl}/${id}`, data);
  }

  eliminar(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  toggleActivo(id: number): Observable<Puesto> {
    return this.http.patch<Puesto>(`${this.baseUrl}/${id}/toggle-activo`, {});
  }
}