import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, switchMap, take, tap, throwError } from 'rxjs';

import { APP_CONFIG } from 'app/core/config/app-config';
import { Usuarios } from '../usuarios.types';

@Injectable({ providedIn: 'root' })
export class ColaboradorService {
    // Private

    private _usuarios: BehaviorSubject<Usuarios[] | null> = new BehaviorSubject<Usuarios[] | null>(null);
    private _jefes: BehaviorSubject<any[] | null> = new BehaviorSubject<any[] | null>(null); // 👈 nuevo
    private apiUrl = APP_CONFIG.apiUrl;

    constructor(private _httpClient: HttpClient) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------


    // GET /colaborador/data -> ColaboradorController@index
    // ⚠ El backend pagina con per_page=20 por default. Como este service hace su propia
    // paginación/búsqueda en el cliente sobre la lista completa, pedimos un per_page alto
    // para traer TODOS los colaboradores en una sola llamada.
    get usuarios$(): Observable<Usuarios[]> {
        return this._usuarios.asObservable();
    }

    get jefes$(): Observable<any[]> {
        return this._jefes.asObservable();
    }

    getUsuarios(): Observable<Usuarios[]> {
        return this._httpClient.get<{ message: string, data: Usuarios[], jefes: any[] }>(`${this.apiUrl}colaborador/data`, {
            params: { per_page: 5000 }
        })
            .pipe(
                tap(response => {
                    this._usuarios.next(response.data);
                    this._jefes.next(response.jefes || []); // 👈 nuevo
                }),
                map(response => response.data),
                catchError(error => {
                    console.error('Error al obtener colaboradores', error);
                    return throwError(() => error);
                })
            );
    }

    // GET /colaborador/{id}/edit -> ColaboradorController@edit
    getUsuarioById(id: string): Observable<Usuarios> {
        return this._httpClient.get<{ message: string, user: Usuarios }>(`${this.apiUrl}colaborador/${id}/edit`)
            .pipe(
                map(response => response.user),
                catchError(error => {
                    console.error('Error al obtener colaborador', error);
                    return throwError(() => error);
                })
            );
    }

    // POST /colaborador/suadmin -> ColaboradorController@store
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
                        console.error('Error al crear colaborador', err);
                        return throwError(() => err);
                    })
                );
            })
        );
    }

    /**
     * Actualizar colaborador
     * POST (no PUT) porque se manda FormData con foto -> ColaboradorController@update
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
                        console.error('Error al actualizar colaborador', error);
                        return throwError(() => error);
                    })
                )
            )
        );
    }

    // DELETE /colaborador/{id} -> ColaboradorController@destroy
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
                            console.error('Error al eliminar colaborador', error);
                            return throwError(() => error);
                        })
                    )
            )
        );
    }

    /**
     * Agregar usuario a la lista (helper method)
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

    // PUT /colaborador/usuarios/{id}/status -> ColaboradorController@updateStatus
    updateUsuarioStatus(id: number, status_id: number): Observable<any> {
        return this._httpClient.put(`${this.apiUrl}colaborador/usuarios/${id}/status`, { status_id });
    }

    // GET /catalogos/getroles -> CatalogosController@getRoles
    getRolesCatalogo(): Observable<any[]> {
        return this._httpClient.get<{ data: any[] } | any[]>(`${this.apiUrl}catalogos/getroles`)
            .pipe(map((res: any) => res?.data ?? res ?? []));
    }

    // GET /catalogos/getsubroles -> CatalogosController@getSubroles
    getSubrolesCatalogo(): Observable<any[]> {
        return this._httpClient.get<{ data: any[] } | any[]>(`${this.apiUrl}catalogos/getsubroles`)
            .pipe(map((res: any) => res?.data ?? res ?? []));
    }

    // GET /puestos/activos -> PuestoController@activos
    getPuestosActivos(): Observable<any[]> {
        return this._httpClient.get<{ data: any[] } | any[]>(`${this.apiUrl}puestos/activos`)
            .pipe(map((res: any) => res?.data ?? res ?? []));
    }

    // GET /areas/activas -> AreaController@activas
    getAreasActivas(): Observable<any[]> {
        return this._httpClient.get<{ data: any[] } | any[]>(`${this.apiUrl}areas/activas`)
            .pipe(map((res: any) => res?.data ?? res ?? []));
    }

    // GET /turnos/activos -> TurnoController@activos
    getTurnosActivos(): Observable<any[]> {
        return this._httpClient.get<{ data: any[] } | any[]>(`${this.apiUrl}turnos/activos`)
            .pipe(map((res: any) => res?.data ?? res ?? []));
    }

    // GET /catalogos/getpermissions -> CatalogosController@getPermissions
    getPermissionsCatalogo(): Observable<any[]> {
        return this._httpClient.get<{ data: any[] } | any[]>(
            `${this.apiUrl}catalogos/getpermissions`
        ).pipe(
            map((res: any) => res?.data ?? res ?? [])
        );
    }

    // GET /catalogos/getsubpermissions -> CatalogosController@getSubPermissions
    getSubPermissionsCatalogo(): Observable<any[]> {
        return this._httpClient.get<{ data: any[] } | any[]>(
            `${this.apiUrl}catalogos/getsubpermissions`
        ).pipe(
            map((res: any) => res?.data ?? res ?? [])
        );
    }

    // colaborador.service.ts
    getCatalogoJefes(): Observable<any[]> {
        return this._httpClient.get<{ data: any[] }>(`${this.apiUrl}catalogos/catalogo-jefes`)
            .pipe(map(res => res.data));
    }

    getPosiblesJefes(): Observable<any[]> {
        return this._httpClient.get<any>(`${this.apiUrl}colaborador/posibles-jefes`).pipe(
            map(res => res.data || [])
        );
    }


    getPermisosCatalogo(): Observable<{ permissions: any[]; sub_permissions: any[] }> {
        return this._httpClient.get<{ permissions: any[]; sub_permissions: any[] }>(
            `${this.apiUrl}catalogos/getpermisos`
        ).pipe(
            map(res => ({
                permissions: res?.permissions ?? [],
                sub_permissions: res?.sub_permissions ?? [],
            }))
        );
    }
}