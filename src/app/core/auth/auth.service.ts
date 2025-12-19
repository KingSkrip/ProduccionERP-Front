import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { UserService } from 'app/core/user/user.service';
import { catchError, map, Observable, of, switchMap, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { NavigationByRole, NavigationBySubRole, RoleEnum } from './roles/dataroles';

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
    
    /**
     * Forgot Password
     * 🔥 CORRECCIÓN: Usar comillas invertidas ` en lugar de comillas normales
     */
    forgotPassword(email: string): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/forgot-password`, { email });
    }

    /**
     * Reset Password
     * 🔥 CORRECCIÓN: Usar comillas invertidas `
     */
    resetPassword(data: { token: string; email: string; password: string }): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/reset-password`, data);
    }

    /**
     * Sign In
     * 🔥 CORRECCIÓN: Usar comillas invertidas `
     */
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

    /**
     * Sign In Using Token (Refresh)
     * 🔥 CORRECCIÓN: Usar comillas invertidas `
     */
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

    /**
     * Sign Out
     */
    signOut(): Observable<any> {
        localStorage.removeItem('accessToken');
        this._authenticated = false;
        return of(true);
    }

    /**
     * Sign Up
     * 🔥 CORRECCIÓN: Usar comillas invertidas `
     */
    signUp(user: { name: string; email: string; password: string; company: string }): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/sign-up`, user);
    }

    /**
     * Unlock Session
     * 🔥 CORRECCIÓN: Usar comillas invertidas `
     */
    unlockSession(credentials: { email: string; password: string }): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/unlock-session`, credentials);
    }

    /**
     * Check Authentication
     */
    check(): Observable<boolean> {
        if (this._authenticated) return of(true);
        if (!this.accessToken) return of(false);
        if (AuthUtils.isTokenExpired(this.accessToken)) return of(false);
        return this.signInUsingToken();
    }

    /**
     * Get Menu by Role
     */
getMenu(): string[] {
    const user = this._userService.user;

    if (!user?.permissions?.length) {
        return [];
    }

    const roleId = user.permissions[0] as RoleEnum;
    const subRoleId = user.sub_permissions?.[0] ?? null;

 

    // Por ahora solo rol (puedes extender a subrol después)
    return NavigationByRole[roleId] ?? [];
}



    /**
     * Obtener el rol principal del usuario
     */
 getUserRole(): Observable<{ roleId: number; subRoleId: number | null }> {
    return this._userService.user$.pipe(
        map(user => {
            if (!user || !user.permissions?.length) {
                return { roleId: null, subRoleId: null };
            }

            return {
                roleId: user.permissions[0],
                subRoleId: user.sub_permissions?.[0] ?? null
            };
        })
    );
}


    /**
     * Obtener el usuario completo
     */
    getUser() {
        return this._userService.user;
    }
}