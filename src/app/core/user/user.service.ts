import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { User } from 'app/core/user/user.types';
import { map, Observable, ReplaySubject, Subject, tap, take } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';

@Injectable({ providedIn: 'root' })
export class UserService {
    private _httpClient = inject(HttpClient);
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1);
    private apiUrl = APP_CONFIG.apiUrl;
    private _openProfileDrawer = new Subject<void>();
    openProfileDrawer$ = this._openProfileDrawer.asObservable();

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for user
     */
    set user(value: User) {
        this._user.next(value);
    }

    get user$(): Observable<User | null> {
        return this._user.asObservable();
    }

    /**
     * Get current user synchronously (usar con precaución)
     */
    get user(): User | null {
        let currentUser: User | null = null;
        this._user.pipe(take(1)).subscribe(user => currentUser = user);
        return currentUser;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Load user at startup using token
     * 🔥 CORRECCIÓN: Mejorar manejo de errores y agregar logs
     */
    init(): void {
        const token = localStorage.getItem('accessToken');

        if (!token) {
            console.log('[UserService] No hay token, usuario = null');
            this._user.next(null);
            return;
        }

        this._httpClient.get(`${this.apiUrl}dash/me`, {
            headers: { Authorization: `Bearer ${token}` }
        }).subscribe({
            next: (resp: any) => {
                this._user.next(resp.user);
            },
            error: (err) => {
                console.error('[UserService] Error al cargar usuario:', err);
                localStorage.removeItem('accessToken');
                this._user.next(null);
            }
        });
    }

    /**
     * Update user info
     */
    update(user: User): Observable<any> {
        return this._httpClient.patch(`${this.apiUrl}dash/user`, user).pipe(
            tap((resp: any) => {
                this._user.next(resp.user);
            })
        );
    }

    /**
     * Update user status (online / away / etc)
     */
    updateUserStatus(status: string): void {
        this._httpClient.post(`${this.apiUrl}dash/update-status`, { status })
            .subscribe({
                next: (resp: any) => {
                    this._user.next(resp.user);
                },
                error: (err) => {
                    console.error('[UserService] Error al actualizar status:', err);
                }
            });
    }

    openProfileDrawer(): void {
        this._openProfileDrawer.next();
    }

    /**
     * Actualiza el usuario haciendo merge con los datos existentes
     * SOLUCIÓN: Preserva todas las propiedades del usuario actual
     */
    updateUser(data: any): void {
        this._user.pipe(take(1)).subscribe((currentUser) => {
            const normalized = this.normalizeUser(data);
            const mergedUser = {
                ...currentUser,
                ...normalized
            };
            console.log('[UserService] Usuario actualizado:', mergedUser);
            this._user.next(mergedUser);
        });
    }

    /**
     * Normaliza los datos del usuario que vienen del backend
     * 🔥 CORRECCIÓN: Simplificar normalización
     */
    normalizeUser(apiUser: any): Partial<User> {
        // Si el usuario ya viene normalizado, devolverlo directamente
        if (apiUser.email && apiUser.name) {
            return apiUser;
        }

        // Normalizar solo si viene en formato antiguo
        const normalized: any = {};

        if (apiUser.ID !== undefined || apiUser.id !== undefined) {
            normalized.id = apiUser.ID ?? apiUser.id;
        }
        if (apiUser.NOMBRE !== undefined || apiUser.name !== undefined) {
            normalized.name = apiUser.NOMBRE ?? apiUser.name;
        }
        if (apiUser.CORREO !== undefined || apiUser.email !== undefined) {
            normalized.email = apiUser.CORREO ?? apiUser.email;
        }
        if (apiUser.USUARIO !== undefined || apiUser.usuario !== undefined) {
            normalized.usuario = apiUser.USUARIO ?? apiUser.usuario;
        }
        if (apiUser.PHOTO !== undefined || apiUser.photo !== undefined) {
            normalized.photo = apiUser.PHOTO ?? apiUser.photo;
        }
        if (apiUser.DEPARTAMENTO !== undefined || apiUser.departamento !== undefined) {
            normalized.departamento = apiUser.DEPARTAMENTO ?? apiUser.departamento;
        }
        if (apiUser.permissions !== undefined) {
            normalized.permissions = apiUser.permissions;
        }

        return normalized;
    }
}