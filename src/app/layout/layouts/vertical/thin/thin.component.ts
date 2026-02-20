import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { FuseFullscreenComponent } from '@fuse/components/fullscreen';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
  FuseNavigationItem,
  FuseNavigationService,
  FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { AuthService } from 'app/core/auth/auth.service';
import { SubRoleEnum } from 'app/core/auth/roles/dataroles';
import { APP_CONFIG } from 'app/core/config/app-config';
import { UserService } from 'app/core/user/user.service';
import { QuickChatComponent } from 'app/layout/common/quick-chat/quick-chat.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { filter, Subject, takeUntil } from 'rxjs';

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
  subRoleId: number;
  isJacobo: boolean = false;
  isNavOpen: boolean = false;
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  appName = APP_CONFIG.appName;

  constructor(
    private _activatedRoute: ActivatedRoute,
    private _router: Router,
    private _fuseMediaWatcherService: FuseMediaWatcherService,
    private _fuseNavigationService: FuseNavigationService,
    private _authService: AuthService,
    private _userService: UserService,
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
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this._unsubscribeAll),
      )
      .subscribe(() => {
        this.isReportProdRoute = this._router.url.includes('/reportprod');

        const nav =
          this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(
            'mainNavigation',
          );

        // 🔥 1️⃣ Si es Jacobo, SIEMPRE cerrar
        if (this.isJacobo && nav?.opened) {
          nav.close();
          this.isNavOpen = false;
          return;
        }

        // 🔥 2️⃣ Si es móvil, cerrar después de navegar
        if (this.isScreenSmall && nav?.opened) {
          nav.close();
          this.isNavOpen = false;
        }
      });

    // Verificar ruta inicial
    this.isReportProdRoute = this._router.url.includes('/reportprod');

    this._fuseMediaWatcherService.onMediaChange$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(({ matchingAliases }) => {
        this.isScreenSmall = !matchingAliases.includes('md');
        this.isNavOpen = this.isJacobo ? false : !this.isScreenSmall;
      });

    //me
    this._userService.user$.pipe(takeUntil(this._unsubscribeAll)).subscribe((user) => {
      if (!user) return;
      const subRoleId = user.sub_permissions?.[0] ?? null;
      this.isJacobo = subRoleId === SubRoleEnum.JACOBO;
      this.isNavOpen = this.isJacobo ? false : !this.isScreenSmall;
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
      const childNav =
        this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('reportProdNav');
      if (childNav && childNav.opened) {
        childNav.close();
      }
    }
  }
}
