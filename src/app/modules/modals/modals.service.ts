import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Departamento, Status, Subrole } from '../admin/cruds/usuarios/catalogos.types';
import { Rol } from '../admin/cruds/usuarios/roles.types';
import { Vacacion } from '../admin/cruds/usuarios/vacaciones.types';


@Injectable({ providedIn: 'root' })
export class CatalogosService {

    private apiUrl = APP_CONFIG.apiUrl;

    constructor(private http: HttpClient) { }

    // --------------------------------------------------------------------
    // CATÁLOGOS INDIVIDUALES
    // --------------------------------------------------------------------

    getDepartamentos(): Observable<Departamento[]> {
        return this.http.get<{ success: boolean; data: Departamento[] }>(`${this.apiUrl}catalogos/getdepartamentos`)
            .pipe(
                map(res => res.data),
                catchError(error => throwError(() => error))
            );
    }

    getRoles(): Observable<Rol[]> {
        return this.http.get<{ success: boolean; data: Rol[] }>(`${this.apiUrl}catalogos/getroles`)
            .pipe(
                map(res => res.data),
                catchError(error => throwError(() => error))
            );
    }

    getSubroles(): Observable<Subrole[]> {
        return this.http.get<{ success: boolean; data: Subrole[] }>(`${this.apiUrl}catalogos/getsubroles`)
            .pipe(
                map(res => res.data),
                catchError(error => throwError(() => error))
            );
    }

    getStatuses(): Observable<Status[]> {
        return this.http.get<{ success: boolean; data: Status[] }>(`${this.apiUrl}catalogos/getstatuses`)
            .pipe(
                map(res => res.data),
                catchError(error => throwError(() => error))
            );
    }

    // --------------------------------------------------------------------
    // TODOS LOS CATÁLOGOS
    // --------------------------------------------------------------------

    getAllCatalogos(): Observable<any> {
        return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}catalogos/getAll`)
            .pipe(
                map(res => res.data),
                catchError(error => throwError(() => error))
            );
    }

























     // Listar todos los colaboradores
    getVacacionesColaboradores(): Observable<Vacacion[]> {
        return this.http.get<Vacacion[]>(`${this.apiUrl}colaboradores/vacaciones`)
            .pipe(catchError(error => throwError(() => error)));
    }

    // Crear colaborador (formulario y envío)
    getVacacionesCreateColaborador(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}colaboradores/vacaciones/create`)
            .pipe(catchError(error => throwError(() => error)));
    }

    storeVacacionesColaborador(data: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}colaboradores/vacaciones/store`, data)
            .pipe(catchError(error => throwError(() => error)));
    }

    // Mostrar un colaborador
    showVacacionesColaborador(id: number): Observable<Vacacion> {
        return this.http.get<Vacacion>(`${this.apiUrl}colaboradores/vacaciones/${id}/show`)
            .pipe(catchError(error => throwError(() => error)));
    }

    // Editar colaborador
    editVacacionesColaborador(id: number): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}colaboradores/vacaciones/${id}/edit`)
            .pipe(catchError(error => throwError(() => error)));
    }

    updateVacacionesColaborador(id: number, data: any): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}colaboradores/vacaciones/${id}/update`, data)
            .pipe(catchError(error => throwError(() => error)));
    }

    // Eliminar colaborador
    deleteVacacionesColaborador(id: number): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}colaboradores/vacaciones/${id}/delete`)
            .pipe(catchError(error => throwError(() => error)));
    }
}
