import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { FuseFullscreenComponent } from '@fuse/components/fullscreen';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
    FuseNavigationService,
    FuseVerticalNavigationComponent,
    FuseNavigationItem,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { APP_CONFIG } from 'app/core/config/app-config';
import { AppConfig } from 'app/core/config/app-config.model';
import { LanguagesComponent } from 'app/layout/common/languages/languages.component';
import { MessagesComponent } from 'app/layout/common/messages/messages.component';
import { NotificationsComponent } from 'app/layout/common/notifications/notifications.component';
import { QuickChatComponent } from 'app/layout/common/quick-chat/quick-chat.component';
import { SearchComponent } from 'app/layout/common/search/search.component';
import { ShortcutsComponent } from 'app/layout/common/shortcuts/shortcuts.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { Subject, takeUntil, filter } from 'rxjs';

@Component({
    selector: 'thin-layout',
    templateUrl: './thin.component.html',
    encapsulation: ViewEncapsulation.None,
    imports: [
        FuseLoadingBarComponent,
        FuseVerticalNavigationComponent,
        MatButtonModule,
        MatIconModule,
        FuseFullscreenComponent,
        UserComponent,
        RouterOutlet,
        QuickChatComponent,
    ],
})
export class ThinLayoutComponent implements OnInit, OnDestroy {
     isScreenSmall: boolean;
    navigation: FuseNavigationItem[] = [];
    isReportProdRoute: boolean = false;
    isNavOpen: boolean = false; // Nueva propiedad
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    appName = APP_CONFIG.appName;

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _router: Router,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _fuseNavigationService: FuseNavigationService,
    ) {}

    get currentYear(): number {
        return new Date().getFullYear();
    }

    ngOnInit(): void {
        this.navigation = this._fuseNavigationService.getNavigation('main');

        this._fuseNavigationService.onNavigationChanged$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ key }) => {
                if (key === 'main') {
                    this.navigation = this._fuseNavigationService.getNavigation('main');
                }
            });

        if (!this.navigation || !Array.isArray(this.navigation)) {
            this.navigation = [];
        }

        // Detectar ruta reportprod
        this._router.events
            .pipe(
                filter(event => event instanceof NavigationEnd),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(() => {
                this.isReportProdRoute = this._router.url.includes('/reportprod');
                
                // Cerrar el nav padre si estamos en reportprod y en móvil
                if (this.isReportProdRoute && this.isScreenSmall) {
                    const nav = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');
                    if (nav && nav.opened) {
                        nav.close();
                    }
                }
            });

        // Verificar ruta inicial
        this.isReportProdRoute = this._router.url.includes('/reportprod');

        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.isScreenSmall = !matchingAliases.includes('md');
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    toggleNavigation(name: string): void {
        // No permitir abrir el nav padre si estamos en reportprod en móvil
        if (this.isReportProdRoute && this.isScreenSmall) {
            return;
        }

        const navigation =
            this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(name);

        if (navigation) {
            navigation.toggle();
        }
        
        // En móvil, cerrar otros navs cuando se abre este
        if (this.isScreenSmall && navigation && navigation.opened) {
            // Cerrar el nav hijo si está abierto
            const childNav = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('reportProdNav');
            if (childNav && childNav.opened) {
                childNav.close();
            }
        }
    }
}