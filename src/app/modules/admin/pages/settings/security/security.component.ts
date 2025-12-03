// ============================================
// security.component.ts
// ============================================
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import {
    FormsModule,
    ReactiveFormsModule,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
    AbstractControl,
    ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../settings.service';

@Component({
    selector: 'settings-security',
    templateUrl: './security.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSlideToggleModule,
        MatButtonModule,
        MatProgressBarModule,
    ],
})
export class SettingsSecurityComponent implements OnInit {
    securityForm: UntypedFormGroup;
    hideNewPassword = true;
    hideConfirmPassword = true;
    passwordStrength = 0;
    passwordStrengthText = '';
    passwordStrengthColor = '';

    /**
     * Constructor
     */
    constructor(
        private _formBuilder: UntypedFormBuilder,
        private _settings: SettingsService,
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
   ngOnInit(): void {
    // Create the form with password matching validator
    this.securityForm = this._formBuilder.group({
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
        twoStep: [true],
        askPasswordChange: [false],
    }, {
        validators: this.passwordMatchValidator
    });

    // Escuchar cambios en la contraseña para calcular la seguridad
    this.securityForm.get('newPassword')?.valueChanges.subscribe((value) => {
        this.calculatePasswordStrength(value);
        // Revalidar confirmPassword cuando cambia newPassword
        this.securityForm.get('confirmPassword')?.updateValueAndValidity({ emitEvent: false });
    });

    // Revalidar cuando cambia confirmPassword
    this.securityForm.get('confirmPassword')?.valueChanges.subscribe(() => {
        // Esto asegura que el error se actualice en tiempo real
        this.securityForm.updateValueAndValidity({ emitEvent: false });
    });
}

    /**
     * Validador personalizado para verificar que las contraseñas coincidan
     */
    passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');

    if (!newPassword || !confirmPassword) {
        return null;
    }

    const newPasswordValue = newPassword.value;
    const confirmPasswordValue = confirmPassword.value;

    // No mostrar error si confirmPassword está vacío
    if (!confirmPasswordValue) {
        return null;
    }

    // No mostrar error si newPassword está vacío
    if (!newPasswordValue) {
        return null;
    }

    // Solo mostrar error si ambos campos tienen valor Y no coinciden
    if (newPasswordValue !== confirmPasswordValue) {
        // Marcar el error específicamente en confirmPassword
        confirmPassword.setErrors({ ...confirmPassword.errors, passwordMismatch: true });
        return { passwordMismatch: true };
    } else {
        // Limpiar el error de passwordMismatch si coinciden
        if (confirmPassword.hasError('passwordMismatch')) {
            const errors = { ...confirmPassword.errors };
            delete errors['passwordMismatch'];
            confirmPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
        }
    }

    return null;
}

    /**
     * Calcular la fortaleza de la contraseña
     */
    calculatePasswordStrength(password: string): void {
        if (!password) {
            this.passwordStrength = 0;
            this.passwordStrengthText = '';
            this.passwordStrengthColor = '';
            return;
        }

        let strength = 0;
        
        // Longitud (máximo 30 puntos)
        if (password.length >= 8) strength += 20;
        if (password.length >= 12) strength += 10;

        // Tiene números (20 puntos)
        if (/\d/.test(password)) strength += 20;

        // Tiene letras minúsculas (15 puntos)
        if (/[a-z]/.test(password)) strength += 15;

        // Tiene letras mayúsculas (15 puntos)
        if (/[A-Z]/.test(password)) strength += 15;

        // Tiene caracteres especiales (20 puntos)
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 20;

        this.passwordStrength = strength;

        // Determinar el texto y color según la fortaleza
        if (strength < 40) {
            this.passwordStrengthText = 'Débil';
            this.passwordStrengthColor = 'warn';
        } else if (strength < 70) {
            this.passwordStrengthText = 'Media';
            this.passwordStrengthColor = 'accent';
        } else {
            this.passwordStrengthText = 'Fuerte';
            this.passwordStrengthColor = 'primary';
        }
    }

    /**
     * Prevenir pegado en los campos de contraseña
     */
    onPaste(event: ClipboardEvent): void {
        event.preventDefault();
    }

    /**
     * Cancelar cambios
     */
    cancelar(): void {
        this.securityForm.reset({
            newPassword: '',
            confirmPassword: '',
            twoStep: true,
            askPasswordChange: false,
        });
        this.hideNewPassword = true;
        this.hideConfirmPassword = true;
        this.passwordStrength = 0;
        this.passwordStrengthText = '';
        this.passwordStrengthColor = '';
    }

    /**
     * Guardar contraseña
     */
    guardarPassword(): void {
        if (this.securityForm.invalid) {
            this.securityForm.markAllAsTouched();
            return;
        }

        const form = this.securityForm.value;
        const payload = {
            password_nueva: form.newPassword,
        };

        this._settings.updatePassword(payload).subscribe({
            next: (resp) => {
                console.log('Contraseña cambiada', resp);
                // Limpiar formulario después de éxito
                this.cancelar();
            },
            error: (err) => console.error(err),
        });
    }

    /**
     * Eliminar cuenta
     */
    eliminarCuenta(): void {
        this._settings.deleteAccount('miPassword').subscribe({
            next: () => console.log('Cuenta eliminada'),
            error: (err) => console.error(err),
        });
    }
}