import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, filter, map, of, switchMap, take, tap, throwError, } from 'rxjs';

import { APP_CONFIG } from 'app/core/config/app-config';
import { Usuarios } from '../usuarios.types';

@Injectable({ providedIn: 'root' })
export class ColaboradorService {
    // Private
    private _usuarios: BehaviorSubject<Usuarios[] | null> = new BehaviorSubject<Usuarios[] | null>(null);
    private apiUrl = APP_CONFIG.apiUrl;
    /**
     * Constructor
     */
    constructor(private _httpClient: HttpClient) { }



    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    get usuarios$(): Observable<Usuarios[]> {
        return this._usuarios.asObservable();
    }
    // Obtener todos los superadmins
    getUsuarios(): Observable<Usuarios[]> {
        return this._httpClient.get<{ message: string, data: Usuarios[] }>(`${this.apiUrl}colaborador/data`)
            .pipe(
                tap(response => this._usuarios.next(response.data)),
                map(response => response.data),
                catchError(error => {
                    console.error('Error al obtener superadmins', error);
                    return throwError(error);
                })
            );
    }

    // Obtener un superadmin por id
    getUsuarioById(id: string): Observable<Usuarios> {
        return this._httpClient.get<{ message: string, user: Usuarios }>(`${this.apiUrl}colaborador/suadmin/${id}`)
            .pipe(
                map(response => response.user),
                catchError(error => {
                    console.error('Error al obtener superadmin', error);
                    return throwError(error);
                })
            );
    }

    // Crear superadmin
    createUsuario(data: any): Observable<Usuarios> {
        return this.usuarios$.pipe(
            take(1),
            switchMap(usuarios => {
                // Detectamos si es FormData (para subida de foto)
                const isFormData = data instanceof FormData;

                return this._httpClient.post<{ message: string, user: Usuarios }>(
                    `${this.apiUrl}colaborador/suadmin`,
                    data,
                    isFormData ? { headers: { 'Accept': 'application/json' } } : {}
                ).pipe(
                    tap(response => {
                        const current = usuarios || [];
                        this._usuarios.next([response.user, ...current]); // nuevo arriba
                    }),
                    map(response => response.user),
                    catchError(err => {
                        console.error('Error al crear superadmin', err);
                        return throwError(() => err);
                    })
                );
            })
        );
    }

   /**
 * Actualizar colaborador
 */
updateUsuario(id: number, data: FormData | any): Observable<Usuarios> {
    return this.usuarios$.pipe(
        take(1),
        switchMap(usuarios =>
            this._httpClient.post<{ message: string, user: Usuarios }>(  // <--- AQUÍ: put en vez de post
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

    /**
     * Eliminar colaborador
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



    updateUsuarioStatus(id: number, status_id: number): Observable<any> {
  return this._httpClient.put(`${this.apiUrl}colaborador/usuarios/${id}/status`, { status_id });
}

}
