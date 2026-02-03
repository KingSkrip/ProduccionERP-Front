import { CommonModule, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_LOCALE, MatNativeDateModule, MatOptionModule, MatRippleModule, provideNativeDateAdapter } from '@angular/material/core';
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
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { CatalogosService } from '../modals.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';


import { registerLocaleData } from '@angular/common';
import localeEsMX from '@angular/common/locales/es-MX';
import { UserService } from 'app/core/user/user.service';
registerLocaleData(localeEsMX, 'es-MX');
@Component({
    selector: 'solicitudes-vacaciones',
    templateUrl: './solicitudes-vacaciones.component.html',
    styleUrls: ['./solicitudes-vacaciones.component.scss'],
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
export class SolicitudesVacacionesComponent implements OnInit, OnDestroy {

    currentStep: number = 1;
    totalSteps: number = 3;
    isLoading: boolean = false;

    private _user = new BehaviorSubject<any>(null);
    user$ = this._user.asObservable();

    vacationForm: UntypedFormGroup;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    // Datos del usuario
    userId: number = 1; // TODO: Obtener del servicio de autenticación
    // vacacionesData = {
    //     diasTotales: 12,
    //     diasDisfrutados: 0,
    //     diasDisponibles: 12,
    //     anio: new Date().getFullYear()
    // };

    // Cálculos
    diasSolicitados: number = 0;
    fechaInicio: Date | null = null;
    fechaFin: Date | null = null;
    minDate: Date = new Date();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _rhService: ColaboradorService,
        private _dialogRef: MatDialogRef<SolicitudesVacacionesComponent>,
        private catalogosService: CatalogosService,
        private _userService: UserService,
        private _cdr: ChangeDetectorRef,
    ) { }

    ngOnInit(): void {
        this.initForm();
        // this.loadVacacionesData();
        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user) => {
                if (user) {
                    this._user.next(user);

                    // this._prepareChartData();
                    this._cdr.markForCheck();
                }
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    initForm(): void {
        this.vacationForm = this._formBuilder.group({
            fecha_inicio: [null, Validators.required],
            fecha_fin: [null, Validators.required],
            comentarios: ['', [Validators.maxLength(500)]],
            confirmar: [false, Validators.requiredTrue]
        });

        // Escuchar cambios en las fechas
        this.vacationForm.get('fecha_inicio').valueChanges.subscribe((fecha: string) => {
            this.fechaInicio = this.parseDateString(fecha);
            this.calcularDias();
            this._changeDetectorRef.markForCheck();
        });

        this.vacationForm.get('fecha_fin').valueChanges.subscribe((fecha: string) => {
            this.fechaFin = this.parseDateString(fecha);
            this.calcularDias();
            this._changeDetectorRef.markForCheck();
        });

    }
    private parseDateString(dateStr: string): Date | null {
        if (!dateStr) return null;
        // Forzar hora mediodía para neutralizar el offset de zona horaria
        return new Date(dateStr + 'T12:00:00');
    }

    // loadVacacionesData(): void {
    //     // TODO: Llamar al servicio real
    //     // Simulación de datos del usuario actual
    //     this.isLoading = true;

    //     // Simular llamada al backend
    //     setTimeout(() => {
    //         this.vacacionesData = {
    //             diasTotales: 12,
    //             diasDisfrutados: 8, // De acuerdo a tu BD
    //             diasDisponibles: 4,
    //             anio: 2025
    //         };
    //         this.isLoading = false;
    //         this._changeDetectorRef.markForCheck();
    //     }, 500);
    // }

    calcularDias(): void {
        if (this.fechaInicio && this.fechaFin) {
            if (this.fechaFin < this.fechaInicio) {
                this.diasSolicitados = 0;
                return;
            }

            // Calcular días hábiles (excluyendo fines de semana)
            let dias = 0;
            let currentDate = new Date(this.fechaInicio);
            const endDate = new Date(this.fechaFin);

            while (currentDate <= endDate) {
                const dayOfWeek = currentDate.getDay();
                // 0 = Domingo, 6 = Sábado
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    dias++;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            this.diasSolicitados = dias;
        } else {
            this.diasSolicitados = 0;
        }
    }

    nextStep(): void {
        if (this.currentStep === 1) {
            // Validar paso 1
            // if (!this.vacationForm.get('fecha_inicio').valid || 
            //     !this.vacationForm.get('fecha_fin').valid) {
            //     this._fuseConfirmationService.open({
            //         title: 'Campos requeridos',
            //         message: 'Por favor selecciona las fechas de inicio y fin.',
            //         icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
            //         actions: { confirm: { label: 'Entendido', color: 'primary' }, cancel: { show: false } }
            //     });
            //     return;
            // }

            if (this.diasSolicitados === 0) {
                this._fuseConfirmationService.open({
                    title: 'Fechas inválidas',
                    message: 'La fecha de fin debe ser posterior a la fecha de inicio y deben ser días hábiles.',
                    icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
                    actions: { confirm: { label: 'Entendido', color: 'primary' }, cancel: { show: false } }
                });
                return;
            }
        }

        if (this.currentStep === 2) {
            // Validar disponibilidad
            if (this.diasSolicitados > this.vacacionesActuales.dias_disponibles) {
                this._fuseConfirmationService.open({
                    title: 'Días insuficientes',
                    message: `Solo tienes ${this.vacacionesActuales.dias_disponibles} días disponibles.`,
                    icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
                    actions: { confirm: { label: 'Entendido', color: 'primary' }, cancel: { show: false } }
                });
                return;
            }

        }

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

    submitForm(): void {
        // if (!this.vacationForm.valid) {
        //     this._fuseConfirmationService.open({
        //         title: 'Formulario incompleto',
        //         message: 'Por favor completa todos los campos requeridos.',
        //         icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
        //         actions: { confirm: { label: 'Entendido', color: 'primary' }, cancel: { show: false } }
        //     });
        //     return;
        // }

        this.isLoading = true;

        const solicitud = {
            solicitante_id: this.userId,
            status_id: 5,
            titulo: 'Solicitud de Vacaciones',
            descripcion: `Solicitud de ${this.diasSolicitados} días de vacaciones`,
            comentarios_solicitante: this.vacationForm.get('comentarios').value,
            fecha_inicio: formatDate(this.fechaInicio, 'yyyy-MM-dd', 'es-MX'),
            fecha_fin: formatDate(this.fechaFin, 'yyyy-MM-dd', 'es-MX'),
            dias: this.diasSolicitados
        };

        this.catalogosService.storeVacacionesColaborador(solicitud)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    this.isLoading = false;
                    this._fuseConfirmationService.open({
                        title: '¡Solicitud enviada!',
                        message: 'Tu solicitud de vacaciones ha sido registrada correctamente y está pendiente de aprobación.',
                        icon: { show: true, name: 'heroicons_outline:check-circle', color: 'success' },
                        actions: { confirm: { label: 'Aceptar', color: 'primary' }, cancel: { show: false } }
                    }).afterClosed().subscribe(() => {
                        this._dialogRef.close(res);
                    });
                },
                error: (err) => {
                    const mensajeError = err?.error?.error || 'No se pudo registrar la solicitud. Intenta nuevamente más tarde.';
                    const dialogRef = this._fuseConfirmationService.open({
                        title: 'Error',
                        message: mensajeError,
                        icon: { show: true, name: 'heroicons_outline:x-circle', color: 'warn' },
                        actions: { confirm: { label: 'Aceptar', color: 'primary' }, cancel: { show: false } }
                    });

                    // Después de cerrar el modal, resetear isLoading
                    dialogRef.afterClosed().subscribe(() => {
                        this.isLoading = false;
                        this._changeDetectorRef.markForCheck();
                    });

                    console.error(err);
                }

            });
    }

    closeModal(): void {
        this._dialogRef.close();
    }

    get progressPercentage(): number {
        return (this.currentStep / this.totalSteps) * 100;
    }




    get vacacionesTotales(): number {
        return this._user.value?.vacaciones?.[0]?.dias_totales ?? 0;
    }

    get vacacionesDisponibles(): number {
        const user = this._user.value;
        return user?.vacaciones?.[0]?.dias_disponibles ?? 0;
    }

    get vacacionesDisfrutadas(): number {
        const user = this._user.value;
        return user?.vacaciones?.[0]?.dias_disfrutados ?? 0;
    }

    get vacacionesActuales() {
        return this._user.value?.vacaciones?.[0] ?? {
            dias_totales: 0,
            dias_disfrutados: 0,
            dias_disponibles: 0,
            anio: new Date().getFullYear()
        };
    }

}