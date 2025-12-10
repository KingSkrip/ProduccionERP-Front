import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, switchMap, take, tap, map, catchError, throwError } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Rol } from '../roles.types';

@Injectable({ providedIn: 'root' })
export class RolesService {
    
    private apiUrl = APP_CONFIG.apiUrl + 'roles/';
    private _roles: BehaviorSubject<Rol[] | null> = new BehaviorSubject<Rol[] | null>(null);

    constructor(private http: HttpClient) {}

    // Observable público
    get roles$(): Observable<Rol[]> {
        return this._roles.asObservable();
    }

    // ------------------------------------------------------------------
    // Obtener todos los roles
    // ------------------------------------------------------------------
    getRoles(): Observable<Rol[]> {
        return this.http.get<{ ok: boolean; data: Rol[] }>(`${this.apiUrl}data`).pipe(
            tap(res => this._roles.next(res.data)),
            map(res => res.data),
            catchError(err => {
                console.error('Error al obtener roles', err);
                return throwError(() => err);
            })
        );
    }

    // ------------------------------------------------------------------
    // Obtener un rol por ID
    // ------------------------------------------------------------------
    getRolById(id: number): Observable<Rol> {
        return this.http.get<{ ok: boolean; data: Rol }>(`${this.apiUrl}rol/${id}`).pipe(
            map(res => res.data),
            catchError(err => {
                console.error('Error al obtener rol', err);
                return throwError(() => err);
            })
        );
    }

    // ------------------------------------------------------------------
    // Crear rol
    // ------------------------------------------------------------------
    createRol(payload: { NOMBRE: string; GUARD_NAME: string }): Observable<{ok: boolean, msg: string, data: Rol}> {
    return this.roles$.pipe(
        take(1),
        switchMap(currentRoles =>
            this.http.post<{ ok: boolean; msg: string; data: Rol }>(`${this.apiUrl}createrol`, payload).pipe(
                tap(res => {
                    const roles = currentRoles || [];
                    this._roles.next([res.data, ...roles]);
                })
            )
        )
    );
}


    // ------------------------------------------------------------------
    // Actualizar rol
    // ------------------------------------------------------------------
    updateRol(id: number, payload: { NOMBRE: string; GUARD_NAME: string }): Observable<Rol> {
        return this.roles$.pipe(
            take(1),
            switchMap(currentRoles =>
                this.http.put<{ ok: boolean; data: Rol }>(`${this.apiUrl}rol/${id}`, payload).pipe(
                    tap(res => {
                        const rolesUpdated = (currentRoles || []).map(r =>
                            r.CLAVE === id ? res.data : r
                        );
                        this._roles.next(rolesUpdated);
                    }),
                    map(res => res.data)
                )
            )
        );
    }

    // ------------------------------------------------------------------
    // Eliminar rol
    // ------------------------------------------------------------------
    deleteRol(id: number): Observable<boolean> {
        return this.roles$.pipe(
            take(1),
            switchMap(currentRoles =>
                this.http.delete<{ ok: boolean }>(`${this.apiUrl}rol/${id}`).pipe(
                    tap(() => {
                        const updated = (currentRoles || []).filter(r => r.CLAVE !== id);
                        this._roles.next(updated);
                    }),
                    map(() => true)
                )
            )
        );
    }

    // ------------------------------------------------------------------
    // Agregar rol manualmente a la lista (si lo necesitas)
    // ------------------------------------------------------------------
    addRolToList(rol: Rol) {
        const current = this._roles.getValue() || [];
        this._roles.next([rol, ...current]);
    }
}
