import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, filter, map, of, switchMap, take, tap, throwError, } from 'rxjs';

import { APP_CONFIG } from 'app/core/config/app-config';


@Injectable({ providedIn: 'root' })
export class ColaboradorService {
    
    private _empleadosE1: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
    private apiUrl = APP_CONFIG.apiUrl;
    /**
     * Constructor
     */
    constructor(private _httpClient: HttpClient) { }



    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    get empleadosE1$(): Observable<any[]> {
        return this._empleadosE1.asObservable();
    }

// obtiene empleados con paginación
    getEmpleadosE1(offset: number = 0, limit: number = 50): Observable<any[]> {
    return this._httpClient
        .get<{ message: string, data: any[] }>(
            `${this.apiUrl}rh/E_ONE/empresa1/empleados?offset=${offset}&limit=${limit}`
        )
        .pipe(
            tap(response => this._empleadosE1.next(response.data)), // guardamos en el store
            map(response => response.data), // devolvemos solo los datos
            catchError(error => {
                console.error('Error al obtener empleados E1', error);
                return throwError(() => error);
            })
        );
}

// obtiene un empleado por CLAVE
getEmpleadoE1ByClave(clave: string): Observable<any> {
    return this._httpClient
        .get<{ message: string, data: any }>(
            `${this.apiUrl}rh/E_ONE/empresa1/empleados/${clave}`
        )
        .pipe(
            map(response => response.data),
            catchError(error => {
                console.error('Error al obtener empleado E1', error);
                return throwError(() => error);
            })
        );
}


// obtiene un empleado por CLAVE



    // // Obtener todos los colaboradores
    // getUsuarios(): Observable<Usuarios[]> {
    //     return this._httpClient.get<{ message: string, data: Usuarios[] }>(`${this.apiUrl}colaborador/data`)
    //         .pipe(
    //             tap(response => this._usuarios.next(response.data)),
    //             map(response => response.data),
    //             catchError(error => {
    //                 console.error('Error al obtener superadmins', error);
    //                 return throwError(error);
    //             })
    //         );
    // }

    // // Obtener un colaborador por id
    // getUsuarioById(id: string): Observable<Usuarios> {
    //     return this._httpClient.get<{ message: string, user: Usuarios }>(`${this.apiUrl}colaborador/suadmin/${id}`)
    //         .pipe(
    //             map(response => response.user),
    //             catchError(error => {
    //                 console.error('Error al obtener superadmin', error);
    //                 return throwError(error);
    //             })
    //         );
    // }

    // // Crear superadmin
    // createUsuario(data: any): Observable<Usuarios> {
    //     return this.usuarios$.pipe(
    //         take(1),
    //         switchMap(usuarios => {
    //             // Detectamos si es FormData (para subida de foto)
    //             const isFormData = data instanceof FormData;

    //             return this._httpClient.post<{ message: string, user: Usuarios }>(
    //                 `${this.apiUrl}colaborador/suadmin`,
    //                 data,
    //                 isFormData ? { headers: { 'Accept': 'application/json' } } : {}
    //             ).pipe(
    //                 tap(response => {
    //                     const current = usuarios || [];
    //                     this._usuarios.next([response.user, ...current]); // nuevo arriba
    //                 }),
    //                 map(response => response.user),
    //                 catchError(err => {
    //                     console.error('Error al crear superadmin', err);
    //                     return throwError(() => err);
    //                 })
    //             );
    //         })
    //     );
    // }

    // // Actualizar superadmin
    // updateUsuario(id: string, usuario: { name: string, email: string, password?: string }): Observable<Usuarios> {
    //     return this.usuarios$.pipe(
    //         take(1),
    //         switchMap(usuarios =>
    //             this._httpClient.put<{ message: string, user: Usuarios }>(`${this.apiUrl}colaborador/suadmin/${id}`, usuario)
    //                 .pipe(
    //                     tap(response => {
    //                         const updatedUsuarios = (usuarios || []).map(u => u.id === id ? response.user : u);
    //                         this._usuarios.next(updatedUsuarios);
    //                     }),
    //                     map(response => response.user)
    //                 )
    //         )
    //     );
    // }

    // // Eliminar superadmin
    // deleteUsuario(id: string): Observable<boolean> {
    //     return this.usuarios$.pipe(
    //         take(1),
    //         switchMap(usuarios =>
    //             this._httpClient.delete<{ message: string, user: Usuarios }>(`${this.apiUrl}colaborador/suadmin/${id}`)
    //                 .pipe(
    //                     tap(() => {
    //                         const updatedUsuarios = (usuarios || []).filter(u => u.id !== id);
    //                         this._usuarios.next(updatedUsuarios);
    //                     }),
    //                     map(() => true)
    //                 )
    //         )
    //     );
    // }




    // addUsuarioToList(newUser: Usuarios) {
    //     const current = this._usuarios.getValue();
    //     this._usuarios.next([newUser, ...current]);
    // }


}
