// app/core/interceptors/decrypt.interceptor.ts
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { EncryptionService } from '../services/encryption.service';

export const decryptInterceptor: HttpInterceptorFn = (req, next) => {
    const encryptionService = inject(EncryptionService);

    return next(req).pipe(
        map(event => {
            // Solo procesar HttpResponse
            if (event instanceof HttpResponse) {
                const body = event.body;

                // Si la respuesta está encriptada, desencriptarla
                if (encryptionService.isEncrypted(body)) {
                    try {
                        const decrypted = encryptionService.decrypt((body as any).data);
                        
                        // Retornar respuesta con datos desencriptados
                        return event.clone({ body: decrypted });
                    } catch (error) {
                        console.error('❌ Error desencriptando respuesta:', error);
                        throw error;
                    }
                }
            }

            return event;
        })
    );
};