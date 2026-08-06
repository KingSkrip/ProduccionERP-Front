import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { APP_CONFIG } from 'app/core/config/app-config';
import { SILENT_HTTP } from 'app/core/interceptors/silent-http.token';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { ChecadorPermiso } from './types/Checadorpermiso.types';
import { SolicitarPermisoPayload } from './types/Solicitarpermiso.types';

// ============================================================
// Tipos
// ============================================================

export interface ChecadorUsuarioInfo {
  nombre: string;
  foto: string | null;
  departamento: { clave: string; nombre: string } | null;
  area: { clave: string; nombre: string } | null;
  puesto: { clave: string; nombre: string } | null;
}

export interface ChecadorQr {
  token: string;
  activo: boolean;
  ultima_lectura: string | null;
  nombre: string | null;
  creado: boolean;
}

export interface ChecadorPuntualidad {
  hora_programada: string | null;
  minutos_retardo: number;
  es_retardo: boolean;
  minutos_anticipacion: number;
  horas_extra: number;
}

export interface ChecadorPermisoResumen {
  id: number;
  motivo: string;
  fecha_inicio: string;
  fecha_fin: string;
  catalogo?: { clave: string; nombre: string } | null;
}

export interface ChecadorRegistroResultado {
  registro_id: number;
  identity_id: number;
  usuario: ChecadorUsuarioInfo | null;
  firebird_empresa: string;
  turno_id: number | null;
  tipo: 'entrada' | 'salida' | 'Inicio de permiso' | 'Fin de permiso';
  metodo: 'qr' | 'manual';
  fecha: string;
  hora: string;
  fecha_hora: string;
  valido: boolean;
  observaciones: string | null;
  en_permiso: boolean;
  autorizada_libre: boolean;
  es_primer_registro_dia: boolean;
  es_cierre_de_turno: boolean;

  permiso: ChecadorPermisoResumen | null;
  puntualidad?: ChecadorPuntualidad;
  jornada?: unknown;
}

export interface ChecadorEmpleadoBusqueda {
  firebird_clave: string;
  nombre: string;
  identity_id: number | null;
  tiene_identity: boolean;
}

export interface ChecadorRegistroHoy {
  id: number;
  identity_id: number;
  nombre: string;
  tipo: 'entrada' | 'salida';
  hora: string;
  metodo: 'qr' | 'manual';
  valido: boolean;
  observaciones: string | null;
}

export interface ChecadorHoyResponse {
  fecha: string;
  total: number;
  registros: ChecadorRegistroHoy[];
}

export interface ChecadorCatalogoPermiso {
  id: number;
  nombre: string;
  clave: string;
  descripcion: string | null;
  duracion_default_minutos: number | null;
  requiere_aprobacion: boolean;
  activo: boolean;
  orden: number;
}

export interface ChecadorPaginado<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface ResolverPermisoPayload {
  estado: 'aprobado' | 'rechazado';
  aprobado_por: number;
  comentarios_aprobador?: string;
}

@Injectable({ providedIn: 'root' })
export class ChecadorService {
  private readonly baseUrl = `${APP_CONFIG.apiUrl}checador`;

  /** Último resultado de una checada exitosa, para que otras partes de la UI reaccionen sin re-pedirlo. */
  private readonly ultimoRegistro$ = new BehaviorSubject<ChecadorRegistroResultado | null>(null);
  readonly ultimoRegistro = this.ultimoRegistro$.asObservable();

  constructor(private http: HttpClient) {}

  // ============================================================
  // QR
  // ============================================================

  generarQr(identityId: number): Observable<ChecadorQr> {
    return this.http.post<ChecadorQr>(`${this.baseUrl}/qr/${identityId}/generar`, {});
  }

  obtenerQr(identityId: number): Observable<ChecadorQr | null> {
    return this.http
      .get<ChecadorQr>(`${this.baseUrl}/qr/${identityId}`)
      .pipe(catchError((error) => (error?.status === 404 ? of(null) : throwError(() => error))));
  }

  revocarQr(identityId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/qr/${identityId}/revocar`, {});
  }

  /**
   * Envía el token leído (por cámara o por lector USB) para registrar la checada.
   * Va marcado como silencioso para que el interceptor global no truene
   * un toast de error genérico; el componente maneja su propio feedback
   * visual (necesita distinguir "QR inválido" de "error de red", etc.).
   */
  registrarPorToken(token: string): Observable<ChecadorRegistroResultado> {
    return this.http
      .post<{
        data: ChecadorRegistroResultado;
      }>(
        `${this.baseUrl}/qr/registrar`,
        { token },
        { context: new HttpContext().set(SILENT_HTTP, true) },
      )
      .pipe(
        map((res) => res.data), // 👈 desenvolver
        tap((resultado) => this.ultimoRegistro$.next(resultado)),
      );
  }

  historial(
    identityId: number,
    desde?: string,
    hasta?: string,
  ): Observable<ChecadorPaginado<unknown>> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);

    return this.http.get<ChecadorPaginado<unknown>>(`${this.baseUrl}/historial/${identityId}`, {
      params,
    });
  }

  // ============================================================
  // Registro manual (sin QR, para cuando falla el lector o el
  // empleado no trae su QR)
  // ============================================================

  buscarEmpleado(q: string): Observable<ChecadorEmpleadoBusqueda[]> {
    const params = new HttpParams().set('q', q);
    return this.http.get<ChecadorEmpleadoBusqueda[]>(`${this.baseUrl}/buscar-empleado`, { params });
  }

  registrarManual(
    identityId: number,
    observaciones?: string,
  ): Observable<ChecadorRegistroResultado> {
    return this.http
      .post<{ data: ChecadorRegistroResultado }>(`${this.baseUrl}/registrar-manual`, {
        user_firebird_identity_id: identityId,
        observaciones: observaciones ?? null,
      })
      .pipe(
        map((res) => res.data), // 👈 desenvolver
        tap((resultado) => this.ultimoRegistro$.next(resultado)),
      );
  }

  hoy(firebirdEmpresa?: string): Observable<ChecadorHoyResponse> {
    let params = new HttpParams();
    if (firebirdEmpresa) params = params.set('firebird_empresa', firebirdEmpresa);

    return this.http.get<ChecadorHoyResponse>(`${this.baseUrl}/hoy`, {
      params,
      context: new HttpContext().set(SILENT_HTTP, true),
    });
  }

  // ============================================================
  // Permisos
  // ============================================================

  catalogoPermisos(): Observable<ChecadorCatalogoPermiso[]> {
    return this.http.get<ChecadorCatalogoPermiso[]>(`${this.baseUrl}/permisos/catalogo`);
  }

  solicitarPermiso(payload: SolicitarPermisoPayload): Observable<ChecadorPermiso> {
    return this.http.post<ChecadorPermiso>(`${this.baseUrl}/permisos/solicitar`, payload);
  }

  permisosPendientes(firebirdEmpresa?: string): Observable<ChecadorPaginado<ChecadorPermiso>> {
    let params = new HttpParams();
    if (firebirdEmpresa) params = params.set('firebird_empresa', firebirdEmpresa);

    return this.http.get<ChecadorPaginado<ChecadorPermiso>>(`${this.baseUrl}/permisos/pendientes`, {
      params,
    });
  }

  resolverPermiso(permisoId: number, payload: ResolverPermisoPayload): Observable<ChecadorPermiso> {
    return this.http.post<ChecadorPermiso>(
      `${this.baseUrl}/permisos/${permisoId}/resolver`,
      payload,
    );
  }

  historialPermisos(identityId: number): Observable<ChecadorPaginado<ChecadorPermiso>> {
    return this.http.get<ChecadorPaginado<ChecadorPermiso>>(
      `${this.baseUrl}/permisos/historial/${identityId}`,
    );
  }

  /** Limpia el último resultado guardado (ej. al cerrar el overlay de resultado). */
  limpiarUltimoRegistro(): void {
    this.ultimoRegistro$.next(null);
  }
}
