import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { SILENT_HTTP } from 'app/core/interceptors/silent-http.token';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface TejidoResumen {
  departamento: string;
  proceso: string;
  CANTIDAD: number | string;
  PIEZAS: number | string;
}

export interface ReporteProduccion {
  depto: number;
  departamento: string;
  proc: string;
  proceso: string;
  CANTIDAD: string;
}

export interface ProduccionTejido {
  ARTICULO: string;
  PIEZAS: number;
  TOTAL_TJ: number;
}

export interface RevisadoTejido {
  ARTICULO: string;
  PIEZAS: number;
  TOTAL_RV: number;
}

export interface PorRevisarTejido {
  ARTICULO: string;
  PIEZAS: number;
  TOTAL_POR_REVISAR: number;
}

export interface SaldosTejido {
  ARTICULO: string;
  PIEZAS: number;
  TOTAL_SALDO: number;
}

export interface EntregadoEmbarques {
  TIPO: string;
  ARTICULO: string;
  CANTIDAD: number;
}

export interface FacturadoDetallePartida {
  PARTIDA: number;
  PNETO: number;
}

export interface FacturadoResumenResponse {
  total: { pneto: number };
  detalle: FacturadoDetallePartida[] | null;
}

export interface AcabadoResumen {
  departamento: string;
  proceso: string;
  CANTIDAD: number | string;
  PIEZAS: number | string;
}

export interface ProduccionPorDia {
  FECHA: string;
  CANTIDAD: number;
  PIEZAS: number;
}

@Injectable({ providedIn: 'root' })
export class ReportProdService {
  private readonly apiUrl = APP_CONFIG.apiUrl;

  constructor(private _httpClient: HttpClient) {}

  /**
   * GET → Obtener reportes de producción con filtros de fecha
   */
  getReportesProduccion(fechaInicio?: Date, fechaFin?: Date): Observable<ReporteProduccion[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: ReporteProduccion[];
      }>(`${this.apiUrl}reportes-produccion`, { params })
      .pipe(
        map((resp) => resp.data),
        catchError((err) => {
          console.error('Error al obtener reportes de producción', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  /**
   * 🔥 GET → Obtener producción de TEJIDO por artículo
   */
  getProduccionTejido(fechaInicio?: Date, fechaFin?: Date): Observable<ProduccionTejido[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: ProduccionTejido[];
      }>(`${this.apiUrl}reportes-produccion/tejido`, { params })
      .pipe(
        map((resp) => resp.data),
        catchError((err) => {
          console.error('Error al obtener producción de tejido', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  /**
   * 🔥 GET → Obtener REVISADO de tejido por artículo
   */
  getRevisadoTejido(fechaInicio?: Date, fechaFin?: Date): Observable<RevisadoTejido[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: RevisadoTejido[];
      }>(`${this.apiUrl}reportes-produccion/revisado`, { params })
      .pipe(
        map((resp) => resp.data),
        catchError((err) => {
          console.error('Error al obtener revisado de tejido', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  /**
   * 🔥 GET → Obtener POR REVISAR de tejido por artículo
   */
  getPorRevisarTejido(fechaInicio?: Date, fechaFin?: Date): Observable<PorRevisarTejido[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: PorRevisarTejido[];
      }>(`${this.apiUrl}reportes-produccion/pendientes`, { params })
      .pipe(
        map((resp) => resp.data),
        catchError((err) => {
          console.error('Error al obtener por revisar de tejido', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  /**
   * 🔥 GET → Obtener SALDOS de tejido por artículo
   */
  getSaldosTejido(fechaInicio?: Date, fechaFin?: Date): Observable<SaldosTejido[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${anio}-${mes}-${dia} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: SaldosTejido[];
      }>(`${this.apiUrl}reportes-produccion/con-saldo`, { params })
      .pipe(
        map((resp) => resp.data),
        catchError((err) => {
          console.error('Error al obtener saldos de tejido', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  /**
   * 🔥 GET → Obtener producción entregada a embarques por tipo de tejido y artículo
   */
  getEntregadoaEmbarques(fechaInicio?: Date, fechaFin?: Date): Observable<any[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: any[];
      }>(`${this.apiUrl}reportes-produccion/entregado-embarques`, { params })
      .pipe(
        map((resp) => {
          return resp.data || [];
        }),
        catchError((err) => {
          console.error('🔧 SERVICE: Error en petición:', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  getEstampados(fechaInicio?: Date, fechaFin?: Date): Observable<ReporteProduccion[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: ReporteProduccion[];
      }>(`${this.apiUrl}reportes-produccion/estampados`, { params })
      .pipe(
        map((resp) => resp.data),
        catchError((err) => {
          console.error('Error al obtener estampados', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  getTintoreria(fechaInicio?: Date, fechaFin?: Date): Observable<ReporteProduccion[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: ReporteProduccion[];
      }>(`${this.apiUrl}reportes-produccion/tintoreria`, { params })
      .pipe(
        map((resp) => resp.data),
        catchError((err) => {
          console.error('Error al obtener tintorería', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  /**
   * 🔥 GET → Obtener FACTURADO (total + desglose por partida)
   * - desglosar=true: trae detalle por partida
   * - desglosar=false: solo total
   */
  getFacturado(
    fechaInicio: Date,
    fechaFin: Date,
    desglosar: boolean = true,
  ): Observable<FacturadoResumenResponse> {
    let params = new HttpParams();

    const toIso = (d: Date): string => {
      const dd = d.getDate().toString().padStart(2, '0');
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${yyyy}-${mm}-${dd}`;
    };

    // fin exclusivo: +1 día
    const finExclusivo = new Date(fechaFin);
    finExclusivo.setDate(finExclusivo.getDate() + 1);

    params = params
      .set('fecha_inicio', `${toIso(fechaInicio)} 00:00:00`)
      .set('fecha_fin', `${toIso(finExclusivo)} 00:00:00`)
      .set('desglosar', desglosar ? '1' : '0');

    return this._httpClient
      .get<{
        success: boolean;
        data: FacturadoResumenResponse;
      }>(`${this.apiUrl}reportes-produccion/facturado`, { params })
      .pipe(
        map((r) => r.data),
        catchError((err) => {
          console.error('Error al obtener facturado', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  /**
   * 🔥 GET → Obtener resumen de TEJIDO (ORDENESPROC) con filtros de fecha
   * Ruta: /reportes-produccion/tejido-resumen
   */
  getTejidoResumen(fechaInicio?: Date, fechaFin?: Date): Observable<TejidoResumen[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: TejidoResumen[];
      }>(`${this.apiUrl}reportes-produccion/tejido-resumen`, { params })
      .pipe(
        map((resp) => resp.data),
        catchError((err) => {
          console.error('Error al obtener resumen de TEJIDO', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  getAcabado(fechaInicio?: Date, fechaFin?: Date): Observable<AcabadoResumen[]> {
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    if (fechaInicio) {
      params = params.set('fecha_inicio', formatoFirebird(fechaInicio, true));
    }

    if (fechaFin) {
      params = params.set('fecha_fin', formatoFirebird(fechaFin, false));
    }

    return this._httpClient
      .get<{
        success: boolean;
        data: AcabadoResumen[];
      }>(`${this.apiUrl}reportes-produccion/acabado`, { params })
      .pipe(
        map((resp) => resp.data || []),
        catchError((err) => {
          console.error('Error al obtener acabado', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  /**
   * 🚀 NUEVO: Obtener TODOS los reportes en una sola petición
   */
  getAllReports(fechaInicio: Date, fechaFin: Date, silent = false): Observable<any> {
    const context = new HttpContext().set(SILENT_HTTP, silent);
    let params = new HttpParams();

    const formatoFirebird = (fecha: Date, esInicio: boolean): string => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      const hora = esInicio ? '00:00:00' : '23:59:59';
      return `${dia}.${mes}.${anio} ${hora}`;
    };

    params = params
      .set('fecha_inicio', formatoFirebird(fechaInicio, true))
      .set('fecha_fin', formatoFirebird(fechaFin, false));

    return this._httpClient
      .get<{
        success: boolean;
        data: any;
      }>(`${this.apiUrl}reportes-produccion/all`, { params, context })
      .pipe(
        map((resp) => resp.data),
        catchError((err) => {
          console.error('Error al obtener todos los reportes', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  // En report-prod.service.ts
  getFacturadoPorDia(fechaInicio: Date, fechaFin: Date): Observable<any[]> {
    let params = new HttpParams();

    const toISO = (d: Date): string => {
      const dd = d.getDate().toString().padStart(2, '0');
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${yyyy}-${mm}-${dd}`;
    };

    const finExclusivo = new Date(fechaFin);
    finExclusivo.setDate(finExclusivo.getDate() + 1);

    params = params
      .set('fecha_inicio', `${toISO(fechaInicio)} 00:00:00`)
      .set('fecha_fin', `${toISO(finExclusivo)} 00:00:00`);

    return this._httpClient
      .get<{
        success: boolean;
        data: any[];
      }>(`${this.apiUrl}reportes-produccion/facturado-por-dia`, { params })
      .pipe(
        map((r) => r.data),
        catchError((err) => {
          console.error('Error al obtener facturado por día', err);
          return throwError(() => new Error(err.message || 'Error desconocido'));
        }),
      );
  }

  // ─── Tejido por día ───
  getTejidoPorDia(fechaInicio: Date, fechaFin: Date): Observable<ProduccionPorDia[]> {
    let params = new HttpParams();
    const fmt = (f: Date, inicio: boolean) => {
      const dd = f.getDate().toString().padStart(2, '0');
      const mm = (f.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = f.getFullYear();
      return `${dd}.${mm}.${yyyy} ${inicio ? '00:00:00' : '23:59:59'}`;
    };
    params = params
      .set('fecha_inicio', fmt(fechaInicio, true))
      .set('fecha_fin', fmt(fechaFin, false));
    return this._httpClient
      .get<{
        success: boolean;
        data: ProduccionPorDia[];
      }>(`${this.apiUrl}reportes-produccion/tejido-por-dia`, { params })
      .pipe(
        map((r) => r.data),
        catchError((err) => throwError(() => new Error(err.message))),
      );
  }

  // ─── Tintorería por día ───
  getTintoreriaPorDia(fechaInicio: Date, fechaFin: Date): Observable<ProduccionPorDia[]> {
    let params = new HttpParams();
    const fmt = (f: Date, inicio: boolean) => {
      const dd = f.getDate().toString().padStart(2, '0');
      const mm = (f.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = f.getFullYear();
      return `${dd}.${mm}.${yyyy} ${inicio ? '00:00:00' : '23:59:59'}`;
    };
    params = params
      .set('fecha_inicio', fmt(fechaInicio, true))
      .set('fecha_fin', fmt(fechaFin, false));
    return this._httpClient
      .get<{
        success: boolean;
        data: ProduccionPorDia[];
      }>(`${this.apiUrl}reportes-produccion/tintoreria-por-dia`, { params })
      .pipe(
        map((r) => r.data),
        catchError((err) => throwError(() => new Error(err.message))),
      );
  }

  // ─── Estampado por día ───
  getEstampadoPorDia(fechaInicio: Date, fechaFin: Date): Observable<ProduccionPorDia[]> {
    let params = new HttpParams();
    const fmt = (f: Date, inicio: boolean) => {
      const dd = f.getDate().toString().padStart(2, '0');
      const mm = (f.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = f.getFullYear();
      return `${dd}.${mm}.${yyyy} ${inicio ? '00:00:00' : '23:59:59'}`;
    };
    params = params
      .set('fecha_inicio', fmt(fechaInicio, true))
      .set('fecha_fin', fmt(fechaFin, false));
    return this._httpClient
      .get<{
        success: boolean;
        data: ProduccionPorDia[];
      }>(`${this.apiUrl}reportes-produccion/estampados-por-dia`, { params })
      .pipe(
        map((r) => r.data),
        catchError((err) => throwError(() => new Error(err.message))),
      );
  }

  // ─── Acabado por día ───
  getAcabadoPorDia(fechaInicio: Date, fechaFin: Date): Observable<ProduccionPorDia[]> {
    let params = new HttpParams();
    const fmt = (f: Date, inicio: boolean) => {
      const dd = f.getDate().toString().padStart(2, '0');
      const mm = (f.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = f.getFullYear();
      return `${dd}.${mm}.${yyyy} ${inicio ? '00:00:00' : '23:59:59'}`;
    };
    params = params
      .set('fecha_inicio', fmt(fechaInicio, true))
      .set('fecha_fin', fmt(fechaFin, false));
    return this._httpClient
      .get<{
        success: boolean;
        data: ProduccionPorDia[];
      }>(`${this.apiUrl}reportes-produccion/acabado-por-dia`, { params })
      .pipe(
        map((r) => r.data),
        catchError((err) => throwError(() => new Error(err.message))),
      );
  }
}
