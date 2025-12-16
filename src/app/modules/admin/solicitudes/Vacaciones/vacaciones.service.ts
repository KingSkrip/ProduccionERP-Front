import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, switchMap, take, tap, throwError } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Usuarios } from '../../cruds/usuarios/usuarios.types';

export interface VacacionSolicitud {
    id: number;
    vacacion_id: number;
    fecha_inicio: string;
    fecha_fin: string;
    dias: number;
    comentarios: string;
    created_at: string;
    updated_at: string;
    vacacion?: {
        id: number;
        user_id: number;
        anio: number;
        dias_disponibles: number;
        dias_disfrutados: number;
        user?: Usuarios;
    };
}

export interface WorkOrder {
    id: number;
    solicitante_id: number;
    aprobador_id: number;
    status_id: number;
    titulo: string;
    descripcion: string;
    fecha_solicitud: string;
    comentarios_solicitante: string;
    departamento_id: number;
    solicitante?: Usuarios;
    status?: {
        id: number;
        nombre: string;
    };
}

@Injectable({ providedIn: 'root' })
export class VacacionesService {
    private _usuarios: BehaviorSubject<Usuarios[] | null> = new BehaviorSubject<Usuarios[] | null>(null);
    private _solicitudes: BehaviorSubject<any[] | null> = new BehaviorSubject<any[] | null>(null);
    private apiUrl = APP_CONFIG.apiUrl;

    constructor(private _httpClient: HttpClient) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get usuarios$(): Observable<Usuarios[]> {
        return this._usuarios.asObservable();
    }

    get solicitudes$(): Observable<any[]> {
        return this._solicitudes.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Usuarios
    // -----------------------------------------------------------------------------------------------------

    getUsuarios(): Observable<Usuarios[]> {
        return this._httpClient.get<{ message: string, data: Usuarios[] }>(`${this.apiUrl}colaborador/data`)
            .pipe(
                tap(response => this._usuarios.next(response.data)),
                map(response => response.data),
                catchError(error => {
                    console.error('Error al obtener usuarios', error);
                    return throwError(() => error);
                })
            );
    }

    getUsuarioById(id: string): Observable<Usuarios> {
        return this._httpClient.get<{ message: string, user: Usuarios }>(`${this.apiUrl}colaborador/suadmin/${id}`)
            .pipe(
                map(response => response.user),
                catchError(error => {
                    console.error('Error al obtener usuario', error);
                    return throwError(() => error);
                })
            );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Vacaciones
    // -----------------------------------------------------------------------------------------------------

    /**
     * Obtener todas las solicitudes de vacaciones de mis empleados
     */
    getSolicitudesVacaciones(): Observable<any[]> {
        return this._httpClient.get<{ message: string, data: any }>(`${this.apiUrl}colaboradores/vacaciones/1/edit`)
            .pipe(
                tap(response => {
                    // Procesar datos para extraer solicitudes pendientes
                    const solicitudes = this.procesarSolicitudes(response.data);
                    this._solicitudes.next(solicitudes);
                }),
                map(response => this.procesarSolicitudes(response.data)),
                catchError(error => {
                    console.error('Error al obtener solicitudes', error);
                    return throwError(() => error);
                })
            );
    }

    /**
     * Procesar los datos del usuario para extraer las solicitudes de vacaciones
     */
    private procesarSolicitudes(usuarios: any[]): any[] {
        const solicitudes = [];
        
        if (!usuarios || !Array.isArray(usuarios)) {
            return [];
        }

        usuarios.forEach(usuario => {
            // Buscar work orders de tipo "Vacaciones" con status pendiente (5)
            if (usuario.workorders_solicitadas && Array.isArray(usuario.workorders_solicitadas)) {
                const solicitudesPendientes = usuario.workorders_solicitadas.filter(
                    wo => wo.titulo === 'Vacaciones' && wo.status_id === 5
                );

                solicitudesPendientes.forEach(wo => {
                    // Buscar el historial de vacaciones correspondiente
                    let historialVacacion = null;
                    if (usuario.vacaciones && Array.isArray(usuario.vacaciones)) {
                        usuario.vacaciones.forEach(vac => {
                            if (vac.historial && Array.isArray(vac.historial)) {
                                const hist = vac.historial.find(h => 
                                    h.vacacion_id === vac.id
                                );
                                if (hist) {
                                    historialVacacion = {
                                        ...hist,
                                        dias_disponibles: vac.dias_disponibles,
                                        dias_disfrutados: vac.dias_disfrutados
                                    };
                                }
                            }
                        });
                    }

                    solicitudes.push({
                        workorder: wo,
                        usuario: usuario,
                        historial: historialVacacion
                    });
                });
            }
        });

        return solicitudes;
    }

    /**
     * Aprobar solicitud de vacaciones
     */
    aprobarSolicitud(historialId: number): Observable<any> {
        return this._httpClient.put(`${this.apiUrl}colaboradores/vacaciones/${historialId}/update`, {
            status_id: 3 // Aprobado
        }).pipe(
            tap(() => {
                // Actualizar la lista local
                this.actualizarSolicitudLocal(historialId, 3);
            }),
            catchError(error => {
                console.error('Error al aprobar solicitud', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Rechazar solicitud de vacaciones
     */
    rechazarSolicitud(historialId: number, comentarios?: string): Observable<any> {
        return this._httpClient.put(`${this.apiUrl}colaboradores/vacaciones/${historialId}/update`, {
            status_id: 4, // Rechazado
            comentarios: comentarios
        }).pipe(
            tap(() => {
                // Actualizar la lista local
                this.actualizarSolicitudLocal(historialId, 4);
            }),
            catchError(error => {
                console.error('Error al rechazar solicitud', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Actualizar solicitud local después de aprobar/rechazar
     */
    private actualizarSolicitudLocal(historialId: number, nuevoStatus: number): void {
        const solicitudesActuales = this._solicitudes.getValue();
        if (solicitudesActuales) {
            const solicitudesActualizadas = solicitudesActuales.filter(
                s => s.historial?.id !== historialId
            );
            this._solicitudes.next(solicitudesActualizadas);
        }
    }

    /**
     * Obtener estadísticas de solicitudes
     */
    getEstadisticasSolicitudes(): Observable<any> {
        return this.solicitudes$.pipe(
            map(solicitudes => {
                if (!solicitudes) return { pendientes: 0, aprobadas: 0, rechazadas: 0 };
                
                return {
                    pendientes: solicitudes.filter(s => s.workorder?.status_id === 5).length,
                    aprobadas: solicitudes.filter(s => s.workorder?.status_id === 3).length,
                    rechazadas: solicitudes.filter(s => s.workorder?.status_id === 4).length
                };
            })
        );
    }

    /**
     * Crear usuario (mantener para compatibilidad)
     */
    createUsuario(data: any): Observable<Usuarios> {
        return this.usuarios$.pipe(
            take(1),
            switchMap(usuarios => {
                const isFormData = data instanceof FormData;

                return this._httpClient.post<{ message: string, user: Usuarios }>(
                    `${this.apiUrl}colaborador/suadmin`,
                    data,
                    isFormData ? { headers: { 'Accept': 'application/json' } } : {}
                ).pipe(
                    tap(response => {
                        const current = usuarios || [];
                        this._usuarios.next([response.user, ...current]);
                    }),
                    map(response => response.user),
                    catchError(err => {
                        console.error('Error al crear usuario', err);
                        return throwError(() => err);
                    })
                );
            })
        );
    }

    /**
     * Actualizar usuario
     */
    updateUsuario(id: number, data: FormData | any): Observable<Usuarios> {
        return this.usuarios$.pipe(
            take(1),
            switchMap(usuarios =>
                this._httpClient.post<{ message: string, user: Usuarios }>(
                    `${this.apiUrl}colaborador/${id}/update`,
                    data
                ).pipe(
                    tap(response => {
                        const updatedUser = {
                            ...response.user,
                            name: response.user.nombre || response.user.name,
                            email: response.user.correo || response.user.email
                        };
                        const updatedUsuarios = (usuarios || []).map(u =>
                            u.id === id ? updatedUser : u
                        );
                        this._usuarios.next(updatedUsuarios);
                    }),
                    map(response => ({
                        ...response.user,
                        name: response.user.nombre || response.user.name,
                        email: response.user.correo || response.user.email
                    })),
                    catchError(error => {
                        console.error('Error al actualizar usuario', error);
                        return throwError(() => error);
                    })
                )
            )
        );
    }

    /**
     * Eliminar usuario
     */
    deleteUsuario(id: number): Observable<boolean> {
        return this.usuarios$.pipe(
            take(1),
            switchMap(usuarios =>
                this._httpClient.delete<{ message: string }>(`${this.apiUrl}colaborador/${id}`)
                    .pipe(
                        tap(() => {
                            const updatedUsuarios = (usuarios || []).filter(u => u.id !== id);
                            this._usuarios.next(updatedUsuarios);
                        }),
                        map(() => true),
                        catchError(error => {
                            console.error('Error al eliminar usuario', error);
                            return throwError(() => error);
                        })
                    )
            )
        );
    }

    /**
     * Agregar usuario a la lista
     */
    addUsuarioToList(newUser: Usuarios): void {
        const current = this._usuarios.getValue() || [];
        const userWithAliases = {
            ...newUser,
            name: newUser.nombre,
            email: newUser.correo
        };
        this._usuarios.next([userWithAliases, ...current]);
    }

    /**
     * Actualizar status de usuario
     */
    updateUsuarioStatus(id: number, status_id: number): Observable<any> {
        return this._httpClient.put(`${this.apiUrl}colaborador/usuarios/${id}/status`, { status_id });
    }
}