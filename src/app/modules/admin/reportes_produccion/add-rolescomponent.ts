import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { fuseAnimations } from '@fuse/animations';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { RHService } from 'app/modules/admin/cruds/usuarios/rh/rh.service';
import { RolesService } from 'app/modules/admin/cruds/usuarios/roles/roles.service';

import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'add-roles',
    templateUrl: './add-roles.component.html',
    styleUrls: ['./add-roles.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations,
    imports: [
        CommonModule,
        MatProgressBarModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
    ],
})
export class AddrolesComponent implements OnInit, OnDestroy {
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    @Output() onCreated = new EventEmitter<void>();

    newRolForm: UntypedFormGroup;
    isLoading: boolean = false;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _rolesService: RolesService,
        private _dialogRef: MatDialogRef<AddrolesComponent>,
    ) { }

    ngOnInit(): void {
        this.newRolForm = this._formBuilder.group({
            NOMBRE: ['', [Validators.required]],
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    closeModal(): void {
        this.newRolForm.reset();
        this._dialogRef.close(false);
    }

    submitForm(): void {
        if (this.newRolForm.invalid) {
            this.newRolForm.markAllAsTouched();

            const errors: string[] = [];
            if (this.newRolForm.get('NOMBRE')?.hasError('required')) {
                errors.push('El nombre del rol es obligatorio.');
            }

            if (errors.length > 0) {
                this._fuseConfirmationService.open({
                    title: 'Formulario incompleto',
                    message: errors.join('\n• '),
                    icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
                    actions: { confirm: { show: true, label: 'Aceptar', color: 'warn' }, cancel: { show: false } },
                });
            }
            return;
        }

        this.createRol();
    }

    createRol(): void {
    if (this.newRolForm.invalid) return;

    this.isLoading = true;

    // Payload según lo que espera tu backend
    const payload = {
        NOMBRE: this.newRolForm.get('NOMBRE')?.value,
        GUARD_NAME: 'web' // valor fijo
    };

    this._rolesService.createRol(payload)
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
            next: (res: any) => { // res tiene { ok, msg, data }
                if (res.ok) {
                    this._fuseConfirmationService.open({
                        title: 'Éxito',
                        message: res.msg || 'Rol creado correctamente',
                        icon: { show: true, name: 'heroicons_outline:check-circle', color: 'success' },
                        actions: { confirm: { show: true, label: 'Aceptar', color: 'primary' }, cancel: { show: false } },
                    });

                    this._dialogRef.close(res.data);
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                    this.newRolForm.reset();
                } else {
                    this._fuseConfirmationService.open({
                        title: 'Error',
                        message: res.msg || 'Ocurrió un error al crear el rol',
                        icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
                        actions: { confirm: { show: true, label: 'Aceptar', color: 'warn' }, cancel: { show: false } },
                    });
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                }
            },
            error: (err) => {
                const errorMessage = err.error?.msg || 'Ocurrió un error al crear el rol';
                this._fuseConfirmationService.open({
                    title: 'Error',
                    message: errorMessage,
                    icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
                    actions: { confirm: { show: true, label: 'Aceptar', color: 'warn' }, cancel: { show: false } },
                });
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            },
        });
}


}
