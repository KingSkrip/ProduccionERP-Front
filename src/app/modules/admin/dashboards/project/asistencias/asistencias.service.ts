import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AsistenciasService {

    añoActual = new Date().getFullYear();

    totalAsistencias(user: any, año: number): number {
        if (!user?.asistencias) return 0;

        return user.asistencias.filter(a => {
            const [d, m, y] = a.fecha.split('/').map(Number);
            if (y !== año) return false;
            const fecha = new Date(y, m - 1, d);
            const dia = fecha.getDay();
            return dia !== 0 && dia !== 6;
        }).length;
    }

    totalRetardos(user: any, año: number): number {
        if (!user?.asistencias) return 0;

        return user.asistencias.filter(a => {
            const [d, m, y] = a.fecha.split('/').map(Number);
            if (y !== año) return false;
            const fecha = new Date(y, m - 1, d);
            const dia = fecha.getDay();
            if (dia === 0 || dia === 6) return false;
            return this.isRetardo(a);
        }).length;
    }

    horasTrabajadas(user: any, año: number): number {
        if (!user?.asistencias) return 0;
        const ahora = new Date();

        const total = user.asistencias.reduce((acc, a) => {
            if (!a.fecha || !a.hora_entrada) return acc;
            const [d, m, y] = a.fecha.split('/').map(Number);
            if (y !== año) return acc;

            const fecha = new Date(y, m - 1, d);
            const dia = fecha.getDay();
            if (dia === 0 || dia === 6) return acc;

            const [hE, mE, sE] = a.hora_entrada.split(':').map(Number);
            const entrada = new Date(y, m - 1, d, hE, mE, sE);

            let salida = ahora;
            if (a.hora_salida) {
                const [hS, mS, sS] = a.hora_salida.split(':').map(Number);
                salida = new Date(y, m - 1, d, hS, mS, sS);
            }

            if (salida <= entrada) return acc;

            return acc + (salida.getTime() - entrada.getTime()) / 36e5;
        }, 0);

        return Math.round(total * 100) / 100;
    }

    asistenciasOrdenadas(user: any) {
        if (!user?.asistencias) return [];
        return [...user.asistencias].sort(
            (a, b) => this.toDateTime(b).getTime() - this.toDateTime(a).getTime()
        );
    }

    private toDateTime(a: any): Date {
        const [d, m, y] = a.fecha.split('/').map(Number);
        const [h, min, s] = (a.hora_entrada ?? '00:00:00').split(':').map(Number);
        return new Date(y, m - 1, d, h, min, s);
    }


    isRetardo(asistencia: any): boolean {
        if (!asistencia.turno) return false;

        const [h, m, s] = asistencia.turno.hora_inicio.split(':').map(Number);
        const [hA, mA, sA] = asistencia.hora_entrada.split(':').map(Number);

        const limite = new Date(2000, 0, 1, h, m + 15, s);
        const entrada = new Date(2000, 0, 1, hA, mA, sA);

        return entrada > limite;
    }

    agruparPorMeses(asistencias: any[], fechaInicioEmpleo: Date) {
        const meses = Array(12).fill(0).map(() => ({
            asistencias: 0,
            retardos: 0,
            faltas: 0
        }));

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const asistenciaMap = new Map(asistencias.map(a => [a.fecha, a]));

        for (let mes = fechaInicioEmpleo.getMonth(); mes <= hoy.getMonth(); mes++) {
            const ultimoDia = new Date(this.añoActual, mes + 1, 0).getDate();
            let diasLaborables = 0;
            let asistenciasMes = 0;
            let retardosMes = 0;

            for (let dia = 1; dia <= ultimoDia; dia++) {
                const fecha = new Date(this.añoActual, mes, dia);
                fecha.setHours(0, 0, 0, 0);

                if (fecha < fechaInicioEmpleo || fecha > hoy) continue;
                if (fecha.getDay() === 0 || fecha.getDay() === 6) continue;

                diasLaborables++;

                const fechaStr = `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${this.añoActual}`;
                const asistencia = asistenciaMap.get(fechaStr);

                if (asistencia) {
                    asistenciasMes++;
                    if (this.isRetardo(asistencia)) retardosMes++;
                }
            }

            meses[mes].asistencias = asistenciasMes;
            meses[mes].retardos = retardosMes;
            meses[mes].faltas = Math.max(0, diasLaborables - asistenciasMes);
        }

        return {
            asistencias: meses.map(m => m.asistencias),
            retardos: meses.map(m => m.retardos),
            faltas: meses.map(m => m.faltas)
        };
    }

    agruparPorSemanasDelMes(asistencias: any[], fechaInicioEmpleo: Date, vacaciones: any[]) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const mes = hoy.getMonth();
        const año = hoy.getFullYear();

        const asistenciasMes = asistencias.filter(a => {
            const [d, m, y] = a.fecha.split('/').map(Number);
            return m - 1 === mes && y === año;
        });

        if (!asistenciasMes.length) {
            return { asistencias: [], retardos: [], faltas: [] };
        }

        const asistenciaMap = new Map(asistenciasMes.map(a => [a.fecha, a]));

        const inicioMes = new Date(año, mes, 1);
        const finMes = new Date(año, mes + 1, 0);

        inicioMes.setDate(inicioMes.getDate() - ((inicioMes.getDay() + 6) % 7));

        const asistenciasArr: number[] = [];
        const retardosArr: number[] = [];
        const faltasArr: number[] = [];

        while (inicioMes <= finMes) {
            let asistenciasSemana = 0;
            let retardosSemana = 0;
            let diasLaborables = 0;

            for (let i = 0; i < 7; i++) {
                const dia = new Date(inicioMes);
                dia.setDate(inicioMes.getDate() + i);
                dia.setHours(0, 0, 0, 0);

                if (dia.getMonth() !== mes) continue;
                if (dia < fechaInicioEmpleo || dia > hoy) continue;
                if (dia.getDay() === 0 || dia.getDay() === 6) continue;
                if (this.esVacacion(dia, vacaciones)) continue;

                diasLaborables++;

                const fechaStr = `${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}/${dia.getFullYear()}`;
                const asistencia = asistenciaMap.get(fechaStr);

                if (asistencia) {
                    asistenciasSemana++;
                    if (this.isRetardo(asistencia)) retardosSemana++;
                }
            }

            if (diasLaborables > 0) {
                asistenciasArr.push(asistenciasSemana);
                retardosArr.push(retardosSemana);
                faltasArr.push(Math.max(0, diasLaborables - asistenciasSemana));
            }

            inicioMes.setDate(inicioMes.getDate() + 7);
        }

        return {
            asistencias: asistenciasArr,
            retardos: retardosArr,
            faltas: faltasArr
        };
    }

    private esVacacion(fecha: Date, vacaciones: any[]): boolean {
        if (!vacaciones?.length) return false;

        for (const vac of vacaciones) {
            for (const h of vac.historial || []) {
                const inicio = new Date(h.fecha_inicio.split('/').reverse().join('-'));
                const fin = new Date(h.fecha_fin.split('/').reverse().join('-'));

                inicio.setHours(0, 0, 0, 0);
                fin.setHours(23, 59, 59, 999);

                if (fecha >= inicio && fecha <= fin) return true;
            }
        }
        return false;
    }
}
