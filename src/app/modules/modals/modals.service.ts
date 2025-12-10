import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Departamento, Status, Subrole } from '../admin/cruds/usuarios/catalogos.types';
import { Rol } from '../admin/cruds/usuarios/roles.types';



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
}
