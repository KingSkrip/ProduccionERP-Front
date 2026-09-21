import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  FuseNavigationItem,
  FuseNavigationService,
  FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { AppNavigationStoreService } from '@fuse/components/navigation/appnavigationstore.service';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { AuthService } from 'app/core/auth/auth.service';
import {
  RolesWithChildMenuAccess,
  SubRoleEnum,
  SubRolesWithChildMenuAccess,
} from 'app/core/auth/roles/dataroles';
import { APP_CONFIG } from 'app/core/config/app-config';
import { UserService } from 'app/core/user/user.service';
import { filter, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'reportprod-layout',
  templateUrl: './reportprod.component.html',
  styleUrls: ['./reportprod.component.scss'], // 👈 AQUÍ
  encapsulation: ViewEncapsulation.Emulated,
  imports: [
    FuseVerticalNavigationComponent,
    MatButtonModule,
    MatIconModule,
    RouterOutlet,
    CommonModule,
  ],
})
export class ReportProdLayoutComponent implements OnInit, OnDestroy {
  isScreenSmall: boolean;
  navigation: FuseNavigationItem[] = [];
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  appName = APP_CONFIG.appName;
  navOpened = false;
  mostrarMenuMas = false;
  @ViewChild('reportProdNav', { static: true })
  reportProdNav!: FuseVerticalNavigationComponent;
  isJacobo: boolean = false;

  constructor(
    private _activatedRoute: ActivatedRoute,
    private _router: Router,
    private _fuseMediaWatcherService: FuseMediaWatcherService,
    private _fuseVerticalNavigationService: AppNavigationStoreService,
    private _fuseNavigationService: FuseNavigationService,
    private _authService: AuthService,
    private _userService: UserService,
  ) {}

  get currentYear(): number {
    return new Date().getFullYear();
  }

  ngOnInit(): void {
    // 1⃣ Detectar tamaño de pantalla (esto se queda)
    this._fuseMediaWatcherService.onMediaChange$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(({ matchingAliases }) => {
        this.isScreenSmall = !matchingAliases.includes('md');
      });

    // 2⃣ Obtener rol y subrol del usuario
    this._authService
      .getUserRole()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(({ roleId, subRoleId }) => {
        this.isJacobo = subRoleId === SubRoleEnum.JACOBO;

        const canSeeChildMenu =
          SubRolesWithChildMenuAccess.has(subRoleId) || RolesWithChildMenuAccess.has(roleId);

        if (canSeeChildMenu) {
          const reportProdNav = this._fuseVerticalNavigationService.getReportProdNavigation(
            roleId,
            subRoleId,
          );
          this._fuseVerticalNavigationService.storeNavigation('reportprod', reportProdNav);
          this.navigation = this._fuseVerticalNavigationService.getNavigation('reportprod');
        } else {
          this._fuseVerticalNavigationService.storeNavigation('reportprod', []);
          this.navigation = [];
        }
      });

    // 🔥 Solo para Jacobo: cerrar nav hijo al navegar
    this._router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this._unsubscribeAll),
      )
      .subscribe(() => {
        const user = this._userService.user;
        const subRoleId = user?.sub_permissions?.[0] ?? null;
        const isJacobo = subRoleId === SubRoleEnum.JACOBO;

        if (!isJacobo) return; // 👈 Solo aplica para Jacobo

        const nav =
          this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(
            'reportProdNav',
          );
        if (nav?.opened) {
          nav.close();
          this.navOpened = false;
        }
      });

    // 3⃣ Escuchar cambios del menú hijo (por si se actualiza)
    this._fuseVerticalNavigationService.onNavigationChanged$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(({ key }) => {
        if (key === 'reportprod') {
          this.navigation = this._fuseVerticalNavigationService.getNavigation('reportprod');
        }
      });
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  toggleReportProdNav(): void {
    this.navOpened = !this.navOpened;
    // En móvil, cerrar el nav padre antes de abrir el hijo
    if (this.isScreenSmall) {
      const parentNav =
        this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');
      if (parentNav && parentNav.opened) {
        parentNav.close();
      }
    }

    this.reportProdNav?.toggle();
  }


  toggleMenuMas(): void {
  this.mostrarMenuMas = !this.mostrarMenuMas;
}

isActiveRoute(link: string): boolean {
  return this._router.url.includes(link);
}
// (inyecta Router en el constructor si no lo tienes)

navegarA(link: string): void {
  this._router.navigate([link]);
  this.mostrarMenuMas = false;
}


// Abanico radial hacia arriba — distribuye los items en semicírculo
getFanX(index: number, total: number): number {
  if (total === 1) return 85; // centrado
  const startAngle = 200; // grados desde la derecha
  const endAngle = 340;
  const angle = startAngle + (index / (total - 1)) * (endAngle - startAngle);
  const rad = (angle * Math.PI) / 180;
  return 85 + Math.cos(rad) * 90; // 90 = radio del abanico
}

getFanY(index: number, total: number): number {
  if (total === 1) return 60;
  const startAngle = 200;
  const endAngle = 340;
  const angle = startAngle + (index / (total - 1)) * (endAngle - startAngle);
  const rad = (angle * Math.PI) / 180;
  return 10 + Math.abs(Math.sin(rad)) * 90;
}

}
