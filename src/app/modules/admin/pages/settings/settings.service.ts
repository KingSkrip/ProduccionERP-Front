// settings.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';

@Injectable({
    providedIn: 'root'
})
export class SettingsService {

    private http = inject(HttpClient);
    private apiUrl = APP_CONFIG.apiUrl;

    getPerfil(): Observable<any> {
        return this.http.get(`${this.apiUrl}perfil`);
    }

    /**
     * Actualizar datos del perfil (nombre, correo, usuario)
     */
    updatePerfil(data: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}perfil`, data);
    }

    /**
     * Cambiar contraseña
     */
    updatePassword(data: {
        password_nueva: string;
    }): Observable<any> {
        return this.http.put(`${this.apiUrl}perfil/password`, data);
    }

    /**
     * Eliminar cuenta
     */
    deleteAccount(password?: string): Observable<any> {
        return this.http.request(
            'DELETE',
            `${this.apiUrl}perfil`,
            {
                body: password ? { password } : {}
            }
        );
    }
}
