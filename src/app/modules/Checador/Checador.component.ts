import { CommonModule } from '@angular/common';
import {
    AfterViewInit,
    Component,
    OnDestroy,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from 'app/core/auth/auth.service';
import { RoleEnum } from 'app/core/auth/roles/dataroles';


import { ChecadorColabComponent } from './colaboradores/checador-colab.component';
import { ChecadorGuardComponent } from './guardias/checador-guard.component';

@Component({
    selector: 'app-checador',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        ChecadorColabComponent,
        ChecadorGuardComponent,
    ],
    templateUrl: './checador.component.html',
    styleUrls: ['./checador.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class ChecadorComponent implements OnDestroy {

    permission: number | null = null;

    readonly RoleEnum = RoleEnum;

    constructor(
        private readonly authService: AuthService,
    ) {
        this.cargarVista();
    }

    private cargarVista(): void {
        const user = this.authService.getUser();

        if (!user) {
            this.permission = null;
            return;
        }

        /*
         * permissions puede venir como:
         *
         * permissions: [1]
         * permissions: [10]
         *
         * o dependiendo de tu backend podría venir como un número.
         */
        const permissions = user.permissions;

        if (Array.isArray(permissions)) {
            this.permission = Number(permissions[0] ?? null);
        } else {
            this.permission = Number(permissions ?? null);
        }
    }

    get esColaborador(): boolean {
        return this.permission === RoleEnum.REGISTRO_ACCESOS;
    }

    get esGuardia(): boolean {
        return this.permission === RoleEnum.GUARDIA;
    }

    get sinAcceso(): boolean {
        return !this.esColaborador && !this.esGuardia;
    }

    ngOnDestroy(): void {
    }
}