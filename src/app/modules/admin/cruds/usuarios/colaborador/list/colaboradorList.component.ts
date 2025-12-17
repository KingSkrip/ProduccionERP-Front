import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule, MatOptionModule, MatRippleModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { fuseAnimations } from '@fuse/animations';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { ColaboradorService } from 'app/modules/admin/cruds/usuarios/colaborador/colaborador.service';
import { Observable, Subject, debounceTime, map, takeUntil } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { AddcolaboradorComponent } from 'app/modules/modals/Colaborador/add-colaborador/add-colaborador.component';
import { CatalogosService } from 'app/modules/modals/modals.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmpasswordComponent } from 'app/modules/modals/Colaborador/confirm-password/confirm-password.component';

interface Step {
    id: number;
    label: string;
}

@Component({
    selector: 'colaborador-list',
    templateUrl: './colaboradorlist.component.html',
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
        MatTooltipModule,
    ],
    providers: [
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' }
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations
})
export class ColaboradorListComponent implements OnInit, OnDestroy {
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    usuarios$: Observable<any[]>;
    searchInputControl = new FormControl('');
    isLoading: boolean = false;
    apiBase = APP_CONFIG.apiBase;
    departamentos: any[] = [];
    // Paginación
    currentPage: number = 0;
    itemsPerPage: number = 10;
    totalPages: number = 0;
    totalPagesArray: number[] = [];
    paginatedUsuarios: any[] = [];
    selectedFile: File | null = null;

    // Detalles expandibles
    selectedUsuario: any = null;
    selectedUsuarioForm: UntypedFormGroup;
    selectedPhotoUrl: string = '';
    currentDetailStep: number = 1;
    totalSteps: number = 6;

    showPassword: boolean = false;
    showPasswordConfirmation: boolean = false;
    steps: Step[] = [
        { id: 1, label: 'Personal' },
        { id: 2, label: 'Dirección' },
        { id: 3, label: 'Administrativo' },
        { id: 4, label: 'Fiscal/IMSS' },
        { id: 5, label: 'Nómina' },
        { id: 6, label: 'Credenciales' }
    ];

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _rhService: ColaboradorService,
        private _matDialog: MatDialog,
        private _modals: CatalogosService,
        private _snackBar: MatSnackBar,
    ) { }

    ngOnInit(): void {
        this.initDetailForm();
        this.loadUsuarios();
        this.setupSearch();
        this.loadDepartamentos();

    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    initDetailForm(): void {
        this.selectedUsuarioForm = this._formBuilder.group({
            curp: [''],
            name: [''],
            email: [''],
            telefono: [''],
            usuario: [''],
            departamento_id: [''],
            password: [''],
            password_confirmation: [''],
            direccion: this._formBuilder.group({
                calle: [''],
                no_ext: [''],
                no_int: [''],
                colonia: [''],
                cp: [''],
                municipio: [''],
                estado: [''],
                entidad_federativa: ['']
            }),
            empleo: this._formBuilder.group({
                puesto: [''],
                fecha_inicio: [''],
                fecha_fin: [''],
                comentarios: ['']
            }),
            fiscal: this._formBuilder.group({
                rfc: [''],
                regimen_fiscal: ['']
            }),
            seguridad_social: this._formBuilder.group({
                numero_imss: [''],
                fecha_alta: [''],
                tipo_seguro: ['']
            }),
            nomina: this._formBuilder.group({
                numero_tarjeta: [''],
                banco: [''],
                clabe_interbancaria: [''],
                salario_base: [''],
                frecuencia_pago: ['']
            })
        });
    }

    loadUsuarios(): void {
        this.isLoading = true;
        this._changeDetectorRef.markForCheck();

        this.usuarios$ = this._rhService.usuarios$.pipe(
            map(usuarios => {
                this.isLoading = false;
                this.updatePagination(usuarios);
                this._changeDetectorRef.markForCheck();
                return usuarios;
            })
        );

        this._rhService.getUsuarios().subscribe();
    }

    setupSearch(): void {
        this.searchInputControl.valueChanges
            .pipe(
                debounceTime(300),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(searchTerm => {
                this.filterUsuarios(searchTerm || '');
            });
    }

    filterUsuarios(searchTerm: string): void {
        this.usuarios$ = this._rhService.usuarios$.pipe(
            map(usuarios => {
                // DEBUG: Imprime el primer usuario para ver qué propiedades tiene
                if (usuarios && usuarios.length > 0) {
                    console.log('Primer usuario:', usuarios[0]);
                    console.log('Propiedades disponibles:', Object.keys(usuarios[0]));
                }

                if (!searchTerm.trim()) {
                    this.updatePagination(usuarios);
                    return usuarios;
                }

                const filtered = usuarios.filter(u =>
                    u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.correo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.curp?.toLowerCase().includes(searchTerm.toLowerCase())
                );

                this.updatePagination(filtered);
                return filtered;
            })
        );
    }

    updatePagination(usuarios: any[] | null): void {
        if (!usuarios) {
            this.paginatedUsuarios = [];
            this.totalPages = 0;
            this.totalPagesArray = [];
            return;
        }

        this.totalPages = Math.ceil(usuarios.length / this.itemsPerPage);
        this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i);

        if (this.currentPage >= this.totalPages) {
            this.currentPage = Math.max(0, this.totalPages - 1);
        }

        const start = this.currentPage * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        this.paginatedUsuarios = usuarios.slice(start, end);

        this._changeDetectorRef.markForCheck();
    }


    nextPage(): void {
        if (this.currentPage < this.totalPages - 1) {
            this.currentPage++;
            this.usuarios$.subscribe(usuarios => this.updatePagination(usuarios));
        }
    }

    prevPage(): void {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.usuarios$.subscribe(usuarios => this.updatePagination(usuarios));
        }
    }

    goToPage(page: number): void {
        this.currentPage = page;
        this.usuarios$.subscribe(usuarios => this.updatePagination(usuarios));
    }

    toggleDetails(usuario: any): void {
        if (this.selectedUsuario?.id === usuario.id) {
            this.closeDetails();
            return;
        }

        this.selectedUsuario = usuario;
        this.currentDetailStep = 1;
        this.populateDetailForm(usuario);
        this._changeDetectorRef.markForCheck();
    }


   

    compareDepartamentos(d1: any, d2: any) {
        return d1 && d2 ? d1.id === d2.id : d1 === d2;
    }


    populateDetailForm(usuario: any): void {
        this.selectedPhotoUrl = this.getPhotoUrl(usuario.photo);

        this.selectedUsuarioForm.patchValue({
            curp: usuario.curp || '',
            name: usuario.nombre || usuario.name || '',
            email: usuario.correo || usuario.email || '',
            telefono: usuario.telefono || '',
            usuario: usuario.usuario || '',
            departamento_id: usuario.departamento_id || null, // <-- aquí asignamos el departamento
        });

        if (usuario.direccion) {
            this.selectedUsuarioForm.get('direccion')?.patchValue(usuario.direccion);
        }
        if (usuario.empleos?.[0]) {
            this.selectedUsuarioForm.get('empleo')?.patchValue(usuario.empleos[0]);
        }
        if (usuario.fiscal) {
            this.selectedUsuarioForm.get('fiscal')?.patchValue(usuario.fiscal);
        }
        if (usuario.seguridad_social) {
            this.selectedUsuarioForm.get('seguridad_social')?.patchValue(usuario.seguridad_social);
        }
        if (usuario.nomina) {
            this.selectedUsuarioForm.get('nomina')?.patchValue(usuario.nomina);
        }
    }

    closeDetails(): void {
        this.selectedUsuario = null;
        this.currentDetailStep = 1;
        this.selectedUsuarioForm.get('password')?.setValue('');
        this.selectedUsuarioForm.get('password_confirmation')?.setValue('');
        this.showPassword = false;
        this.showPasswordConfirmation = false;
        this.selectedFile = null;
        this._changeDetectorRef.markForCheck();
    }

    goToDetailStep(step: number): void {
        this.currentDetailStep = step;
        this._changeDetectorRef.markForCheck();
    }

    nextDetailStep(): void {
        if (this.currentDetailStep < this.totalSteps) {
            this.currentDetailStep++;
            this._changeDetectorRef.markForCheck();
        }
    }

    previousDetailStep(): void {
        if (this.currentDetailStep > 1) {
            this.currentDetailStep--;
            this._changeDetectorRef.markForCheck();
        }
    }

    AddModal(): void {
        const dialogRef = this._matDialog.open(AddcolaboradorComponent, {
            width: '800px',
            maxHeight: '90vh',
            disableClose: true
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.loadUsuarios();
            }
        });
    }



    deleteSelectedUsuario(): void {
        if (!this.selectedUsuario) return;

        const confirmation = this._fuseConfirmationService.open({
            title: 'Eliminar colaborador',
            message: `¿Estás seguro de eliminar a ${this.selectedUsuario.name}?`,
            icon: {
                show: true,
                name: 'heroicons_outline:exclamation-triangle',
                color: 'warn',
            },
            actions: {
                confirm: {
                    show: true,
                    label: 'Eliminar',
                    color: 'warn',
                },
                cancel: {
                    show: true,
                    label: 'Cancelar',
                },
            },
        });

        confirmation.afterClosed().subscribe(result => {
            if (result === 'confirmed') {
                this._rhService.deleteUsuario(this.selectedUsuario.id).subscribe({
                    next: () => {
                        this.closeDetails();
                        this.loadUsuarios();

                        this._fuseConfirmationService.open({
                            title: 'Éxito',
                            message: 'Colaborador eliminado correctamente',
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
                    },
                    error: (err) => {
                        console.error('Error al eliminar', err);
                    }
                });
            }
        });
    }

    getPhotoUrl(photo: string): string {
        if (!photo) {
            return 'assets/images/avatars/default-avatar.png';
        }
        const base = this.apiBase.endsWith('/') ? this.apiBase : this.apiBase + '/';
        const cleanPhoto = photo.startsWith('/') ? photo.substring(1) : photo;
        return `${base}${cleanPhoto}?v=${Date.now()}`;
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }


    loadDepartamentos(): void {
        this._modals.getDepartamentos().subscribe(depts => {
            this.departamentos = depts;
            this._changeDetectorRef.markForCheck();
        });
    }


    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    togglePasswordConfirmationVisibility(): void {
        this.showPasswordConfirmation = !this.showPasswordConfirmation;
    }

    passwordsMatch(): boolean {
        const password = this.selectedUsuarioForm.get('password')?.value;
        const confirmation = this.selectedUsuarioForm.get('password_confirmation')?.value;
        return password && password === confirmation;
    }

    passwordsDontMatch(): boolean {
        const password = this.selectedUsuarioForm.get('password')?.value;
        const confirmation = this.selectedUsuarioForm.get('password_confirmation')?.value;
        const touched = this.selectedUsuarioForm.get('password_confirmation')?.touched;
        return confirmation !== '' && password !== confirmation && touched;
    }

    blockPaste(event: ClipboardEvent): void {
        event.preventDefault();
    }


    updateColaborador(): void {
        if (!this.selectedUsuario) return;

        const formValue = this.selectedUsuarioForm.getRawValue();
        const password = formValue.password?.trim();
        const passwordConfirmation = formValue.password_confirmation?.trim();

        // Validar contraseñas si se ingresó alguna
        if (password || passwordConfirmation) {
            if (password !== passwordConfirmation) {
                this._snackBar.open('Las contraseñas no coinciden', 'Cerrar', {
                    duration: 4000,
                    panelClass: ['error-snackbar']
                });
                return;
            }
            if (!password) {
                this._snackBar.open('Debes ingresar una nueva contraseña', 'Cerrar', {
                    duration: 4000,
                    panelClass: ['error-snackbar']
                });
                return;
            }
            if (password.length < 6) {
                this._snackBar.open('La contraseña debe tener al menos 6 caracteres', 'Cerrar', {
                    duration: 4000,
                    panelClass: ['error-snackbar']
                });
                return;
            }

            const dialogRef = this._matDialog.open(ConfirmpasswordComponent, {
                width: '400px',
                disableClose: true
            });

            dialogRef.afterClosed().subscribe(currentPassword => {
                if (!currentPassword) return;

                this.performUpdate({
                    ...formValue,
                    password,
                    current_password: currentPassword
                }, this.selectedFile);
            });

            return;
        }

        // Sin cambio de contraseña
        this.performUpdate(formValue, this.selectedFile);
    }

    private performUpdate(data: any, photoFile?: File): void {
        const formData = new FormData();

        // === DATOS BÁSICOS ===
        formData.append('name', data.name || '');
        formData.append('email', data.email || '');
        formData.append('telefono', data.telefono || '');
        formData.append('curp', data.curp || '');
        formData.append('usuario', data.usuario || '');
        formData.append('departamento_id', data.departamento_id || '');

        // === FOTO ===
        if (photoFile) {
            formData.append('photo', photoFile, photoFile.name);
        }


        // === CONTRASEÑA (solo si se cambió) ===
        if (data.password) {
            formData.append('password', data.password);
            formData.append('current_password', data.current_password);
        }

        // === GRUPOS JSON (con conversión de fechas) ===
        const grupos = ['direccion', 'empleo', 'fiscal', 'seguridad_social', 'nomina'];
        for (const grupo of grupos) {
            const grupoData = data[grupo];
            if (grupoData && Object.values(grupoData).some(v => v !== null && v !== '' && v !== undefined)) {
                const cleanedData: any = {};

                Object.keys(grupoData).forEach(key => {
                    let value = grupoData[key];

                    // DETECTAR Y CONVERTIR FECHAS dd/mm/yyyy → yyyy-mm-dd
                    if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                        const [day, month, year] = value.split('/');
                        value = `${year}-${month}-${day}`; // → 2025-12-18
                    }

                    if (value !== null && value !== '' && value !== undefined) {
                        cleanedData[key] = value;
                    }
                });

                if (Object.keys(cleanedData).length > 0) {
                    formData.append(grupo, JSON.stringify(cleanedData));
                }
            }
        }

        // === ENVÍO CON PUT (ya tienes corregido el servicio) ===
        this._rhService.updateUsuario(this.selectedUsuario.id, formData).subscribe({
            next: (updatedUser) => {
                this._snackBar.open('Colaborador actualizado correctamente', 'Éxito', {
                    duration: 4000,
                    panelClass: ['success-snackbar']
                });

                // Limpiar campos sensibles
                this.selectedUsuarioForm.patchValue({
                    password: '',
                    password_confirmation: ''
                });
                this.selectedFile = null;

                // Actualizar foto en vista previa (updatedUser es el usuario directamente)
                if (updatedUser.photo) {
                    this.selectedPhotoUrl = this.getPhotoUrl(updatedUser.photo);
                }

                this.closeDetails();
                this.loadUsuarios();
            },
            error: (err) => {
                let message = 'Error al actualizar colaborador';
                if (err.status === 403) {
                    message = 'Contraseña actual incorrecta';
                } else if (err.error?.message) {
                    message = err.error.message;
                    if (err.error.errors) {
                        const errors = Object.values(err.error.errors).flat().join(', ');
                        message += `: ${errors}`;
                    }
                }

                this._snackBar.open(message, 'Cerrar', {
                    duration: 6000,
                    panelClass: ['error-snackbar']
                });
            }
        });
    }


    onFileSelected(event: any): void {
        const file = event.target.files[0];
        if (file) {
            this.selectedFile = file;
            const reader = new FileReader();
            reader.onload = () => {
                this.selectedPhotoUrl = reader.result as string; // vista previa
                this._changeDetectorRef.markForCheck();
            };
            reader.readAsDataURL(file);
        }
    }





    onStatusChange(usuario: any, isActive: boolean) {
    const status_id = isActive ? 1 : 2; // 1 = Activo, 2 = Inactivo
    this._rhService.updateUsuarioStatus(usuario.id, status_id).subscribe({
        next: (res) => {
            usuario.status_id = status_id; // actualiza localmente la tabla
            this._snackBar.open('Estado actualizado', 'Cerrar', {
                duration: 2000,
                panelClass: ['success-snackbar'],
                horizontalPosition: 'end', // derecha
                verticalPosition: 'top',   // arriba
            });
        },
        error: (err) => {
            this._snackBar.open('Error al actualizar estado', 'Cerrar', {
                duration: 2000,
                panelClass: ['error-snackbar'],
                horizontalPosition: 'end', // derecha
                verticalPosition: 'top',   // arriba
            });
        }
    });
}


}