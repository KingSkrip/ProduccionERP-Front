import { TextFieldModule } from '@angular/cdk/text-field';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
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
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SettingsService } from '../settings.service';

import { CommonModule } from '@angular/common';
import { APP_CONFIG } from 'app/core/config/app-config';

@Component({
    selector: 'settings-account',
    templateUrl: './account.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule, // <-- Agregado
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        TextFieldModule,
        MatSelectModule,
        MatOptionModule,
        MatButtonModule,
        MatProgressSpinnerModule,
    ],
})

export class SettingsAccountComponent implements OnInit {
    accountForm: UntypedFormGroup;
    preview: string | ArrayBuffer | null = null;
    selectedFile: File | null = null;
    isLoadingImage: boolean = false;
    isLoadingForm = true;

    /**
     * Constructor
     */
    constructor(
        private _formBuilder: UntypedFormBuilder,
        private _settings: SettingsService,
        private _cdr: ChangeDetectorRef,
    ) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Crear formulario con valores vacíos iniciales
        this.accountForm = this._formBuilder.group({
            name: [''],
            username: [''],
            departamento: [''],
            email: ['', Validators.email],
            country: ['mexico'],
            language: ['spanish'],
        });

        this._settings.getPerfil().subscribe({
            next: (resp) => {
                const user = resp.data ?? resp.user ?? resp;

                this.accountForm.patchValue({
                    name: user.NOMBRE,
                    username: user.USUARIO,
                    email: user.CORREO,
                    departamento: user.DEPARTAMENTO ?? '',
                });

                // Concatenar URL de la foto siempre
                this.preview = user.PHOTO ? `${APP_CONFIG.apiBase}/${user.PHOTO}` : 'images/avatars/user.jpg';

                this.isLoadingForm = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.isLoadingForm = false;
            }
        });

    }

    guardarPerfil(): void {
        const form = this.accountForm.value;

        const payload = new FormData();
        payload.append('NOMBRE', form.name || '');
        payload.append('CORREO', form.email || '');
        payload.append('USUARIO', form.username || '');
        payload.append('DEPARTAMENTO', form.departamento || '');

        if (this.selectedFile) {
            payload.append('FOTO', this.selectedFile);
        }

        this._settings.updatePerfil(payload).subscribe({
            next: (resp) => {

                if (resp.user?.PHOTO) {
                    this.preview = `${APP_CONFIG.apiBase}/${resp.user.PHOTO}`;
                }


                this._cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error al actualizar perfil:', err);
                this._cdr.markForCheck();
            }
        });
    }

    onFileSelected(event: any): void {
        const file = event.target.files[0];
        if (file) {
            this.isLoadingImage = true;
            this.selectedFile = file;
            this._cdr.markForCheck();

            const reader = new FileReader();
            reader.onload = () => {
                this.preview = reader.result;
                this.isLoadingImage = false;
                this._cdr.markForCheck();
            };
            reader.onerror = () => {
                this.isLoadingImage = false;
                this._cdr.markForCheck();
            };
            reader.readAsDataURL(file);
        }
    }
}