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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { fuseAnimations } from '@fuse/animations';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { FuseValidators } from '@fuse/validators';
import { AuthService } from 'app/core/auth/auth.service';
import { finalize } from 'rxjs';

@Component({
    selector: 'auth-reset-password',
    templateUrl: './reset-password.component.html',
    encapsulation: ViewEncapsulation.None,
    animations: fuseAnimations,
    imports: [
        FuseAlertComponent,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        RouterLink,
    ],
})
export class AuthResetPasswordComponent implements OnInit {
    @ViewChild('resetPasswordNgForm') resetPasswordNgForm: NgForm;

    alert: { type: FuseAlertType; message: string } = {
        type: 'success',
        message: '',
    };
    resetPasswordForm: UntypedFormGroup;
    showAlert: boolean = false;
token: string;
email: string;

    /**
     * Constructor
     */
    constructor(
         private _authService: AuthService,
    private _formBuilder: UntypedFormBuilder,
    private _route: ActivatedRoute
    ) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
    this.token = this._route.snapshot.queryParamMap.get('token');
    this.email = this._route.snapshot.queryParamMap.get('email');

    this.resetPasswordForm = this._formBuilder.group(
        {
            password: ['', Validators.required],
            passwordConfirm: ['', Validators.required],
        },
        {
            validators: FuseValidators.mustMatch(
                'password',
                'passwordConfirm'
            ),
        }
    );
}


    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Reset password
     */
   resetPassword(): void {
    if (this.resetPasswordForm.invalid) {
        return;
    }

    const password = this.resetPasswordForm.get('password').value;

    this.resetPasswordForm.disable();
    this.showAlert = false;

    this._authService
        .resetPassword({
            token: this.token,
            email: this.email,
            password: password
        })
        .pipe(
            finalize(() => {
                this.resetPasswordForm.enable();
                this.resetPasswordNgForm.resetForm();
                this.showAlert = true;
            })
        )
        .subscribe(
            () => {
                this.alert = {
                    type: 'success',
                    message: 'Tu contraseña ha sido restablecida correctamente.',
                };
            },
            () => {
                this.alert = {
                    type: 'error',
                    message: 'Error al restablecer contraseña.',
                };
            }
        );
}

}
