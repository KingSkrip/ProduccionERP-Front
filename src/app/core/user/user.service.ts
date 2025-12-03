import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { User } from 'app/core/user/user.types';
import { map, Observable, ReplaySubject, tap } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';

@Injectable({ providedIn: 'root' })
export class UserService {
    private _httpClient = inject(HttpClient);
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1);
    private apiUrl = APP_CONFIG.apiUrl;
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


}

