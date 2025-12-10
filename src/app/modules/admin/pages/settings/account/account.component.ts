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
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'settings-account',
    templateUrl: './account.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
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
    mensajeExito: string | null = null;
    mensajeError: string | null = null;

    constructor(
        private _formBuilder: UntypedFormBuilder,
        private _settings: SettingsService,
        private _cdr: ChangeDetectorRef,
        private _snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        this.accountForm = this._formBuilder.group({
            // Datos del usuario
            name: ['', [Validators.required, Validators.pattern(/^[A-Za-zÑñ\s]+$/), Validators.maxLength(50)]],
            username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.-]+$/), Validators.maxLength(20)]],
            email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]],
            phone: ['', [Validators.required, Validators.pattern(/^[0-9]+$/), Validators.minLength(7), Validators.maxLength(15)]],
            // departamento: ['', Validators.required],

            // Dirección (todos requeridos)
            calle: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9Ññ\s#.-]+$/), Validators.maxLength(100)]],
            no_ext: ['', [Validators.pattern(/^[A-Za-z0-9-]+$/), Validators.maxLength(10)]],
            no_int: ['', [Validators.pattern(/^[A-Za-z0-9-]*$/),]],
            colonia: ['', [Validators.required, Validators.pattern(/^[A-Za-zÑñ\s]+$/), Validators.maxLength(50)]],
            cp: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/),]],
            municipio: ['', [Validators.required, Validators.pattern(/^[A-Za-zÑñ\s]+$/), Validators.maxLength(50)]],
            estado: ['', [Validators.required, Validators.pattern(/^[A-Za-zÑñ\s]+$/), Validators.maxLength(50)]],
            entidad_federativa: ['', [Validators.required, Validators.pattern(/^[A-Za-zÑñ\s]+$/), Validators.maxLength(50)]],
            // pais: ['',[Validators.required,Validators.pattern(/^[A-Za-zÑñ\s]+$/),Validators.maxLength(50)]],
        });


        this._settings.getPerfil().subscribe({
            next: (resp) => {
                const user = resp.data ?? resp.user ?? resp;

                this.accountForm.patchValue({
                    name: user.nombre,
                    username: user.usuario,
                    email: user.correo,
                    phone: user.telefono,
                });

                if (user.direccion) {
                    this.accountForm.patchValue({
                        calle: user.direccion.calle ?? '',
                        no_ext: user.direccion.no_ext ?? '',
                        no_int: user.direccion.no_int ?? '',
                        colonia: user.direccion.colonia ?? '',
                        cp: user.direccion.cp ?? '',
                        municipio: user.direccion.municipio ?? '',
                        estado: user.direccion.estado ?? '',
                        entidad_federativa: user.direccion.entidad_federativa ?? ''
                    });
                }


                this.preview = user.photo ? `${APP_CONFIG.apiBase}/${user.photo}` : 'images/avatars/user.jpg';
                this.isLoadingForm = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.isLoadingForm = false;
                this.mensajeError = 'No se pudo cargar la información del perfil.';
                this._cdr.markForCheck();
            }
        });
    }

    guardarPerfil(): void {
        const form = this.accountForm.value;

        const payload = new FormData();

        // Agregar automáticamente TODOS los campos del formulario
        Object.keys(form).forEach(key => {
            payload.append(key, form[key] ?? '');
        });

        // Agregar foto
        if (this.selectedFile) {
            payload.append('photo', this.selectedFile);
        }

        this.isLoadingForm = true;
        this.mensajeExito = null;
        this.mensajeError = null;

        this._settings.updatePerfil(payload).subscribe({
            next: (resp) => {
                this.isLoadingForm = false;

                if (resp.success) {
                    this.mensajeExito = resp.message;

                    if (resp.user && resp.user.photo) {
                        this.preview = `${APP_CONFIG.apiBase}/${resp.user.photo}`;
                    }

                    this._snackBar.open(resp.message || 'Perfil actualizado correctamente', 'Cerrar', {
                        duration: 3000,
                        horizontalPosition: 'right',
                        verticalPosition: 'top',
                        panelClass: ['snackbar-success']
                    });
                } else {
                    this.mensajeError = resp.message ?? 'Ocurrió un error al actualizar el perfil.';
                    this._snackBar.open(this.mensajeError, 'Cerrar', {
                        duration: 3000,
                        horizontalPosition: 'right',
                        verticalPosition: 'top',
                        panelClass: ['snackbar-error']
                    });
                }

                this._cdr.markForCheck();
            },

            error: (err) => {
                this.isLoadingForm = false;
                this.mensajeError = err.error?.message ?? 'Ocurrió un error al actualizar el perfil.';

                this._snackBar.open(this.mensajeError, 'Cerrar', {
                    duration: 3000,
                    horizontalPosition: 'right',
                    verticalPosition: 'top',
                    panelClass: ['snackbar-error']
                });

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
                this.mensajeError = 'Error al cargar la imagen.';
                this._cdr.markForCheck();
            };
            reader.readAsDataURL(file);
        }
    }

    get formChanged(): boolean {
        // true si el formulario ha cambiado o si se seleccionó un archivo
        return this.accountForm.dirty || !!this.selectedFile;
    }
}
