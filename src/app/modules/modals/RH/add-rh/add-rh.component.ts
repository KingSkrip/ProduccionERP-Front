import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    OnDestroy,
    OnInit,
    Output,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule, MatRippleModule } from '@angular/material/core';

import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { fuseAnimations } from '@fuse/animations';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { RHService } from 'app/modules/admin/cruds/usuarios/rh/rh.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'add-rh',
    templateUrl: './add-rh.component.html',
    styleUrls: ['./add-rh.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatOptionModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatRippleModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatSortModule,
    ],
})
export class AddrhComponent implements OnInit, OnDestroy {
    private _unsubscribeAll = new Subject<void>();

    @Output() onCreated = new EventEmitter<void>();

    newUsuarioForm!: UntypedFormGroup;
    isLoading = false;
    newPhotoUrl = '';
    selectedPhotoFile: File | null = null;

    showPassword = false;
    showPasswordConfirmation = false;
    passwordStrength = 0;
    passwordStrengthLabel = '';
    passwordStrengthColor = '';

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _rhService: RHService,
        private _dialogRef: MatDialogRef<AddrhComponent>,
    ) {}

    ngOnInit(): void {
        this.newUsuarioForm = this._formBuilder.group({
            id: [''],
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            departamento: [''],
            usuario: ['', Validators.required],
            password: ['', [Validators.required, Validators.minLength(6)]],
            password_confirmation: ['', Validators.required],
        });

        this.newUsuarioForm.get('password')?.valueChanges.subscribe(value => this.checkPasswordStrength(value));
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------
    // Methods
    // -----------------------------

    closeModal(): void {
        this.resetForm();
        this._dialogRef.close(false);
    }

    onPhotoSelected(event: Event): void {
        const file = (event.target as HTMLInputElement)?.files?.[0];
        if (!file) return;

        this.selectedPhotoFile = file;

        const reader = new FileReader();
        reader.onload = () => {
            this.newPhotoUrl = reader.result as string;
            this._changeDetectorRef.markForCheck();
        };
        reader.readAsDataURL(file);
    }

    submitForm(): void {
        if (this.newUsuarioForm.invalid) {
            this.newUsuarioForm.markAllAsTouched();
            this.showValidationErrors();
            return;
        }

        const password = this.newUsuarioForm.get('password')?.value;
        const passwordConfirmation = this.newUsuarioForm.get('password_confirmation')?.value;

        if (password !== passwordConfirmation) {
            this.showError('Las contraseñas no coinciden');
            return;
        }

        this.createUsuario();
    }

    private createUsuario(): void {
        if (this.newUsuarioForm.invalid) return;

        const formData = new FormData();
        formData.append('name', this.newUsuarioForm.get('name')?.value);
        formData.append('email', this.newUsuarioForm.get('email')?.value);
        formData.append('password', this.newUsuarioForm.get('password')?.value);
        formData.append('usuario', this.newUsuarioForm.get('usuario')?.value);

        const departamento = this.newUsuarioForm.get('departamento')?.value;
        if (departamento) formData.append('departamento', departamento);

        if (this.selectedPhotoFile) {
            formData.append('photo', this.selectedPhotoFile, this.selectedPhotoFile.name);
        }

        this.isLoading = true;

        this._rhService.createUsuario(formData)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (newUser) => {
                    this._rhService.getUsuarios().subscribe();
                    this.showSuccess('Usuario RH creado correctamente');
                    this._dialogRef.close(newUser);
                    this.resetForm();
                },
                error: (err) => {
                    console.error('Error al crear', err);
                    let errorMessage = err.error?.message || 'Ocurrió un error al crear el usuario';
                    if (err.error?.errors) {
                        const errorList = Object.values(err.error.errors).flat().join('\n• ');
                        errorMessage = `${err.error.message}\n\n• ${errorList}`;
                    }
                    this.showError(errorMessage);
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    private checkPasswordStrength(password: string): void {
        if (!password) {
            this.passwordStrength = 0;
            this.passwordStrengthLabel = '';
            this.passwordStrengthColor = '';
            return;
        }

        let strength = 0;
        if (password.length >= 8) strength += 20;
        if (password.length >= 12) strength += 10;
        if (/[a-z]/.test(password)) strength += 20;
        if (/[A-Z]/.test(password)) strength += 20;
        if (/[0-9]/.test(password)) strength += 20;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 10;

        this.passwordStrength = strength;
        if (strength < 40) {
            this.passwordStrengthLabel = 'Débil';
            this.passwordStrengthColor = 'warn';
        } else if (strength < 70) {
            this.passwordStrengthLabel = 'Media';
            this.passwordStrengthColor = 'accent';
        } else {
            this.passwordStrengthLabel = 'Fuerte';
            this.passwordStrengthColor = 'primary';
        }
    }

    passwordsMatch(): boolean {
        const password = this.newUsuarioForm.get('password')?.value;
        const confirmation = this.newUsuarioForm.get('password_confirmation')?.value;
        return password === confirmation && password !== '';
    }

    passwordsDontMatch(): boolean {
        const password = this.newUsuarioForm.get('password')?.value;
        const confirmation = this.newUsuarioForm.get('password_confirmation')?.value;
        const confirmationTouched = this.newUsuarioForm.get('password_confirmation')?.touched;
        return password !== confirmation && confirmation !== '' && confirmationTouched;
    }

    blockPaste(event: ClipboardEvent): void {
        event.preventDefault();
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    togglePasswordConfirmationVisibility(): void {
        this.showPasswordConfirmation = !this.showPasswordConfirmation;
    }

    // -----------------------------
    // Helper methods
    // -----------------------------

    private resetForm(): void {
        this.newUsuarioForm.reset();
        this.newPhotoUrl = '';
        this.selectedPhotoFile = null;
        this.isLoading = false;
        this._changeDetectorRef.markForCheck();
    }

    private showValidationErrors(): void {
        const errors: string[] = [];
        Object.keys(this.newUsuarioForm.controls).forEach(key => {
            const control = this.newUsuarioForm.get(key);
            if (control?.invalid) {
                if (control.errors?.['required']) errors.push(`El campo ${key} es obligatorio`);
                if (control.errors?.['email']) errors.push(`El campo ${key} debe ser un correo válido`);
                if (control.errors?.['minlength'])
                    errors.push(`El campo ${key} debe tener al menos ${control.errors['minlength'].requiredLength} caracteres`);
            }
        });

        if (errors.length > 0) {
            this._fuseConfirmationService.open({
                title: 'Formulario incompleto',
                message: errors.join('\n• '),
                icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
                actions: { confirm: { show: true, label: 'Aceptar', color: 'warn' }, cancel: { show: false } },
            });
        }
    }

    private showError(message: string): void {
        this._fuseConfirmationService.open({
            title: 'Error',
            message,
            icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
            actions: { confirm: { show: true, label: 'Aceptar', color: 'warn' }, cancel: { show: false } },
        });
    }

    private showSuccess(message: string): void {
        this._fuseConfirmationService.open({
            title: 'Éxito',
            message,
            icon: { show: true, name: 'heroicons_outline:check-circle', color: 'success' },
            actions: { confirm: { show: true, label: 'Aceptar', color: 'primary' }, cancel: { show: false } },
        });
        this.isLoading = false;
        this._changeDetectorRef.markForCheck();
    }
}
