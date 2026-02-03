import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import {
    FormsModule,
    NgForm,
    ReactiveFormsModule,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { fuseAnimations } from '@fuse/animations';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { AuthService } from 'app/core/auth/auth.service';
import { DashboardByRole } from 'app/core/auth/roles/dataroles-dashboard';

@Component({
    selector: 'auth-sign-in',
    templateUrl: './sign-in.component.html',
    encapsulation: ViewEncapsulation.None,
    animations: fuseAnimations,
    imports: [
        RouterLink,
        FuseAlertComponent,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
    ],
})
export class AuthSignInComponent implements OnInit {
    @ViewChild('signInNgForm') signInNgForm: NgForm;

    alert: { type: FuseAlertType; message: string } = {
        type: 'success',
        message: '',
    };
    signInForm: UntypedFormGroup;
    showAlert: boolean = false;

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _authService: AuthService,
        private _formBuilder: UntypedFormBuilder,
        private _router: Router
    ) { }

    ngOnInit(): void {
      localStorage.removeItem('encrypt');
    this._authService.signOut().subscribe(); // resetea estado

    this.signInForm = this._formBuilder.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
        rememberMe: [''],
    });
    }

    signIn(event?: Event): void {
        // CRÍTICO: Prevenir reload de la página
        if (event) {
            event.preventDefault();
        }

        // Validar el formulario
        if (this.signInForm.invalid) {
            return;
        }

        // Deshabilitar el formulario y ocultar alertas previas
        this.signInForm.disable();
        this.showAlert = false;


        this._authService.signIn(this.signInForm.value).subscribe({
            next: (response: any) => {
                // Éxito: redirigir según el rol
                const userRole = response.user.permissions[0];
                const redirectURL = DashboardByRole[userRole] || '/signed-in-redirect';
                this._router.navigateByUrl(redirectURL);
            },
            error: (error) => {
                console.error('❌ Error en login:', error);
                
                // Re-habilitar el formulario
                this.signInForm.enable();

                // Mostrar mensaje de error
                this.alert = {
                    type: 'error',
                    message: 'Correo electrónico o contraseña incorrectos',
                };
                this.showAlert = true;

                // Solo limpiar el campo de contraseña por seguridad
                this.signInForm.patchValue({ password: '' });
                
            }
        });
    }
}