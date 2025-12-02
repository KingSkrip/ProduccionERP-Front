import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, switchMap, catchError } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { UserService } from 'app/core/user/user.service';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

@Injectable({ providedIn: 'root' })
export class LoginService {
    private http = inject(HttpClient);
    private _userService = inject(UserService);

    private _authenticated = false;

    login(credentials: LoginCredentials): Observable<LoginResponse> {
        if (this._authenticated) {
            return throwError(() => new Error('User already logged in.'));
        }

        return this.http.post<LoginResponse>("api/auth/sign-in", credentials).pipe(
            switchMap((response) => {

                localStorage.setItem('accessToken', response.accessToken);

                this._userService.user = response.user;
                this._authenticated = true;

                return of(response);
            })
        );
    }

    check(): Observable<boolean> {
        const token = localStorage.getItem('accessToken');

        if (!token) {
            this._authenticated = false;
            return of(false);
        }

        return this.http.post<any>("api/auth/sign-in-with-token", { accessToken: token })
            .pipe(
                switchMap(response => {
                    localStorage.setItem('accessToken', response.accessToken);

                    this._userService.user = response.user;
                    this._authenticated = true;

                    return of(true);
                }),
                catchError(() => of(false))
            );
    }

    logout(): void {
        localStorage.removeItem('accessToken');
        this._authenticated = false;
        this._userService.user = null;
    }



      /**
     * Unlock session
     *
     * @param credentials
     */
    unlockSession(credentials: {
        email: string;
        password: string;
    }): Observable<any> {
        return this.http.post('api/auth/unlock-session', credentials);
    }

     /**
     * Sign up
     *
     * @param user
     */
    signUp(user: {
        name: string;
        email: string;
        password: string;
        company: string;
    }): Observable<any> {
        return this.http.post('api/auth/sign-up', user);
    }




        /**
     * Sign out
     */
    signOut(): Observable<any> {
        // Remove the access token from the local storage
        localStorage.removeItem('accessToken');

        // Set the authenticated flag to false
        this._authenticated = false;

        // Return the observable
        return of(true);
    }


     /**
     * Forgot password
     *
     * @param email
     */
    forgotPassword(email: string): Observable<any> {
        return this.http.post('api/auth/forgot-password', email);
    }

    /**
     * Reset password
     *
     * @param password
     */
    resetPassword(password: string): Observable<any> {
        return this.http.post('api/auth/reset-password', password);
    }

}

