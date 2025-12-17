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

@Injectable({ providedIn: 'root' })
export class ReportProdService {
    private readonly apiUrl = APP_CONFIG.apiUrl;

    constructor(private _httpClient: HttpClient) { }

    /**
     * GET → Obtener reportes de producción con filtros de fecha
     */
    getReportesProduccion(fechaInicio?: Date, fechaFin?: Date): Observable<ReporteProduccion[]> {
        let params = new HttpParams();

        // Formatear fechas para Firebird (dd.MM.yyyy HH:mm:ss)
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
}