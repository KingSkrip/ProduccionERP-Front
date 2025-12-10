import { CommonModule, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule, MatOptionModule, MatRippleModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { fuseAnimations } from '@fuse/animations';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { ColaboradorService } from 'app/modules/admin/cruds/usuarios/colaborador/colaborador.service';
import { CustomValidators } from 'app/shared/validators/custom-validators';
import { Subject, takeUntil } from 'rxjs';
import { CatalogosService } from '../../modals.service';


import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

interface Step {
    id: number;
    label: string;
    fields: string[];
}

@Component({
    selector: 'add-colaborador',
    templateUrl: './add-colaborador.component.html',
    styleUrls: ['./add-colaborador.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatProgressBarModule,
        MatIconModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatSortModule,
        MatPaginatorModule,
        MatSlideToggleModule,
        MatSelectModule,
        MatOptionModule,
        MatCheckboxModule,
        MatRippleModule,
        MatNativeDateModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,

    ],
    providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' }
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations
})


export class AddcolaboradorComponent implements OnInit, OnDestroy {
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    @Output() onCreated = new EventEmitter<void>();

    readonly startDate = new Date(1990, 0, 1);

    newUsuarioForm: UntypedFormGroup;
    isLoading: boolean = false;
    newPhotoUrl: string = '';
    fecha_alta_formateada: string = '';
    showPassword: boolean = false;
    showPasswordConfirmation: boolean = false;
    passwordStrength: number = 0;
    passwordStrengthLabel: string = '';
    passwordStrengthColor: string = '';
    selectedPhotoFile: File | null = null;

    // Multi-step
    currentStep: number = 1;
    totalSteps: number = 6;
    steps: Step[] = [
        { id: 1, label: 'Personal', fields: ['name', 'email', 'telefono', 'curp'] },
        { id: 2, label: 'Dirección', fields: ['direccion'] },
        { id: 3, label: 'Administrativo', fields: ['departamento_id', 'empleo'] },
        { id: 4, label: 'Fiscal/IMSS', fields: ['fiscal', 'seguridad_social'] },
        { id: 5, label: 'Nómina', fields: ['nomina'] },
        { id: 6, label: 'Credenciales', fields: ['usuario', 'password', 'password_confirmation'] }
    ];

    departamentos: any[] = [];



    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _rhService: ColaboradorService,
        private _dialogRef: MatDialogRef<AddcolaboradorComponent>,
        private catalogosService: CatalogosService
    ) { }

    ngOnInit(): void {
        this.initForm();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    initForm(): void {
        this.newUsuarioForm = this._formBuilder.group({
            // Datos personales
            name: ['', [Validators.required, CustomValidators.nombreCapitalizado()]],
            email: ['', [Validators.required, CustomValidators.emailClean()]],
            telefono: ['', [Validators.required, CustomValidators.telefono()]],
            curp: ['', [Validators.required, CustomValidators.curpSimple()]],

            // Dirección
            direccion: this._formBuilder.group({
                calle: ['', [Validators.required, CustomValidators.soloTextoCapitalizado()]],
                no_ext: ['', [CustomValidators.limpiarBasico()]],
                no_int: ['', [CustomValidators.limpiarBasico()]],
                colonia: ['', [Validators.required, CustomValidators.soloTextoCapitalizado()]],
                cp: ['', [Validators.required, CustomValidators.cp()]],
                municipio: ['', [Validators.required, CustomValidators.soloTextoCapitalizado()]],
                estado: ['', [Validators.required, CustomValidators.soloTextoCapitalizado()]],
                entidad_federativa: ['', [CustomValidators.soloTextoCapitalizado()]]
            }),

            // Administrativo
            departamento_id: [null],
            empleo: this._formBuilder.group({
                puesto: ['', [Validators.required, CustomValidators.puestoSimple()]],
                fecha_inicio: [null, [Validators.required,CustomValidators.fechaDDMMYYYY()]],
                fecha_fin: [null, [CustomValidators.fechaDDMMYYYY()]],
                comentarios: ['', [CustomValidators.comentarioSimple()]]
            }),

            // Fiscal
            fiscal: this._formBuilder.group({
                rfc: ['', [Validators.required, CustomValidators.rfcSimple()]],
                regimen_fiscal: ['', [Validators.required, CustomValidators.regimenFiscalSimple()]]
            }),


            // Seguridad Social
            seguridad_social: this._formBuilder.group({
                numero_imss: ['', [Validators.required, CustomValidators.noIMSS()]], // si quieres otro validador me dices
                fecha_alta: [null, [Validators.required,CustomValidators.fechaDDMMYYYY()]],
                tipo_seguro: ['', [Validators.required, CustomValidators.soloTextoCapitalizado()]]
            }),

            // Nómina
            nomina: this._formBuilder.group({
                numero_tarjeta: ['', [Validators.required, CustomValidators.numeroTarjeta()]],
                banco: ['', [Validators.required, CustomValidators.bancoSimple()]],
                clabe_interbancaria: ['', [Validators.required, CustomValidators.clabe()]],
                salario_base: ['', [Validators.required, CustomValidators.salario()]],
                frecuencia_pago: ['', [Validators.required]]
            }),

            // Credenciales
            usuario: ['', [Validators.required, CustomValidators.usuarioSimple()]],
            password: ['', [Validators.required, CustomValidators.passwordFuerte()]],
            password_confirmation: ['', [Validators.required]],
        });

        this.newUsuarioForm.get('password')?.valueChanges.subscribe((value) => {
            this.checkPasswordStrength(value);
        });
    }


    ngAfterViewInit(): void {
        // ✔ se ejecuta cuando la vista YA está lista
        setTimeout(() => {
            this.loadDepartamentos();
            this._changeDetectorRef.markForCheck();
        });
    }


    loadDepartamentos(): void {
        this.catalogosService.getDepartamentos().subscribe({
            next: (data) => this.departamentos = data,
            error: (err) => console.error(err)
        });
    }

    closeModal(): void {
        this.newUsuarioForm.reset();
        this.currentStep = 1;
        this.newPhotoUrl;
        this.selectedPhotoFile = null;
        this._dialogRef.close(false);
    }

    nextStep(): void {
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this._changeDetectorRef.markForCheck();
        }
    }

    previousStep(): void {
        if (this.currentStep > 1) {
            this.currentStep--;
            this._changeDetectorRef.markForCheck();
        }
    }

    onPhotoSelected(event: any): void {
        const file = event.target.files[0];
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
            this._fuseConfirmationService.open({
                title: 'Error',
                message: 'Las contraseñas no coinciden',
                icon: {
                    show: true,
                    name: 'heroicons_outline:exclamation-triangle',
                    color: 'warn',
                },
                actions: {
                    confirm: { show: true, label: 'Aceptar', color: 'warn' },
                    cancel: { show: false },
                },
            });
            return;
        }

        this.createUsuario();
    }

    createUsuario(): void {
        if (this.isLoading) return;

        this.isLoading = true;
        this._changeDetectorRef.markForCheck();

        const formData = new FormData();
        const formValue = this.newUsuarioForm.value;

        // Datos personales
        formData.append('name', formValue.name);
        formData.append('email', formValue.email);
        formData.append('usuario', formValue.usuario);
        formData.append('password', formValue.password);

        if (formValue.telefono) formData.append('telefono', formValue.telefono);
        if (formValue.curp) formData.append('curp', formValue.curp);
        if (formValue.departamento_id) formData.append('departamento_id', formValue.departamento_id);

        // Foto
        if (this.selectedPhotoFile) {
            formData.append('photo', this.selectedPhotoFile, this.selectedPhotoFile.name);
        }

        // JSON anidados
        const groups = ['direccion', 'empleo', 'fiscal', 'seguridad_social', 'nomina'];
        for (const g of groups) {
            const groupValue = formValue[g];
            if (groupValue && Object.values(groupValue).some(v => v !== null && v !== '')) {
                formData.append(g, JSON.stringify(groupValue));
            }
        }

        this._rhService.createUsuario(formData)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (newUser) => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();

                    this._rhService.getUsuarios().subscribe();

                    this._fuseConfirmationService.open({
                        title: 'Éxito',
                        message: 'Colaborador creado correctamente',
                        icon: {
                            show: true,
                            name: 'heroicons_outline:check-circle',
                            color: 'success',
                        },
                        actions: {
                            confirm: { show: true, label: 'Aceptar', color: 'primary' },
                            cancel: { show: false },
                        },
                    });

                    this._dialogRef.close(newUser);
                },

                error: (err) => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();

                    console.error('Error al crear', err);
                    let errorMessage = err.error?.message || 'Ocurrió un error al crear el colaborador';

                    if (err.error?.errors) {
                        const errorList = Object.values(err.error.errors).flat().join('\n• ');
                        errorMessage = `${err.error.message}\n\n• ${errorList}`;
                    }

                    this._fuseConfirmationService.open({
                        title: 'Error',
                        message: errorMessage,
                        icon: {
                            show: true,
                            name: 'heroicons_outline:exclamation-triangle',
                            color: 'warn',
                        },
                        actions: {
                            confirm: { show: true, label: 'Aceptar', color: 'warn' },
                            cancel: { show: false },
                        },
                    });
                }
            });
    }


    showValidationErrors(): void {
        const errors: string[] = [];
        Object.keys(this.newUsuarioForm.controls).forEach(key => {
            const control = this.newUsuarioForm.get(key);
            if (control?.invalid) {
                if (control.errors?.['required']) {
                    errors.push(`El campo ${key} es obligatorio`);
                }
                if (control.errors?.['email']) {
                    errors.push(`El campo ${key} debe ser un correo válido`);
                }
                if (control.errors?.['minlength']) {
                    errors.push(`El campo ${key} debe tener al menos ${control.errors['minlength'].requiredLength} caracteres`);
                }
            }
        });

        if (errors.length > 0) {
            this._fuseConfirmationService.open({
                title: 'Formulario incompleto',
                message: errors.join('\n• '),
                icon: {
                    show: true,
                    name: 'heroicons_outline:exclamation-triangle',
                    color: 'warn',
                },
                actions: {
                    confirm: { show: true, label: 'Aceptar', color: 'warn' },
                    cancel: { show: false },
                },
            });
        }
    }

    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    togglePasswordConfirmationVisibility(): void {
        this.showPasswordConfirmation = !this.showPasswordConfirmation;
    }

    checkPasswordStrength(password: string): void {
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



}