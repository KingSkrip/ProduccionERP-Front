import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { SILENT_HTTP } from 'app/core/interceptors/silent-http.token';
import { CatalogoPermiso } from 'app/modules/Checador/types/Catalogopermiso.types';
import { ChecadorPermiso } from 'app/modules/Checador/types/Checadorpermiso.types';
import { SolicitarPermisoPayload } from 'app/modules/Checador/types/Solicitarpermiso.types';
import { BehaviorSubject, Observable, finalize, map, tap } from 'rxjs';

export type EstadoPermiso = 'pendiente' | 'aprobado' | 'rechazado' | 'solicitado';

/** Claves de catálogo que requieren que el empleado decida cómo paga el tiempo */
export const CLAVES_PAGO_TIEMPO = ['EXTRA', 'PERSONAL', 'TRAMITE', 'MEDICO'];


interface ApiResource<T> {
  data: T;
  message?: string;
}

interface ApiCollection<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; total: number };
}

@Injectable({ providedIn: 'root' })
export class PermisosService {
  private readonly baseUrl = `${APP_CONFIG.apiUrl}checador`;

  private readonly _catalogo$ = new BehaviorSubject<CatalogoPermiso[]>([]);
  readonly catalogo$ = this._catalogo$.asObservable();

  private readonly _historial$ = new BehaviorSubject<ChecadorPermiso[]>([]);
  readonly historial$ = this._historial$.asObservable();

  private readonly _solicitando$ = new BehaviorSubject<boolean>(false);
  readonly solicitando$ = this._solicitando$.asObservable();

  private readonly _pendientesRh$ = new BehaviorSubject<ChecadorPermiso[]>([]);
  readonly pendientesRh$ = this._pendientesRh$.asObservable();

  private readonly _resolviendo$ = new BehaviorSubject<boolean>(false);
  readonly resolviendo$ = this._resolviendo$.asObservable();

  private readonly _pendientesJefe$ = new BehaviorSubject<ChecadorPermiso[]>([]);
  readonly pendientesJefe$ = this._pendientesJefe$.asObservable();

  constructor(private http: HttpClient) {}

  getCatalogo(): Observable<CatalogoPermiso[]> {
    return this.http
      .get<CatalogoPermiso[] | ApiCollection<CatalogoPermiso>>(
        `${this.baseUrl}/permisos/catalogo`,
        {
          context: new HttpContext().set(SILENT_HTTP, true),
        },
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res.data)),
        tap((catalogo) => this._catalogo$.next(catalogo)),
      );
  }

  solicitar(payload: SolicitarPermisoPayload): Observable<ApiResource<ChecadorPermiso>> {
    this._solicitando$.next(true);
    return this.http
      .post<ApiResource<ChecadorPermiso>>(`${this.baseUrl}/permisos/solicitar`, payload)
      .pipe(
        tap((res) => this._historial$.next([res.data, ...this._historial$.getValue()])),
        finalize(() => this._solicitando$.next(false)),
      );
  }

  historial(identityId: number, page = 1): Observable<ChecadorPermiso[]> {
    const params = new HttpParams().set('page', page);
    return this.http
      .get<
        ApiCollection<ChecadorPermiso>
      >(`${this.baseUrl}/permisos/historial/${identityId}`, { params })
      .pipe(
        map((res) => res.data ?? []),
        tap((historial) => this._historial$.next(historial)),
      );
  }

  pendientesRh(page = 1, firebirdEmpresa?: string): Observable<ChecadorPermiso[]> {
    let params = new HttpParams().set('page', page);
    if (firebirdEmpresa) {
      params = params.set('firebird_empresa', firebirdEmpresa);
    }

    return this.http
      .get<ApiCollection<ChecadorPermiso>>(`${this.baseUrl}/permisos/pendientes-rh`, { params })
      .pipe(
        map((res) => res.data ?? []),
        tap((pendientes) => this._pendientesRh$.next(pendientes)),
      );
  }

  resolver(
    permisoId: number,
    rol: 'rh' | 'jefe',
    data: { estado: 'aprobado' | 'rechazado'; comentarios_aprobador?: string },
  ): Observable<ApiResource<ChecadorPermiso>> {
    this._resolviendo$.next(true);
    return this.http
      .post<
        ApiResource<ChecadorPermiso>
      >(`${this.baseUrl}/permisos/${permisoId}/resolver/${rol}`, data)
      .pipe(
        tap(() => {
          this._pendientesRh$.next(
            this._pendientesRh$.getValue().filter((p) => p.id !== permisoId),
          );
          this._pendientesJefe$.next(
            this._pendientesJefe$.getValue().filter((p) => p.id !== permisoId),
          );
        }),
        finalize(() => this._resolviendo$.next(false)),
      );
  }

  pendientesJefe(jefeId: number): Observable<ChecadorPermiso[]> {
    return this.http
      .get<ApiCollection<ChecadorPermiso>>(`${this.baseUrl}/permisos/pendientes-jefe/${jefeId}`)
      .pipe(
        map((res) => res.data ?? []),
        tap((pendientes) => this._pendientesJefe$.next(pendientes)),
      );
  }

  historialEquipo(jefeId: number): Observable<ChecadorPermiso[]> {
    return this.http
      .get<ApiCollection<ChecadorPermiso>>(`${this.baseUrl}/permisos/historial-equipo/${jefeId}`)
      .pipe(map((res) => res.data ?? []));
  }
}
