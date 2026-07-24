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

export interface PermisoDia {
  id: number;
  tipo: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  no_regresa: boolean;
  motivo: string;
}

export interface FiltrosExportarExcel {
  empresa?: string;
  areaId?: number;
  departamentoId?: number;
  turnoId?: number;
  busqueda?: string; // "trabajador"
}

export interface DiaTarjeta {
  fecha: string;
  dia_semana: string;
  es_descanso: boolean;
  horario_esperado: string;
  hora_entrada_real: string | null;
  hora_salida_real: string | null;
  horas_trabajadas: number;
  permisos: PermisoDia[];
}

export interface TarjetaAsistencia {
  identity_id: number;
  nombre: string;
  empresa: string | null;
  turno: { id: number; nombre: string } | null;
  semana: { desde: string; hasta: string };
  dias: DiaTarjeta[];
  total_horas_semana: number;
}

export interface RespuestaEquipo {
  data: TarjetaAsistencia[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
}

export interface OpcionEmpleado {
  id: number;
  nombre: string;
}

/** Filtros aceptados por la tarjeta de asistencia del equipo */
export interface FiltrosAsistenciaEquipo {
  fecha: string;
  page?: number;
  empresa?: string;
  areaId?: number;
  departamentoId?: number;
  turnoId?: number;
  catalogoId?: number;
  busqueda?: string;
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

  /**
   * Tarjeta de asistencia del equipo, semana + filtros de:
   * empresa, área, departamento, turno, tipo de permiso y texto de búsqueda.
   */
  asistenciaEquipoSemana(filtros: FiltrosAsistenciaEquipo): Observable<RespuestaEquipo> {
    let params = new HttpParams().set('fecha', filtros.fecha).set('page', filtros.page ?? 1);

    if (filtros.empresa) {
      params = params.set('empresa', filtros.empresa);
    }
    if (filtros.areaId != null) {
      params = params.set('area_id', filtros.areaId);
    }
    if (filtros.departamentoId != null) {
      params = params.set('departamento_id', filtros.departamentoId);
    }
    if (filtros.turnoId != null) {
      params = params.set('turno_id', filtros.turnoId);
    }
    if (filtros.catalogoId != null) {
      params = params.set('catalogo_id', filtros.catalogoId);
    }
    if (filtros.busqueda) {
      params = params.set('busqueda', filtros.busqueda);
    }

    return this.http.get<RespuestaEquipo>(`${this.baseUrl}/asistencia/equipo/semana`, { params });
  }

  descargarExcel(identityId: number, fecha: string): void {
    this.http
      .get(`${this.baseUrl}/asistencia/${identityId}/excel`, {
        params: { fecha },
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => this.forzarDescarga(blob, `asistencia_${identityId}_${fecha}.xlsx`),
        error: () => {
          // opcional: emitir un mensaje de error hacia el componente
        },
      });
  }

  descargarExcelTodos(fecha: string, filtros: FiltrosExportarExcel = {}): void {
    let params: any = { fecha };
    if (filtros.empresa) params.empresa = filtros.empresa;
    if (filtros.areaId != null) params.area_id = filtros.areaId;
    if (filtros.departamentoId != null) params.departamento_id = filtros.departamentoId;
    if (filtros.turnoId != null) params.turno_id = filtros.turnoId;
    if (filtros.busqueda) params.busqueda = filtros.busqueda;

    this.http.get(`${this.baseUrl}/asistencia/excel`, { params, responseType: 'blob' }).subscribe({
      next: (blob) => {
        const nombre = `asistencia_equipo_${fecha}${filtros.empresa ? '_emp' + filtros.empresa : ''}.xlsx`;
        this.forzarDescarga(blob, nombre);
      },
      error: () => {},
    });
  }

  private forzarDescarga(blob: Blob, nombreArchivo: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  listaEmpleados(
    filtros: {
      empresa?: string;
      areaId?: number;
      departamentoId?: number;
      turnoId?: number;
    } = {},
  ): Observable<OpcionEmpleado[]> {
    let params: any = {};
    if (filtros.empresa) params.empresa = filtros.empresa;
    if (filtros.areaId != null) params.area_id = filtros.areaId;
    if (filtros.departamentoId != null) params.departamento_id = filtros.departamentoId;
    if (filtros.turnoId != null) params.turno_id = filtros.turnoId;

    return this.http.get<OpcionEmpleado[]>(`${this.baseUrl}/empleados/lista`, { params });
  }
}
