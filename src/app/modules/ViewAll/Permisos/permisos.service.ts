import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { SILENT_HTTP } from 'app/core/interceptors/silent-http.token';
import { BehaviorSubject, Observable, finalize, map, tap } from 'rxjs';

export type EstadoPermiso = 'pendiente' | 'aprobado' | 'rechazado';

export interface CatalogoPermiso {
  id: number;
  nombre: string;
  descripcion?: string | null;
  requiere_horario?: boolean;
}

export interface ChecadorPermiso {
  id: number;
  user_firebird_identity_id: number;
  checador_catalogo_permiso_id: number;
  tipo: 'normal' | 'extraordinario' | null;
  fecha_inicio: string;
  fecha_fin: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  motivo: string;
  estado: EstadoPermiso;
  estado_rh: EstadoPermiso;
  estado_jefe: EstadoPermiso;
  comentarios_rh?: string | null;
  comentarios_jefe?: string | null;
  fecha_resolucion_rh?: string | null;
  fecha_resolucion_jefe?: string | null;
  catalogo?: CatalogoPermiso;
  identity?: {
    id: number;
    nombre: string | null;
    area?: { id: number; nombre: string } | null;
    puesto?: { id: number; nombre: string } | null;
  };
  created_at?: string;
}

export interface SolicitarPermisoPayload {
  checador_catalogo_permiso_id: number;
  tipo?: 'normal' | 'extraordinario';
  fecha_inicio: string;
  fecha_fin: string;
  hora_inicio?: string;
  hora_fin?: string;
  motivo: string;
}

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

  /**
   * Catálogo de tipos de permiso disponibles (vacaciones, cita médica, comida, etc.)
   * Se marca como silenciosa para no disparar el loader/interceptor global.
   */
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

  /**
   * Solicita un nuevo permiso. Si el tipo no requiere aprobación,
   * el backend puede regresarlo ya con estado 'aprobado'.
   */
  solicitar(payload: SolicitarPermisoPayload): Observable<ApiResource<ChecadorPermiso>> {
    this._solicitando$.next(true);
    return this.http
      .post<ApiResource<ChecadorPermiso>>(`${this.baseUrl}/permisos/solicitar`, payload)
      .pipe(
        tap((res) => this._historial$.next([res.data, ...this._historial$.getValue()])),
        finalize(() => this._solicitando$.next(false)),
      );
  }

  /**
   * Historial de permisos de una identidad (paginado por el backend).
   */
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

  /**
   * Bandeja de RH: permisos que esperan su aprobación.
   * ⚠️ Ajusta la ruta si en tus routes/api.php le pusiste otro nombre
   * al endpoint que pega a ChecadorPermisoController::pendientesRh
   */
  // permisos.service.ts

  pendientesRh(page = 1, firebirdEmpresa?: string): Observable<ChecadorPermiso[]> {
    let params = new HttpParams().set('page', page);
    if (firebirdEmpresa) {
      params = params.set('firebird_empresa', firebirdEmpresa);
    }

    return (
      this.http
        // 👇 antes decía /permisos/pendientes/rh, tu ruta real es pendientes-rh
        .get<ApiCollection<ChecadorPermiso>>(`${this.baseUrl}/permisos/pendientes-rh`, { params })
        .pipe(
          map((res) => res.data ?? []),
          tap((pendientes) => this._pendientesRh$.next(pendientes)),
        )
    );
  }

  /**
   * Aprueba o rechaza un permiso en el carril indicado.
   * El "aprobado_por" lo pone el backend a partir del JWT, no hace falta mandarlo.
   * ⚠️ Ajusta la ruta si tu endpoint de resolver() está montado distinto.
   */
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
          // lo quitamos de la bandeja local, ya no está pendiente
          this._pendientesRh$.next(
            this._pendientesRh$.getValue().filter((p) => p.id !== permisoId),
          );
        }),
        finalize(() => this._resolviendo$.next(false)),
      );
  }

  /**
   * Bandeja del jefe directo: gente que le reporta (jefe_id en user_puestos)
   * y que YA pasó RH, solo falta su firma.
   */
  pendientesJefe(jefeId: number): Observable<ChecadorPermiso[]> {
    return this.http
      .get<ApiCollection<ChecadorPermiso>>(`${this.baseUrl}/permisos/pendientes-jefe/${jefeId}`)
      .pipe(
        map((res) => res.data ?? []),
        tap((pendientes) => this._pendientesJefe$.next(pendientes)),
      );
  }
}
