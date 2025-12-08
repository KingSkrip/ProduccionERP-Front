import { TextFieldModule } from '@angular/cdk/text-field';
import {
    FuseConfig,
    FuseConfigService,
    Scheme,
    Theme,
} from '@fuse/services/config';

import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatDrawer } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { FuseCardComponent } from '@fuse/components/card';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { Subject, takeUntil } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
    selector: 'profile',
    templateUrl: './profile.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        TextFieldModule,
        MatDividerModule,
        MatTooltipModule,
        NgClass,
        MatSidenavModule,
        MatButtonModule,
        MatIconModule,
        NgClass,
    ],
})
export class ProfileComponent {
    @ViewChild('drawer') drawer: MatDrawer;
    drawerMode: 'over' | 'side' = 'side';
    drawerOpened: boolean = true;
    panels: any[] = [];
    selectedPanel: string = 'account';

    config: FuseConfig;
    layout: string;
    scheme: 'dark' | 'light';
    theme: string;
    themes: any;
    layouts: any = [
    { value: 'classic', label: 'Clásico' },
    { value: 'compact', label: 'Compacto' },
    { value: 'modern', label: 'Moderno' },
];
    schemes = ['light', 'dark', 'auto'];

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _fuseConfigService: FuseConfigService
    ) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Setup available panels
        this.panels = [
            {
                id: 'account',
                icon: 'heroicons_outline:user-circle',
                title: 'Cuenta',
                description: 'Administra tu perfil e información privada.',
            },
            {
                id: 'security',
                icon: 'heroicons_outline:lock-closed',
                title: 'Seguridad',
                description: 'Administra tu contraseña.',
            },
            // {
            //     id: 'plan-billing',
            //     icon: 'heroicons_outline:credit-card',
            //     title: 'Plan y Facturación',
            //     description: 'Administra tu plan de suscripción, método de pago e información de facturación',
            // },
            // {
            //     id: 'notifications',
            //     icon: 'heroicons_outline:bell',
            //     title: 'Notificaciones',
            //     description: 'Administra cuándo y por qué canal recibirás notificaciones',
            // },
            // {
            //     id: 'team',
            //     icon: 'heroicons_outline:user-group',
            //     title: 'Equipo',
            //     description: 'Administra tu equipo existente y cambia roles/permisos',
            // },
        ];

        // Subscribe to media changes
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                // Set the drawerMode and drawerOpened
                if (matchingAliases.includes('lg')) {
                    this.drawerMode = 'side';
                    this.drawerOpened = true;
                } else {
                    this.drawerMode = 'over';
                    this.drawerOpened = false;
                }

                // Mark for check
                this._changeDetectorRef.markForCheck();
            });

        this._fuseConfigService.config$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((config: FuseConfig) => {
                this.config = config;
                this.layout = config.layout;
                this.theme = config.theme;
                this.themes = config.themes;
                this._changeDetectorRef.markForCheck();
            });



    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Navigate to the panel
     *
     * @param panel
     */
    goToPanel(panel: string): void {
        this.selectedPanel = panel;

        // Close the drawer on 'over' mode
        if (this.drawerMode === 'over') {
            this.drawer.close();
        }
    }

    /**
     * Get the details of the panel
     *
     * @param id
     */
    getPanelInfo(id: string): any {
        return this.panels.find((panel) => panel.id === id);
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }


    setLayout(layout: string): void {
    this._fuseConfigService.config = { layout };
}

setScheme(scheme: Scheme): void {
    this._fuseConfigService.config = { scheme };
}

setTheme(theme: Theme): void {
    this._fuseConfigService.config = { theme };
}

resetConfig(): void {
    this._fuseConfigService.config = {
        layout: 'classic',
        theme: 'default',
        scheme: 'auto',
    };
}

}
