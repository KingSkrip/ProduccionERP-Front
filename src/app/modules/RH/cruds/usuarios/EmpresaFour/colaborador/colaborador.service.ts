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

    // Actualizar superadmin
    updateUsuario(id: string, usuario: { name: string, email: string, password?: string }): Observable<Usuarios> {
        return this.usuarios$.pipe(
            take(1),
            switchMap(usuarios =>
                this._httpClient.put<{ message: string, user: Usuarios }>(`${this.apiUrl}colaborador/suadmin/${id}`, usuario)
                    .pipe(
                        tap(response => {
                            const updatedUsuarios = (usuarios || []).map(u => u.id === id ? response.user : u);
                            this._usuarios.next(updatedUsuarios);
                        }),
                        map(response => response.user)
                    )
            )
        );
    }

    // Eliminar superadmin
    deleteUsuario(id: string): Observable<boolean> {
        return this.usuarios$.pipe(
            take(1),
            switchMap(usuarios =>
                this._httpClient.delete<{ message: string, user: Usuarios }>(`${this.apiUrl}colaborador/suadmin/${id}`)
                    .pipe(
                        tap(() => {
                            const updatedUsuarios = (usuarios || []).filter(u => u.id !== id);
                            this._usuarios.next(updatedUsuarios);
                        }),
                        map(() => true)
                    )
            )
        );
    }




    addUsuarioToList(newUser: Usuarios) {
        const current = this._usuarios.getValue();
        this._usuarios.next([newUser, ...current]);
    }


}
