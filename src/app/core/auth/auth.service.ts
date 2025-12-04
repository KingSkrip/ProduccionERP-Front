import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { UserService } from 'app/core/user/user.service';
import { catchError, map, Observable, of, switchMap, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { NavigationByRole, RoleEnum } from './roles/dataroles';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private _authenticated: boolean = false;


    private apiUrl = APP_CONFIG.apiUrl;

    constructor(
        private _httpClient: HttpClient,
        private _userService: UserService,
        
    ) {
        this.checkStoredToken();
    }


    private checkStoredToken() {
        const token = this.accessToken;
        if (token && !AuthUtils.isTokenExpired(token)) {
            // Si hay token y no ha expirado
            this._authenticated = true;
        } else {
            this._authenticated = false;
            localStorage.removeItem('accessToken');
        }
    }

    get authenticated(): boolean {
        return this._authenticated;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    set accessToken(token: string) {
        localStorage.setItem('accessToken', token);
    }

    get accessToken(): string {
        return localStorage.getItem('accessToken') ?? '';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    forgotPassword(email: string): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/forgot-password`, { email });
    }

    resetPassword(password: string): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/reset-password`, { password });
    }

    signIn(credentials: { email: string; password: string }): Observable<any> {
        if (this._authenticated) {
            return throwError(() => new Error('User is already logged in.'));
        }

        return this._httpClient.post(`${this.apiUrl}auth/sign-in`, credentials).pipe(
            switchMap((response: any) => {
                this.accessToken = response.accessToken;
                this._authenticated = true;
                this._userService.user = response.user;
                return of(response);
            })
        );
    }

    signInUsingToken(): Observable<any> {
        if (!this.accessToken) return of(false);

        return this._httpClient.post(`${this.apiUrl}auth/sign-in-with-token`, {
            accessToken: this.accessToken,
        }).pipe(
            catchError(() => {
                localStorage.removeItem('accessToken');
                this._authenticated = false;
                return of(false);
            }),
            switchMap((response: any) => {
                if (response.accessToken) {
                    this.accessToken = response.accessToken;
                    this._authenticated = true;
                    this._userService.user = response.user;
                    return of(true);
                }
                return of(false);
            })
        );
    }


    signOut(): Observable<any> {
        localStorage.removeItem('accessToken');
        this._authenticated = false;
        return of(true);
    }

    signUp(user: { name: string; email: string; password: string; company: string }): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/sign-up`, user);
    }

    unlockSession(credentials: { email: string; password: string }): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/unlock-session`, credentials);
    }

    check(): Observable<boolean> {
        if (this._authenticated) return of(true);
        if (!this.accessToken) return of(false);
        if (AuthUtils.isTokenExpired(this.accessToken)) return of(false);
        return this.signInUsingToken();
    }



    getMenu(): string[] {
        const user = this._userService.user;

        if (!user || !user.permissions || !user.permissions.length) return [];

        // Tomamos el primer permiso (puedes ajustarlo si tu app soporta multi-rol)
        const roleId = user.permissions[0];

        return NavigationByRole[roleId as RoleEnum] ?? [];
    }

 /**
     * Obtener el rol principal del usuario
     */
getUserRole(): Observable<number | null> {
    return this._userService.user$.pipe(
        map(user => {
            if (!user || !user.permissions || !user.permissions.length) {
                return null;
            }
            return user.permissions[0];
        })
    );
}

    /**
     * Obtener el usuario completo (opcional)
     */
    getUser() {
        return this._userService.user;
    }

    
}
