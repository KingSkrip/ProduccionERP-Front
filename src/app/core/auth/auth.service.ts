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
        const token = this.encrypt;
        if (token && !AuthUtils.isTokenExpired(token)) {
            this._authenticated = true;
        } else {
            this._authenticated = false;
            localStorage.removeItem('encrypt');
        }
    }

    get authenticated(): boolean {
        return this._authenticated;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------
    set encrypt(token: string) {
        localStorage.setItem('encrypt', token);
    }

    get encrypt(): string {
        return localStorage.getItem('encrypt') ?? '';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Forgot Password
     */
    forgotPassword(email: string): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/forgot-password`, { email });
    }

    /**
     * Reset Password
     */
    resetPassword(data: { token: string; email: string; password: string }): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/reset-password`, data);
    }

    /**
     * Sign In
     */
    signIn(credentials: { email: string; password: string }): Observable<any> {
        if (this._authenticated) {
            return throwError(() => new Error('User is already logged in.'));
        }

        return this._httpClient.post(`${this.apiUrl}auth/sign-in`, credentials).pipe(
            switchMap((response: any) => {
                this.encrypt = response.encrypt;
                this._authenticated = true;
                this._userService.user = response.user;
                return of(response);
            })
        );
    }

    /**
     * Sign In Using Token (Refresh)
     */
    signInUsingToken(): Observable<any> {
        if (!this.encrypt) return of(false);

        return this._httpClient.post(`${this.apiUrl}auth/sign-in-with-token`, {
            encrypt: this.encrypt,
        }).pipe(
            catchError(() => {
                localStorage.removeItem('encrypt');
                this._authenticated = false;
                return of(false);
            }),
            switchMap((response: any) => {
                if (response.encrypt) {
                    this.encrypt = response.encrypt;
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
        localStorage.removeItem('encrypt');
        this._authenticated = false;
        return of(true);
    }

    /**
     * Sign Up
     */
    signUp(user: { name: string; email: string; password: string; company: string }): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/sign-up`, user);
    }

    /**
     * Unlock Session
     */
    unlockSession(credentials: { email: string; password: string }): Observable<any> {
        return this._httpClient.post(`${this.apiUrl}auth/unlock-session`, credentials);
    }

    /**
     * Check Authentication
     */
    check(): Observable<boolean> {
        if (this._authenticated) return of(true);
        if (!this.encrypt) return of(false);
        if (AuthUtils.isTokenExpired(this.encrypt)) return of(false);
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