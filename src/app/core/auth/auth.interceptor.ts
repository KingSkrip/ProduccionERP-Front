import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpRequest,
} from '@angular/common/http';

import { inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'app/core/auth/auth.service';
import { AuthUtils } from 'app/core/auth/auth.utils';

import {
    EMPTY,
    Observable,
    catchError,
    throwError,
} from 'rxjs';

export const authInterceptor = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {

    const authService = inject(AuthService);
    const router = inject(Router);

    // 🔥 VALIDACIÓN PROACTIVA ANTES DEL REQUEST
    if (
        authService.encrypt &&
        AuthUtils.isTokenExpired(authService.encrypt)
    ) {

        authService.signOut();

        router.navigateByUrl('sign-in');

        // No dejamos que salga el request
        return EMPTY;

    }

    let newReq = req.clone();

    // Agregar Authorization
    if (
        authService.encrypt &&
        !AuthUtils.isTokenExpired(authService.encrypt)
    ) {

        newReq = req.clone({

            headers: req.headers.set(
                'Authorization',
                'Bearer ' + authService.encrypt,
            ),

        });

    }

    return next(newReq).pipe(

        catchError((error) => {

            if (
                error instanceof HttpErrorResponse &&
                error.status === 401
            ) {

                // No cerrar sesión si el 401 viene del login
                const isSignInRequest =
                    req.url.includes('/auth/sign-in');

                if (isSignInRequest) {

                    return throwError(() => error);

                }

                authService.signOut();

                router.navigateByUrl('sign-in');

                // Puedes regresar el error o detenerlo
                return EMPTY;

            }

            return throwError(() => error);

        }),

    );

};