import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { AuthUtils } from './auth.utils';

@Injectable({ providedIn: 'root' })
export class SessionActivityService implements OnDestroy {
  private heartbeatInterval: any = null;

  private readonly HEARTBEAT_MS = 30000;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    this.init();
  }

  private init(): void {
    document.addEventListener('visibilitychange', () => {
      if (!this.authService.authenticated) {
        return;
      }

      if (document.hidden) {
        this.stopHeartbeat();

        this.authService.pauseSession().subscribe();
      } else {
        // 🔥 Primero validar si el token expiró
        if (this.isSessionExpired()) {
          return;
        }

        this.authService.resumeSession().subscribe();

        this.startHeartbeat();
      }
    });

    // Refuerzo para móvil / PWA
    window.addEventListener('pagehide', () => {
      if (this.authService.authenticated) {
        navigator.sendBeacon?.(
          `${this.authService['apiUrl']}auth/session/pause`,
          JSON.stringify({
            encrypt: this.authService.encrypt,
          }),
        );
      }
    });

    window.addEventListener('pageshow', () => {
      if (!this.authService.authenticated) {
        return;
      }

      // 🔥 Validar antes de reanudar
      if (this.isSessionExpired()) {
        return;
      }

      this.authService.resumeSession().subscribe();

      this.startHeartbeat();
    });

    if (this.authService.authenticated && !document.hidden) {
      if (!this.isSessionExpired()) {
        this.startHeartbeat();
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (document.hidden || !this.authService.authenticated) {
        return;
      }

      // 🔥 VALIDACIÓN PROACTIVA
      if (this.isSessionExpired()) {
        return;
      }

      this.authService.heartbeat().subscribe();
    }, this.HEARTBEAT_MS);
  }

  private isSessionExpired(): boolean {
    if (this.authService.encrypt && AuthUtils.isTokenExpired(this.authService.encrypt)) {
      this.stopHeartbeat();

      this.authService.signOut();

      this.router.navigateByUrl('sign-in');

      return true;
    }

    return false;
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);

      this.heartbeatInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopHeartbeat();
  }
}
