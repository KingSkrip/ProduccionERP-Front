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
     *
     * @param value
     */
    set user(value: User) {
        // Store the value
        this._user.next(value);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------
    get user$(): Observable<User | null> {
        return this._user.asObservable();
    }

    // -----------------------------------------------------------
    // Load user at startup using token
    // -----------------------------------------------------------
    init(): void {
        const token = localStorage.getItem('accessToken');

        if (!token) {
            this._user.next(null);
            return;
        }

        this._httpClient.get(`${this.apiUrl}dash/me`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .subscribe({
                next: (resp: any) => {
                    this._user.next(resp.user);
                },
                error: () => {
                    this._user.next(null);
                }
            });
    }

    // -----------------------------------------------------------
    // Update user info
    // -----------------------------------------------------------
    update(user: User): Observable<any> {
        return this._httpClient.patch(`${this.apiUrl}dash/user`, user).pipe(
            tap((resp: any) => {
                this._user.next(resp.user);
            })
        );
    }

    // -----------------------------------------------------------
    // Update user status (online / away / etc)
    // -----------------------------------------------------------
    updateUserStatus(status: string): void {
        this._httpClient.post(`${this.apiUrl}dash/update-status`, { status })
            .subscribe((resp: any) => {
                this._user.next(resp.user);
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
        // Obtener el usuario actual una sola vez
        this._user.pipe(take(1)).subscribe((currentUser) => {
            // Normalizar los datos nuevos
            const normalized = this.normalizeUser(data);

            // Hacer merge: preservar datos existentes y sobrescribir solo lo nuevo
            const mergedUser = {
                ...currentUser,  // Mantener todos los datos actuales
                ...normalized    // Sobrescribir solo lo que venga en 'data'
            };

            // Emitir el usuario actualizado
            this._user.next(mergedUser);
        });
    }

    /**
     * Normaliza los datos del usuario que vienen del backend
     * Maneja diferentes formatos (mayúsculas/minúsculas)
     */
    normalizeUser(apiUser: any): Partial<User> {
        const normalized: any = {};

        // Solo agregar propiedades que realmente vengan en apiUser
        if (apiUser.ID !== undefined || apiUser.id !== undefined) {
            normalized.id = apiUser.ID ?? apiUser.id;
        }
        if (apiUser.NOMBRE !== undefined || apiUser.name !== undefined) {
            normalized.name = apiUser.NOMBRE ?? apiUser.name;
        }
        if (apiUser.CORREO !== undefined || apiUser.email !== undefined) {
            normalized.email = apiUser.CORREO ?? apiUser.email;
        }
        if (apiUser.USUARIO !== undefined || apiUser.username !== undefined) {
            normalized.username = apiUser.USUARIO ?? apiUser.username;
        }
        if (apiUser.PHOTO !== undefined || apiUser.photo !== undefined) {
            normalized.photo = apiUser.PHOTO ?? apiUser.photo;
        }
        if (apiUser.DEPARTAMENTO !== undefined || apiUser.departamento !== undefined) {
            normalized.departamento = apiUser.DEPARTAMENTO ?? apiUser.departamento;
        }

        return normalized;
    }
}