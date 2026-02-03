import { Component, OnDestroy, OnInit, ViewEncapsulation, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import {
    FuseVerticalNavigationComponent,
    FuseNavigationItem,
    FuseNavigationService,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Subject, takeUntil } from 'rxjs';
import { AppNavigationStoreService } from '@fuse/components/navigation/appnavigationstore.service';
import { AuthService } from 'app/core/auth/auth.service';
import { CommonModule, NgIf } from '@angular/common';
import { RoleEnum, SubRoleEnum } from 'app/core/auth/roles/dataroles';
import { Roles } from 'app/core/auth/roles/dataroles';

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
    @ViewChild('reportProdNav', { static: true })
    reportProdNav!: FuseVerticalNavigationComponent;

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _router: Router,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _fuseVerticalNavigationService: AppNavigationStoreService,
        private _fuseNavigationService: FuseNavigationService,
        private _authService: AuthService,
    ) { }

    get currentYear(): number {
        return new Date().getFullYear();
    }

    ngOnInit(): void {

        // 1️⃣ Detectar tamaño de pantalla (esto se queda)
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.isScreenSmall = !matchingAliases.includes('md');
            });

        // 2️⃣ Obtener rol y subrol del usuario
        this._authService.getUserRole()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ roleId, subRoleId }) => {

                // console.log('rol', roleId);
                // console.log('subrol', subRoleId);

                const canSeeChildMenu =
                    subRoleId === SubRoleEnum.JEFE || roleId === RoleEnum.SUADMIN;

                if (canSeeChildMenu) {
                    const reportProdNav =
                        this._fuseVerticalNavigationService.getReportProdNavigation(roleId, subRoleId);

                    this._fuseVerticalNavigationService.storeNavigation('reportprod', reportProdNav);

                    this.navigation =
                        this._fuseVerticalNavigationService.getNavigation('reportprod');

                } else {
                    this._fuseVerticalNavigationService.storeNavigation('reportprod', []);
                    this.navigation = [];
                }
            });



        // 3️⃣ Escuchar cambios del menú hijo (por si se actualiza)
        this._fuseVerticalNavigationService.onNavigationChanged$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ key }) => {
                if (key === 'reportprod') {
                    this.navigation =
                        this._fuseVerticalNavigationService.getNavigation('reportprod');
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
            const parentNav = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');
            if (parentNav && parentNav.opened) {
                parentNav.close();
            }
        }

        this.reportProdNav?.toggle();
    }
}