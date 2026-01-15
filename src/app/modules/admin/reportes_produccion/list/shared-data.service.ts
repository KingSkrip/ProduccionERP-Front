// import { Injectable } from '@angular/core';
// import { BehaviorSubject, Observable } from 'rxjs';

// export interface FiltrosGlobales {
//     busqueda: string;
//     departamento: string;
//     proceso: string;
//     tipoEmbarque: string;
//     fechaInicio: Date | null;
//     fechaFin: Date | null;
//     rangoFecha: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo';
// }

// @Injectable({ providedIn: 'root' })
// export class SharedDataService {

//     // =======================
//     // 🔥 FILTROS GLOBALES
//     // =======================
//     private filtrosGlobalesSource = new BehaviorSubject<FiltrosGlobales>({
//         busqueda: '',
//         departamento: '',
//         proceso: '',
//         tipoEmbarque: '',
//         fechaInicio: null,
//         fechaFin: null,
//         rangoFecha: 'mes_actual'
//     });

//     filtrosGlobales$ = this.filtrosGlobalesSource.asObservable();

//     // 🔥 NUEVO: Signal para forzar recarga de datos cuando cambian fechas
//     private recargarDatosSource = new BehaviorSubject<boolean>(false);
//     recargarDatos$ = this.recargarDatosSource.asObservable();

//     // actualizarFiltros(filtros: Partial<FiltrosGlobales>): void {
//     //     const filtrosActuales = this.filtrosGlobalesSource.value;
//     //     this.filtrosGlobalesSource.next({ ...filtrosActuales, ...filtros });

//     //     // 🔥 Si cambian las fechas, disparar recarga
//     //     if (filtros.fechaInicio !== undefined || filtros.fechaFin !== undefined || filtros.rangoFecha !== undefined) {
//     //         this.recargarDatosSource.next(true);
//     //     }
//     // }

//     actualizarFiltros(filtros: Partial<FiltrosGlobales>): void {
//         const filtrosActuales = this.filtrosGlobalesSource.value;
//         const nuevasFiltros = { ...filtrosActuales, ...filtros };
//         this.filtrosGlobalesSource.next(nuevasFiltros);

//         // 🔥 SOLO disparar recarga si cambian EXPLÍCITAMENTE las fechas (no cuando cambia departamento/búsqueda)
//         const cambioFechas = (
//             filtros.fechaInicio !== undefined || 
//             filtros.fechaFin !== undefined || 
//             filtros.rangoFecha !== undefined
//         );

//         // NO disparar recarga si solo cambió búsqueda, departamento o proceso
//         const soloCambioDeFiltrosSimples = (
//             !cambioFechas && 
//             (filtros.busqueda !== undefined || 
//              filtros.departamento !== undefined || 
//              filtros.proceso !== undefined ||
//              filtros.tipoEmbarque !== undefined)
//         );

//         if (cambioFechas && !soloCambioDeFiltrosSimples) {
//             this.recargarDatosSource.next(true);
//         }
//     }

//     obtenerFiltros(): FiltrosGlobales {
//         return this.filtrosGlobalesSource.value;
//     }

//     // =======================
//     // PRODUCCIÓN / PROCESOS (DATOS)
//     // =======================
//     private datosSource = new BehaviorSubject<any[]>([]);
//     private datosFiltradosSource = new BehaviorSubject<any[]>([]);

//     datos$ = this.datosSource.asObservable();
//     datosFiltrados$ = this.datosFiltradosSource.asObservable();

//     actualizarDatos(datos: any[], datosFiltrados: any[]): void {
//         this.datosSource.next(datos);
//         this.datosFiltradosSource.next(datosFiltrados);
//     }

//     // =======================
//     // ESTAMPADOS
//     // =======================
//     private datosEstampadosSource = new BehaviorSubject<any[]>([]);
//     datosEstampados$ = this.datosEstampadosSource.asObservable();

//     actualizarEstampados(datos: any[]): void {
//         this.datosEstampadosSource.next(datos);
//     }

//     // =======================
//     // TINTORERÍA
//     // =======================
//     private datosTintoreriaSource = new BehaviorSubject<any[]>([]);
//     datosTintoreria$ = this.datosTintoreriaSource.asObservable();

//     actualizarTintoreria(datos: any[]): void {
//         this.datosTintoreriaSource.next(datos);
//     }

//     // =======================
//     // TEJIDO
//     // =======================
//     private datosTejidoSource = new BehaviorSubject<any[]>([]);
//     private datosTejidoFiltradosSource = new BehaviorSubject<any[]>([]);

//     datosTejido$ = this.datosTejidoSource.asObservable();
//     datosTejidoFiltrados$ = this.datosTejidoFiltradosSource.asObservable();

//     actualizarTejido(datos: any[], datosFiltrados: any[]): void {
//         this.datosTejidoSource.next(datos);
//         this.datosTejidoFiltradosSource.next(datosFiltrados);
//     }

//     // =======================
//     // REVISADO DE TEJIDO
//     // =======================
//     private datosRevisadoSource = new BehaviorSubject<any[]>([]);
//     private datosRevisadoFiltradosSource = new BehaviorSubject<any[]>([]);

//     datosRevisado$ = this.datosRevisadoSource.asObservable();
//     datosRevisadoFiltrados$ = this.datosRevisadoFiltradosSource.asObservable();

//     actualizarRevisado(datos: any[], datosFiltrados: any[]): void {
//         this.datosRevisadoSource.next(datos);
//         this.datosRevisadoFiltradosSource.next(datosFiltrados);
//     }

//     // =======================
//     // POR REVISAR
//     // =======================
//     private datosPorRevisarSource = new BehaviorSubject<any[]>([]);
//     private datosPorRevisarFiltradosSource = new BehaviorSubject<any[]>([]);

//     datosPorRevisar$ = this.datosPorRevisarSource.asObservable();
//     datosPorRevisarFiltrados$ = this.datosPorRevisarFiltradosSource.asObservable();

//     actualizarPorRevisar(datos: any[], datosFiltrados: any[]): void {
//         this.datosPorRevisarSource.next(datos);
//         this.datosPorRevisarFiltradosSource.next(datosFiltrados);
//     }

//     // =======================
//     // SALDOS
//     // =======================
//     private datosSaldosSource = new BehaviorSubject<any[]>([]);
//     private datosSaldosFiltradosSource = new BehaviorSubject<any[]>([]);

//     datosSaldos$ = this.datosSaldosSource.asObservable();
//     datosSaldosFiltrados$ = this.datosSaldosFiltradosSource.asObservable();

//     actualizarSaldos(datos: any[], datosFiltrados: any[]): void {
//         this.datosSaldosSource.next(datos);
//         this.datosSaldosFiltradosSource.next(datosFiltrados);
//     }

//     // =======================
//     // EMBARQUES
//     // =======================
//     private datosEmbarquesSource = new BehaviorSubject<any[]>([]);
//     private datosEmbarquesFiltradosSource = new BehaviorSubject<any[]>([]);

//     datosEmbarques$ = this.datosEmbarquesSource.asObservable();
//     datosEmbarquesFiltrados$ = this.datosEmbarquesFiltradosSource.asObservable();

//     actualizarEmbarques(datos: any[], datosFiltrados: any[]): void {
//         this.datosEmbarquesSource.next(datos);
//         this.datosEmbarquesFiltradosSource.next(datosFiltrados);
//     }

//     // =======================
// // FACTURADO
// // =======================
// private datosFacturadoSource = new BehaviorSubject<any>(null);
// datosFacturado$ = this.datosFacturadoSource.asObservable();

// actualizarFacturado(data: any): void {
//   this.datosFacturadoSource.next(data);
// }

// confirmarRecargaConsumida(): void {
//   this.recargarDatosSource.next(false);
// }


//     // =======================
//     // LIMPIEZA OPCIONAL
//     // =======================
//     limpiarTodo(): void {
//         this.datosSource.next([]);
//         this.datosFiltradosSource.next([]);
//         this.datosEstampadosSource.next([]);
//         this.datosTintoreriaSource.next([]);
//         this.datosTejidoSource.next([]);
//         this.datosTejidoFiltradosSource.next([]);
//         this.datosRevisadoSource.next([]);
//         this.datosRevisadoFiltradosSource.next([]);
//         this.datosPorRevisarSource.next([]);
//         this.datosPorRevisarFiltradosSource.next([]);
//         this.datosEmbarquesSource.next([]);
//         this.datosEmbarquesFiltradosSource.next([]);
//         this.datosSaldosSource.next([]);
//         this.datosSaldosFiltradosSource.next([]);
//     }

//     limpiarFiltros(): void {
//         this.filtrosGlobalesSource.next({
//             busqueda: '',
//             departamento: '',
//             proceso: '',
//             tipoEmbarque: '',
//             fechaInicio: null,
//             fechaFin: null,
//             rangoFecha: 'mes_actual'
//         });
//     }
// }


import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface FiltrosGlobales {
    busqueda: string;
    departamento: string;
    proceso: string;
    tipoEmbarque: string;
    fechaInicio: Date | null;
    fechaFin: Date | null;
    rangoFecha: 'todos' | 'hoy' | 'ayer' | 'mes_actual' | 'mes_anterior' | 'fecha_especifica' | 'periodo';
}

@Injectable({ providedIn: 'root' })
export class SharedDataService {

    // =======================
    // 🔥 FILTROS GLOBALES
    // =======================
    private filtrosGlobalesSource = new BehaviorSubject<FiltrosGlobales>({
        busqueda: '',
        departamento: '',
        proceso: '',
        tipoEmbarque: '',
        fechaInicio: null,
        fechaFin: null,
        rangoFecha: 'mes_actual'
    });

    filtrosGlobales$ = this.filtrosGlobalesSource.asObservable();

    // 🔥 Signal para forzar recarga de datos cuando cambian fechas
    private recargarDatosSource = new BehaviorSubject<boolean>(false);
    recargarDatos$ = this.recargarDatosSource.asObservable();

    actualizarFiltros(filtros: Partial<FiltrosGlobales>): void {
        const filtrosActuales = this.filtrosGlobalesSource.value;
        const nuevasFiltros = { ...filtrosActuales, ...filtros };
        this.filtrosGlobalesSource.next(nuevasFiltros);

        // 🔥 SOLO disparar recarga si cambian EXPLÍCITAMENTE las fechas o rangoFecha
        const cambioFechas = (
            filtros.fechaInicio !== undefined ||
            filtros.fechaFin !== undefined ||
            filtros.rangoFecha !== undefined
        );

        // Si cambió rango de fecha, disparar recarga
        if (cambioFechas) {
            this.recargarDatosSource.next(true);
        }
    }

    obtenerFiltros(): FiltrosGlobales {
        return this.filtrosGlobalesSource.value;
    }

    // =======================
    // PRODUCCIÓN / PROCESOS (DATOS)
    // =======================
    private datosSource = new BehaviorSubject<any[]>([]);
    private datosFiltradosSource = new BehaviorSubject<any[]>([]);

    datos$ = this.datosSource.asObservable();
    datosFiltrados$ = this.datosFiltradosSource.asObservable();

    actualizarDatos(datos: any[], datosFiltrados: any[]): void {
        this.datosSource.next(datos);
        this.datosFiltradosSource.next(datosFiltrados);
    }

    // =======================
    // ESTAMPADOS
    // =======================
    private datosEstampadosSource = new BehaviorSubject<any[]>([]);
    datosEstampados$ = this.datosEstampadosSource.asObservable();

    actualizarEstampados(datos: any[]): void {
        this.datosEstampadosSource.next(datos);
    }

    // =======================
    // TINTORERÍA
    // =======================
    private datosTintoreriaSource = new BehaviorSubject<any[]>([]);
    datosTintoreria$ = this.datosTintoreriaSource.asObservable();

    actualizarTintoreria(datos: any[]): void {
        this.datosTintoreriaSource.next(datos);
    }

    // =======================
    // TEJIDO
    // =======================
    private datosTejidoSource = new BehaviorSubject<any[]>([]);
    private datosTejidoFiltradosSource = new BehaviorSubject<any[]>([]);

    datosTejido$ = this.datosTejidoSource.asObservable();
    datosTejidoFiltrados$ = this.datosTejidoFiltradosSource.asObservable();

    actualizarTejido(datos: any[], datosFiltrados: any[]): void {
        this.datosTejidoSource.next(datos);
        this.datosTejidoFiltradosSource.next(datosFiltrados);
    }

    // =======================
    // REVISADO DE TEJIDO
    // =======================
    private datosRevisadoSource = new BehaviorSubject<any[]>([]);
    private datosRevisadoFiltradosSource = new BehaviorSubject<any[]>([]);

    datosRevisado$ = this.datosRevisadoSource.asObservable();
    datosRevisadoFiltrados$ = this.datosRevisadoFiltradosSource.asObservable();

    actualizarRevisado(datos: any[], datosFiltrados: any[]): void {
        this.datosRevisadoSource.next(datos);
        this.datosRevisadoFiltradosSource.next(datosFiltrados);
    }

    // =======================
    // POR REVISAR
    // =======================
    private datosPorRevisarSource = new BehaviorSubject<any[]>([]);
    private datosPorRevisarFiltradosSource = new BehaviorSubject<any[]>([]);

    datosPorRevisar$ = this.datosPorRevisarSource.asObservable();
    datosPorRevisarFiltrados$ = this.datosPorRevisarFiltradosSource.asObservable();

    actualizarPorRevisar(datos: any[], datosFiltrados: any[]): void {
        this.datosPorRevisarSource.next(datos);
        this.datosPorRevisarFiltradosSource.next(datosFiltrados);
    }

    // =======================
    // SALDOS
    // =======================
    private datosSaldosSource = new BehaviorSubject<any[]>([]);
    private datosSaldosFiltradosSource = new BehaviorSubject<any[]>([]);

    datosSaldos$ = this.datosSaldosSource.asObservable();
    datosSaldosFiltrados$ = this.datosSaldosFiltradosSource.asObservable();

    actualizarSaldos(datos: any[], datosFiltrados: any[]): void {
        this.datosSaldosSource.next(datos);
        this.datosSaldosFiltradosSource.next(datosFiltrados);
    }

    // =======================
    // EMBARQUES
    // =======================
    private datosEmbarquesSource = new BehaviorSubject<any[]>([]);
    private datosEmbarquesFiltradosSource = new BehaviorSubject<any[]>([]);

    datosEmbarques$ = this.datosEmbarquesSource.asObservable();
    datosEmbarquesFiltrados$ = this.datosEmbarquesFiltradosSource.asObservable();

    actualizarEmbarques(datos: any[], datosFiltrados: any[]): void {
        this.datosEmbarquesSource.next(datos);
        this.datosEmbarquesFiltradosSource.next(datosFiltrados);
    }

    // =======================
    // FACTURADO
    // =======================

    private datosFacturadoSource = new BehaviorSubject<any>(null);
    datosFacturado$ = this.datosFacturadoSource.asObservable();

    actualizarFacturado(data: any): void {
        this.datosFacturadoSource.next(data);
    }

    confirmarRecargaConsumida(): void {
        this.recargarDatosSource.next(false);
    }

    // =======================
    // LIMPIEZA OPCIONAL
    // =======================
    limpiarTodo(): void {
        this.datosSource.next([]);
        this.datosFiltradosSource.next([]);
        this.datosEstampadosSource.next([]);
        this.datosTintoreriaSource.next([]);
        this.datosTejidoSource.next([]);
        this.datosTejidoFiltradosSource.next([]);
        this.datosRevisadoSource.next([]);
        this.datosRevisadoFiltradosSource.next([]);
        this.datosPorRevisarSource.next([]);
        this.datosPorRevisarFiltradosSource.next([]);
        this.datosEmbarquesSource.next([]);
        this.datosEmbarquesFiltradosSource.next([]);
        this.datosSaldosSource.next([]);
        this.datosSaldosFiltradosSource.next([]);
        this.datosFacturadoSource.next(null);
    }

    limpiarFiltros(): void {
        this.filtrosGlobalesSource.next({
            busqueda: '',
            departamento: '',
            proceso: '',
            tipoEmbarque: '',
            fechaInicio: null,
            fechaFin: null,
            rangoFecha: 'mes_actual'
        });
    }
}