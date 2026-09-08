import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { UserService } from 'app/core/user/user.service';

import {
  catchError,
  finalize,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { DeviceInfoService } from 'app/shared/devicesInfo/device-info.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _authenticated: boolean = false;
  private apiUrl = APP_CONFIG.apiUrl;

  constructor(
    private _httpClient: HttpClient,
    private _userService: UserService,
      private _deviceInfoService: DeviceInfoService,
  ) {
    if (!this.encrypt || AuthUtils.isTokenExpired(this.encrypt)) {
      this.clearSession();
    }
  }

  /**
   * Limpia sesión local y marca todo como inactivo
   */
  private clearSession(): void {
    localStorage.removeItem('encrypt');
    this._authenticated = false;
    this._userService.user = null; // 👈 ajusta si tu UserService espera otro shape "inactivo"
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
/**
 * Sign In
 */
signIn(credentials: { email: string; password: string }): Observable<any> {
    if (this._authenticated) {
      return throwError(() => new Error('User is already logged in.'));
    }

    return from(this._deviceInfoService.getDeviceInfo()).pipe(
      switchMap((deviceInfo) => {
        const payload = { ...credentials, device_info: deviceInfo };

        return this._httpClient.post(`${this.apiUrl}auth/sign-in`, payload).pipe(
          switchMap((response: any) => {
            this.encrypt = response.encrypt;
            this._authenticated = true;
            this._userService.user = response.user;
            return of(response);
          }),
        );
      }),
    );
}

  /**
   * Sign In Using Token (Refresh)
   */
  // signInUsingToken(): Observable<any> {
  //   if (!this.encrypt) {
  //     this.clearSession();
  //     return of(false);
  //   }

  //   return this._httpClient
  //     .post(`${this.apiUrl}auth/sign-in-with-token`, {
  //       encrypt: this.encrypt,
  //     })
  //     .pipe(
  //       catchError(() => {
  //         // 401 -> sesión cerrada o expirada de verdad -> datos de sesión inactiva
  //         this.clearSession();
  //         return of(false);
  //       }),
  //       switchMap((response: any) => {
  //         if (response?.encrypt) {
  //           this.encrypt = response.encrypt;
  //           this._authenticated = true;
  //           this._userService.user = response.user;
  //           return of(true);
  //         }
  //         this.clearSession();
  //         return of(false);
  //       }),
  //     );
  // }

  /**
   * Sign Out
   */
  signOut(): Observable<any> {
    const token = this.encrypt;
    localStorage.removeItem('encrypt');
    this._authenticated = false;

    if (!token) {
      return of(true);
    }

    return this._httpClient
      .post(`${this.apiUrl}auth/sign-out`, { encrypt: token })
      .pipe(catchError(() => of(true)));
  }
  /**
   * Sign Up
   */
  signUp(user: {
    name: string;
    email: string;
    password: string;
    company: string;
  }): Observable<any> {
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
  //   check(): Observable<boolean> {
  //     if (this._authenticated) return of(true);
  //     if (!this.encrypt) return of(false);
  //     if (AuthUtils.isTokenExpired(this.encrypt)) return of(false);
  //     return this.signInUsingToken();
  //   }

  /**
   * Check Authentication
   * 🔧 Antes confiaba en `_authenticated` en memoria y solo validaba expiración
   * LOCAL del JWT. Ahora, si hay token y no expiró localmente, SIEMPRE se
   * confirma contra backend (sign-in-with-token), porque la sesión pudo
   * cerrarse en otro dispositivo o el server pudo invalidarla.
   */
  // 🔧 Evita disparar múltiples POST a sign-in-with-token cuando varios
  // guards (canActivate + canActivateChild, rutas anidadas, etc.) llaman
  // check() casi al mismo tiempo en la misma navegación.
  private _checkInFlight$: Observable<boolean> | null = null;

  check(): Observable<boolean> {
    if (!this.encrypt) {
      this.clearSession();
      return of(false);
    }

    if (AuthUtils.isTokenExpired(this.encrypt)) {
      this.clearSession();
      return of(false);
    }

    if (this._authenticated) {
      return of(true);
    }

    if (this._checkInFlight$) {
      return this._checkInFlight$;
    }

    this._checkInFlight$ = this.validateSession().pipe(
      finalize(() => (this._checkInFlight$ = null)),
      shareReplay(1),
    );

    return this._checkInFlight$;
  }
  /**
   * Get Menu by Role
   */
  // getMenu(): string[] {
  //     const user = this._userService.user;

  //     if (!user?.permissions?.length) {
  //         return [];
  //     }
  //     const roleId = user.permissions[0] as RoleEnum;
  //     const subRoleId = user.sub_permissions?.[0] ?? null;

  //     return NavigationByRole[roleId] ?? [];
  // }

  /**
   * Obtener el rol principal del usuario
   * ⚠ DEPRECATED para lógica de RH/jefe: permissions/sub_permissions
   * son genéricos por nivel jerárquico (ej. "Gerente" = 1,3 para
   * CUALQUIER área), no identifican RH ni jefe de área específico.
   * Úsalo solo si de verdad necesitas el rol crudo del catálogo de
   * permisos/roles.
   */
  getUserRole(): Observable<{ roleId: number; subRoleId: number | null }> {
    return this._userService.user$.pipe(
      map((user) => {
        if (!user || !user.permissions?.length) {
          return { roleId: null, subRoleId: null };
        }
        return {
          roleId: user.permissions[0],
          subRoleId: user.sub_permissions?.[0] ?? null,
        };
      }),
    );
  }

  /**
   * Flags reales de jerarquía, calculados en el backend a partir del
   * PUESTO activo del usuario (tabla `puestos.es_rh` / `es_gerente` /
   * `es_jefe_area`). Esta es la fuente de verdad para decidir qué
   * vista/bandeja mostrar — no `permissions`/`sub_permissions`.
   */
  getUserFlags(): Observable<{
    esRh: boolean;
    esGerente: boolean;
    esJefeArea: boolean;
    esJefeAuxiliar: boolean;
    identityId: number | null;
    puestoNombre: string | null;
    areaNombre: string | null;
  }> {
    return this._userService.user$.pipe(
      map((user) => {
        const puesto = user?.USER_PUESTO?.PUESTO ?? null;
        const area = user?.USER_PUESTO?.AREA ?? null;
        const rawId = user?.identity_id ?? user?.id ?? null;
        const identityId = rawId != null ? Number(rawId) : null;

        return {
          esRh: !!puesto?.ES_RH,
          esGerente: !!puesto?.ES_GERENTE,
          esJefeArea: !!puesto?.ES_JEFE_AREA,
          esJefeAuxiliar: !!user?.ES_JEFE_AUXILIAR,
          identityId: identityId != null && !Number.isNaN(identityId) ? identityId : null,
          puestoNombre: puesto?.NOMBRE ?? null,
          areaNombre: area?.NOMBRE ?? null,
        };
      }),
    );
  }

  getUser() {
    return this._userService.user;
  }

  // dentro de AuthService, junto a signOut()

  pauseSession(): Observable<any> {
    const token = this.encrypt;
    if (!token) return of(true);
    return this._httpClient
      .post(`${this.apiUrl}auth/session/pause`, { encrypt: token })
      .pipe(catchError(() => of(true)));
  }

  resumeSession(): Observable<any> {
    const token = this.encrypt;
    if (!token) return of(true);
    return this._httpClient
      .post(`${this.apiUrl}auth/session/resume`, { encrypt: token })
      .pipe(catchError(() => of(true)));
  }

  heartbeat(): Observable<any> {
    const token = this.encrypt;
    if (!token) return of(true);
    return this._httpClient
      .post(`${this.apiUrl}auth/session/heartbeat`, { encrypt: token })
      .pipe(catchError(() => of(true)));
  }

  /**
   * Valida la sesión contra backend usando /dash/me (no rota el JWT,
   * solo confirma que sigue viva y refresca los datos del usuario).
   * Reemplaza al viejo signInUsingToken() que pegaba a sign-in-with-token.
   */
  private validateSession(): Observable<boolean> {
    const token = this.encrypt;

    if (!token) {
      this.clearSession();
      return of(false);
    }

    return this._userService.fetchMe().pipe(
      switchMap(() => {
        this._authenticated = true;
        return of(true);
      }),
      catchError(() => {
        this.clearSession();
        return of(false);
      }),
    );
  }
}
