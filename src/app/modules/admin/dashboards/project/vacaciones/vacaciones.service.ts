import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class VacacionesService {

    añoActual = new Date().getFullYear();

    /**
     * Obtiene las solicitudes ordenadas por fecha (más recientes primero)
     */
    solicitudesOrdenadas(user: any): any[] {
        // Filtrar solicitudes con status_id 3, 4 o 5 y título "Vacaciones"
        const solicitudesVacaciones = user.workorders_solicitadas.filter(
            (wo: any) => wo.titulo === 'Vacaciones' && [3, 4, 5].includes(wo.status_id)
        );
        const historialVacaciones = user?.vacaciones?.[0]?.historial ?? [];

        // Ordenar workorders por created_at (del historial más reciente)
        const workordersOrdenadas = [...solicitudesVacaciones].sort((a: any, b: any) => {
            const fechaA = this.parseFecha(a.fecha_solicitud || a.created_at);
            const fechaB = this.parseFecha(b.fecha_solicitud || b.created_at);
            return fechaB.getTime() - fechaA.getTime();
        });

        // Ordenar historial por created_at (más reciente primero)
        const historialOrdenado = [...historialVacaciones].sort((a: any, b: any) => {
            return this.parseFecha(b.created_at).getTime() - this.parseFecha(a.created_at).getTime();
        });

        // Mapear solicitudes usando el historial (1 a 1 por índice)
        const solicitudesMapeadas = workordersOrdenadas.map((wo: any, index: number) => {
            const historial = historialOrdenado[index];
            return {
                id: wo.id,
                fecha_inicio: historial?.fecha_inicio ?? 'N/A',
                fecha_fin: historial?.fecha_fin ?? 'N/A',
                dias_solicitados: historial?.dias ?? 'N/A',
                fecha_solicitud: this.formatearFechaCorta(wo.fecha_solicitud || wo.created_at),
                motivo: wo.descripcion || historial?.comentarios || '',
                estado: this.mapearEstado(wo.status_id),
                status_id: wo.status_id
            };
        });

        return solicitudesMapeadas;
    }


    convertirFechaISOaDDMMYYYY(iso: string): string {
        // De "2025-12-16" a "16/12/2025"
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    }

    /**
     * Mapea el status_id a un estado legible
     * 3 = Aprobada
     * 4 = Rechazada
     * 5 = En Proceso (Pendiente)
     */
    private mapearEstado(statusId: number): string {
        const estados = {
            3: 'aprobada',
            4: 'rechazada',
            5: 'pendiente'
        };
        return estados[statusId] || 'pendiente';
    }

    /**
     * Formatea una fecha a formato corto (DD/MM/YYYY)
     */
    private formatearFechaCorta(fecha: string): string {
        if (!fecha) return 'N/A';

        try {
            // Si ya está en formato DD/MM/YYYY HH:mm:ss, extraer solo la fecha
            if (fecha.includes('/')) {
                return fecha.split(' ')[0];
            }

            // Si es ISO date
            const date = new Date(fecha);
            const dia = String(date.getDate()).padStart(2, '0');
            const mes = String(date.getMonth() + 1).padStart(2, '0');
            const año = date.getFullYear();
            return `${dia}/${mes}/${año}`;
        } catch {
            return fecha;
        }
    }

    /**
     * Obtiene el ícono según el estado de la solicitud
     */
    getEstadoIcon(estado: string): string {
        const iconMap = {
            'aprobada': 'heroicons_outline:check-circle',
            'pendiente': 'heroicons_outline:clock',
            'rechazada': 'heroicons_outline:x-circle',
            'cancelada': 'heroicons_outline:ban'
        };
        return iconMap[estado?.toLowerCase()] || 'heroicons_outline:document-text';
    }

    /**
     * Verifica si hay datos suficientes para mostrar la gráfica
     */
    hasVacacionesChartData(periodo: string, chartSeries: any): boolean {
        const series = chartSeries[periodo];
        if (!series || series.length === 0) return false;

        // Para gráficas de pie/donut, verificar que haya al menos un valor > 0
        if (Array.isArray(series) && typeof series[0] === 'number') {
            return series.some(val => val > 0);
        }

        return true;
    }

    /**
     * Genera los datos para la gráfica de distribución de vacaciones
     */
    generarDatosGrafica(user: any, periodo: string): number[] {
        if (!user?.vacaciones?.[0]) return [0, 0, 0];

        const vacaciones = user.vacaciones[0];

        if (periodo === 'actual') {
            return [
                vacaciones.dias_disponibles || 0,
                vacaciones.dias_disfrutados || 0,
                Math.max(0, (vacaciones.dias_totales || 0) -
                    (vacaciones.dias_disponibles || 0) -
                    (vacaciones.dias_disfrutados || 0))
            ];
        } else if (periodo === 'anterior') {
            return this.obtenerDatosAñoAnterior(vacaciones);
        } else if (periodo === 'historico') {
            return this.obtenerDatosHistoricos(vacaciones);
        }

        return [0, 0, 0];
    }

    /**
     * Obtiene datos del año anterior desde el historial
     */
    private obtenerDatosAñoAnterior(vacaciones: any): number[] {
        if (!vacaciones?.historial || vacaciones.historial.length === 0) return [0, 0, 0];

        const añoAnterior = this.añoActual - 1;
        const historialAñoAnterior = vacaciones.historial.filter(h => {
            if (!h.fecha_inicio) return false;
            const [d, m, y] = h.fecha_inicio.split('/').map(Number);
            return y === añoAnterior;
        });

        const diasDisfrutados = historialAñoAnterior.reduce((acc, h) => {
            return acc + (h.dias || this.calcularDiasEntreFechas(h.fecha_inicio, h.fecha_fin));
        }, 0);

        const diasTotales = 12; // Estándar
        const diasDisponibles = Math.max(0, diasTotales - diasDisfrutados);

        return [diasDisponibles, diasDisfrutados, 0];
    }

    /**
     * Obtiene datos históricos acumulados
     */
    private obtenerDatosHistoricos(vacaciones: any): number[] {
        if (!vacaciones?.historial || vacaciones.historial.length === 0) return [0, 0, 0];

        const totalDisfrutados = vacaciones.historial.reduce((acc, h) => {
            return acc + (h.dias || this.calcularDiasEntreFechas(h.fecha_inicio, h.fecha_fin));
        }, 0);

        const añosTrabajados = this.calcularAñosTrabajados(vacaciones);
        const diasTotalesHistoricos = añosTrabajados * 12;

        return [
            vacaciones.dias_disponibles || 0,
            totalDisfrutados,
            Math.max(0, diasTotalesHistoricos - totalDisfrutados - (vacaciones.dias_disponibles || 0))
        ];
    }

    /**
     * Calcula los días entre dos fechas
     */
    private calcularDiasEntreFechas(fechaInicio: string, fechaFin: string): number {
        if (!fechaInicio || !fechaFin) return 0;

        try {
            const [d1, m1, y1] = fechaInicio.split('/').map(Number);
            const [d2, m2, y2] = fechaFin.split('/').map(Number);

            const inicio = new Date(y1, m1 - 1, d1);
            const fin = new Date(y2, m2 - 1, d2);

            const diffTime = Math.abs(fin.getTime() - inicio.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            return diffDays;
        } catch {
            return 0;
        }
    }

    /**
     * Calcula años trabajados desde el inicio
     */
    private calcularAñosTrabajados(vacaciones: any): number {
        if (!vacaciones?.fecha_inicio) return 1;

        try {
            const [d, m, y] = vacaciones.fecha_inicio.split('/').map(Number);
            const fechaInicio = new Date(y, m - 1, d);
            const hoy = new Date();

            const diffTime = hoy.getTime() - fechaInicio.getTime();
            const años = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));

            return Math.max(1, años);
        } catch {
            return 1;
        }
    }

    /**
     * Parsea una fecha en formato DD/MM/YYYY o ISO
     */
    private parseFecha(fecha: string): Date {
        if (!fecha) return new Date(0);

        try {
            // Si es formato ISO (YYYY-MM-DD) o tiene timestamp
            if (fecha.includes('-')) {
                return new Date(fecha);
            }

            // Si es formato DD/MM/YYYY
            const fechaSolo = fecha.split(' ')[0]; // Remover hora si existe
            const [d, m, y] = fechaSolo.split('/').map(Number);
            return new Date(y, m - 1, d);
        } catch {
            return new Date(0);
        }
    }

    /**
     * Formatea el estado para mostrar en la UI
     */
    formatearEstado(estado: string): string {
        const estados = {
            'aprobada': 'Aprobada',
            'pendiente': 'En Proceso',
            'rechazada': 'Rechazada',
            'cancelada': 'Cancelada'
        };
        return estados[estado?.toLowerCase()] || estado;
    }

    /**
     * Calcula el porcentaje de vacaciones utilizadas
     */
    calcularPorcentajeUtilizado(user: any): number {
        if (!user?.vacaciones?.[0]) return 0;

        const vacaciones = user.vacaciones[0];
        const total = vacaciones.dias_totales || 0;
        const disfrutados = vacaciones.dias_disfrutados || 0;

        if (total === 0) return 0;

        return Math.round((disfrutados / total) * 100);
    }

    /**
     * Obtiene el color según el porcentaje de vacaciones disponibles
     */
    obtenerColorDisponibilidad(porcentajeDisponible: number): string {
        if (porcentajeDisponible >= 70) return 'green';
        if (porcentajeDisponible >= 40) return 'amber';
        return 'red';
    }

    /**
     * Verifica si hay solicitudes pendientes (status_id = 5)
     */
    tieneSolicitudesPendientes(user: any): boolean {
        if (!user?.workorders_solicitadas) return false;

        return user.workorders_solicitadas.some(
            wo => wo.titulo === 'Vacaciones' && wo.status_id === 5
        );
    }
}