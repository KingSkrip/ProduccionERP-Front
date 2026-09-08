import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  LOCALE_ID,
  provideAppInitializer,
} from '@angular/core';
import { LuxonDateAdapter } from '@angular/material-luxon-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideFuse } from '@fuse';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { appRoutes } from 'app/app.routes';
import { provideAuth } from 'app/core/auth/auth.provider';
import { provideIcons } from 'app/core/icons/icons.provider';
import { MockApiService } from 'app/mock-api';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { decryptInterceptor } from './core/interceptors/decrypt.interceptor';
import { fuseLoadingSilentInterceptor } from './core/interceptors/fuse-loading-silent.interceptor';
import { TranslocoHttpLoader } from './core/transloco/transloco.http-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideHttpClient(
      withInterceptors([
        decryptInterceptor,
        fuseLoadingSilentInterceptor, // 👈 aquí
      ]),
    ),
    provideRouter(appRoutes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
    { provide: LOCALE_ID, useValue: 'es-MX' },
    // Date adapter
    { provide: DateAdapter, useClass: LuxonDateAdapter },
    {
      provide: MAT_DATE_FORMATS,
      useValue: {
        parse: { dateInput: 'D' },
        display: {
          dateInput: 'DDD',
          monthYearLabel: 'LLL yyyy',
          dateA11yLabel: 'DD',
          monthYearA11yLabel: 'LLLL yyyy',
        },
      },
    },

    // Transloco
    provideTransloco({
      config: {
        availableLangs: [
          { id: 'en', label: 'English' },
          { id: 'tr', label: 'Turkish' },
        ],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),

    provideAppInitializer(() => {
      const translocoService = inject(TranslocoService);
      const defaultLang = translocoService.getDefaultLang();
      translocoService.setActiveLang(defaultLang);

      return firstValueFrom(translocoService.load(defaultLang));
    }),

    // 🔥 AQUÍ AGREGAS TU APP_INITIALIZER
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      return firstValueFrom(authService.check());
    }),

    // Fuse
    provideAuth(),
    provideIcons(),
    provideFuse({
      mockApi: {
        delay: 0,
        service: MockApiService,
      },
      fuse: {
        layout: 'thin',
        scheme: 'auto',
        screens: {
          sm: '600px',
          md: '960px',
          lg: '1280px',
          xl: '1440px',
        },
        theme: 'theme-teal',
        themes: [
          { id: 'theme-default', name: 'Default' },
          { id: 'theme-brand', name: 'Brand' },
          { id: 'theme-teal', name: 'Teal' },
          { id: 'theme-rose', name: 'Rose' },
          { id: 'theme-purple', name: 'Purple' },
          { id: 'theme-amber', name: 'Amber' },
        ],
      },
    }),
  ],
};
