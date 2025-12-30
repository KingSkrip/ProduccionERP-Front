import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { APP_CONFIG } from 'app/core/config/app-config';

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

@Injectable({ providedIn: 'root' })
export class ReportProdService {
    private readonly apiUrl = APP_CONFIG.apiUrl;

    constructor(private _httpClient: HttpClient) { }

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
            .get<{ success: boolean; data: ReporteProduccion[] }>(
                `${this.apiUrl}reportes-produccion`,
                { params }
            )
            .pipe(
                map(resp => resp.data),
                catchError(err => {
                    console.error('Error al obtener reportes de producción', err);
                    return throwError(() => new Error(err.message || 'Error desconocido'));
                })
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
            .get<{ success: boolean; data: ProduccionTejido[] }>(
                `${this.apiUrl}reportes-produccion/tejido`,
                { params }
            )
            .pipe(
                map(resp => resp.data),
                catchError(err => {
                    console.error('Error al obtener producción de tejido', err);
                    return throwError(() => new Error(err.message || 'Error desconocido'));
                })
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
            .get<{ success: boolean; data: RevisadoTejido[] }>(
                `${this.apiUrl}reportes-produccion/revisado`,
                { params }
            )
            .pipe(
                map(resp => resp.data),
                catchError(err => {
                    console.error('Error al obtener revisado de tejido', err);
                    return throwError(() => new Error(err.message || 'Error desconocido'));
                })
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
            .get<{ success: boolean; data: PorRevisarTejido[] }>(
                `${this.apiUrl}reportes-produccion/pendientes`,
                { params }
            )
            .pipe(
                map(resp => resp.data),
                catchError(err => {
                    console.error('Error al obtener por revisar de tejido', err);
                    return throwError(() => new Error(err.message || 'Error desconocido'));
                })
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
            .get<{ success: boolean; data: SaldosTejido[] }>(
                `${this.apiUrl}reportes-produccion/con-saldo`,
                { params }
            )
            .pipe(
                map(resp => resp.data),
                catchError(err => {
                    console.error('Error al obtener saldos de tejido', err);
                    return throwError(() => new Error(err.message || 'Error desconocido'));
                })
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
            .get<{ success: boolean; data: any[] }>(
                `${this.apiUrl}reportes-produccion/entregado-embarques`, // 🔥 VERIFICA ESTA RUTA
                { params }
            )
            .pipe(
                map(resp => {
                    // console.log('🔧 SERVICE: Respuesta del servidor:', resp);
                    return resp.data || []; // 🔥 ASEGÚRATE DE RETORNAR resp.data
                }),
                catchError(err => {
                    console.error('🔧 SERVICE: Error en petición:', err);
                    return throwError(() => new Error(err.message || 'Error desconocido'));
                })
            );
    }
}