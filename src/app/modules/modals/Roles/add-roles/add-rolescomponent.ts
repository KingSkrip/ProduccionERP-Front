import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { RolesService } from 'app/modules/admin/cruds/usuarios/roles/roles.service';
import { Subject, takeUntil } from 'rxjs';

export const slideUp = trigger('slideUp', [
    transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate('320ms cubic-bezier(0.32, 0.72, 0, 1)', style({ transform: 'translateY(0)', opacity: 1 })),
    ]),
    transition(':leave', [
        animate('220ms cubic-bezier(0.4, 0, 1, 1)', style({ transform: 'translateY(120%)', opacity: 0 })),
    ]),
]);

@Component({
    selector: 'add-roles',
    templateUrl: './add-roles.component.html',
    styleUrls: ['./add-roles.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [slideUp],
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

    newRolForm!: UntypedFormGroup;
    isLoading: boolean = false;

    // ==== drag to dismiss (móvil) ====
    isDragging = false;
    dragTransform = 'translateY(0)';
    dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
    private _touchStartY = 0;
    private _dragY = 0;
    private readonly DISMISS_THRESHOLD = 140;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _rolesService: RolesService,
        private _dialogRef: MatDialogRef<AddrolesComponent>,
    ) { }

    ngOnInit(): void {
        this.newRolForm = this._formBuilder.group({
            nombre: ['', [Validators.required]],
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // ==== DRAG HANDLERS ====
    onTouchStart(event: TouchEvent): void {
        this._touchStartY = event.touches[0].clientY;
        this.isDragging = true;
        this.dragTransition = 'none';
        this._changeDetectorRef.markForCheck();
    }

    onTouchMove(event: TouchEvent): void {
        if (!this.isDragging) return;
        event.preventDefault();
        const deltaY = event.touches[0].clientY - this._touchStartY;
        if (deltaY <= 0) {
            this.dragTransform = 'translateY(0)';
            return;
        }
        this._dragY = deltaY;
        const resistance =
            deltaY > this.DISMISS_THRESHOLD
                ? this.DISMISS_THRESHOLD + (deltaY - this.DISMISS_THRESHOLD) * 0.35
                : deltaY;
        this.dragTransform = `translateY(${resistance}px)`;
        this._changeDetectorRef.markForCheck();
    }

    onTouchEnd(event: TouchEvent): void {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.dragTransition = 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)';
        if (this._dragY >= this.DISMISS_THRESHOLD) {
            this.dragTransform = 'translateY(120%) scale(0.95)';
            this._changeDetectorRef.markForCheck();
            setTimeout(() => this.closeModal(), 320);
        } else {
            this.dragTransform = 'translateY(0)';
            this._changeDetectorRef.markForCheck();
        }
        this._dragY = 0;
    }

    closeModal(): void {
        this.newRolForm.reset();
        this._dialogRef.close(false);
    }

    submitForm(): void {
        if (this.newRolForm.invalid) {
            this.newRolForm.markAllAsTouched();

            const errors: string[] = [];
            if (this.newRolForm.get('nombre')?.hasError('required')) {
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

        const payload = {
            nombre: this.newRolForm.get('nombre')?.value,
            guard_name: 'web',
        };

        this._rolesService.createRol(payload)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res: any) => {
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