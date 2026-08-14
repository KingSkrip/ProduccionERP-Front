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
import { Observable, Subject, debounceTime, distinctUntilChanged, forkJoin, map, takeUntil } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { AddcolaboradorComponent } from 'app/modules/modals/Colaborador/add-colaborador/add-colaborador.component';
import { CatalogosService } from 'app/modules/modals/modals.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmpasswordComponent } from 'app/modules/modals/Colaborador/confirm-password/confirm-password.component';
import { FuseLoadingService } from '@fuse/services/loading';

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
    apiBase = APP_CONFIG.apiBase;

    // Catálogos usados por el form de detalle (coinciden con lo que valida ColaboradorController@update)
    permissions: any[] = [];
    sub_permissions: any[] = [];
    puestos: any[] = [];
    areas: any[] = [];
    turnos: any[] = [];
    // Para jefe_id / jefe_aux_id se eligen entre los mismos colaboradores (users_firebird_identities)
    posiblesJefes: any[] = [];

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
    totalSteps: number = 5;

    showPassword: boolean = false;
    showPasswordConfirmation: boolean = false;

    // Pasos alineados a los grupos que el backend realmente procesa en update():
    // name/email/usuario/photo | role_id/subrol_id | puesto_id/area_id/jefe_id/jefe_aux_id | turno_id | password
    steps: Step[] = [
        { id: 1, label: 'Personal' },
        { id: 2, label: 'Rol' },
        { id: 3, label: 'Puesto' },
        { id: 4, label: 'Turno' },
        { id: 5, label: 'Credenciales' }
    ];

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _rhService: ColaboradorService,
        private _matDialog: MatDialog,
        private _modals: CatalogosService,
        private _snackBar: MatSnackBar,
        private _fuseLoadingService: FuseLoadingService,
    ) { }

    ngOnInit(): void {
        this.initDetailForm();
        this.loadUsuarios();
        this.setupSearch();
        this.loadCatalogos();
        this.loadPosiblesJefes();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    initDetailForm(): void {
        // Solo campos que ColaboradorController@update valida y procesa.
        // Se quitaron: curp, telefono, departamento_id, direccion, empleo, fiscal,
        // seguridad_social, nomina — el backend no los reconoce, se perdían silenciosamente.
        this.selectedUsuarioForm = this._formBuilder.group({
            // Personal (Firebird USUARIOS)
            name: [''],
            email: [''],
            usuario: [''],

            // Rol / subrol (model_has_roles)
            permission_id: [''],
            sub_permission_id: [''],

            // Puesto (user_puestos)
            puesto_id: [''],
            area_id: [''],
            jefe_id: [''],
            jefe_aux_id: [''],

            // Turno (user_turnos)
            turno_id: [''],

            // Credenciales
            password: [''],
            password_confirmation: ['']
        });
    }

    loadUsuarios(): void {
        this._fuseLoadingService.show();
        this.usuarios$ = this._rhService.usuarios$.pipe(
            map(usuarios => {
                this.updatePagination(usuarios);
                this._fuseLoadingService.hide();
                this._changeDetectorRef.markForCheck();
                return usuarios;
            })
        );

        this._rhService.getUsuarios().subscribe({
            error: () => {
                this._fuseLoadingService.hide();
            }
        });
    }

    setupSearch(): void {
        this.searchInputControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(searchTerm => {
                this.currentPage = 0; // 👈 reinicia la página al buscar
                this.filterUsuarios((searchTerm || '').trim());
            });
    }

    filterUsuarios(searchTerm: string): void {
        this.usuarios$ = this._rhService.usuarios$.pipe(
            map(usuarios => {
                const lista = usuarios || [];

                if (!searchTerm) {
                    this.updatePagination(lista);
                    return lista;
                }

                const term = searchTerm.toLowerCase();
                const filtered = lista.filter(u =>
                    u.nombre?.toLowerCase().includes(term) ||
                    u.name?.toLowerCase().includes(term) ||
                    u.correo?.toLowerCase().includes(term) ||
                    u.email?.toLowerCase().includes(term) ||
                    u.usuario?.toLowerCase().includes(term)
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

    /**
     * Ventana deslizante de números de página. Arranca en la página actual
     * (si estás en la 8, el primer número que ves es el 8) y no se mete al
     * bloque de las últimas `tailCount` páginas para no traslaparse con ellas.
     * `null` en el arreglo representa el separador "…".
     */
    private buildVisiblePages(windowSize: number, tailCount: number): (number | null)[] {
        const total = this.totalPages;

        // Si caben todas sin necesidad de recortar, se muestran todas.
        if (total <= windowSize + tailCount) {
            return this.totalPagesArray;
        }

        // Último arranque posible para que la ventana no choque con el bloque final.
        const maxStart = total - tailCount - windowSize;
        const start = Math.min(Math.max(this.currentPage, 0), maxStart);

        const windowPages = Array.from({ length: windowSize }, (_, i) => start + i);
        const lastPages = Array.from({ length: tailCount }, (_, i) => total - tailCount + i);

        // Si la ventana ya llega hasta pegarse con el bloque final, no hace falta el "…".
        const needsEllipsis = windowPages[windowPages.length - 1] < lastPages[0] - 1;

        return needsEllipsis ? [...windowPages, null, ...lastPages] : [...windowPages, ...lastPages];
    }

    // Escritorio: 7 números + … + últimos 3
    get visiblePages(): (number | null)[] {
        return this.buildVisiblePages(7, 3);
    }

    // Mobile: 3 números + … + últimos 3
    get visiblePagesMobile(): (number | null)[] {
        return this.buildVisiblePages(3, 3);
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

    compareById(a: any, b: any): boolean {
        if (a === b) return true;
        const aId = (a && typeof a === 'object') ? a.id : a;
        const bId = (b && typeof b === 'object') ? b.id : b;
        return aId != null && bId != null && String(aId) === String(bId);
    }

    populateDetailForm(usuario: any): void {
        this.selectedPhotoUrl = this.getPhotoUrl(usuario.photo);

        // TODO: confirmar la forma exacta que regresa UsuarioResource para
        // 'roles' (rol/subrol activos) y 'user_puesto' (puesto/area/jefe/jefe_aux/turno).
        // Aquí asumo la estructura más probable según overlayFirebirdData() del controller:
        // usuario.roles = [{ role_id, subrol_id, role: {...}, subrol: {...} }, ...]
        // usuario.user_puesto = { puesto_id, area_id, jefe_id, jefe_aux_id, ... }
        // usuario.turno = { turno_id, ... } (o dentro de user_puesto/otra relación)

        const permissionActivo = usuario.permissions?.[0] ?? '';
        const subPermissionActivo = usuario.sub_permissions?.[0] ?? '';

        const puestoActivo = usuario.USER_PUESTO ?? usuario.user_puesto ?? null;

        this.selectedUsuarioForm.patchValue({
            name: usuario.name || usuario.nombre || '',
            email: usuario.email || usuario.correo || '',
            usuario: usuario.usuario || '',

            // Permiso / Subpermiso
            permission_id: permissionActivo,
            sub_permission_id: subPermissionActivo,

            // Puesto
            puesto_id: puestoActivo?.puesto_id || '',
            area_id: puestoActivo?.area_id || '',
            jefe_id: puestoActivo?.jefe_id || '',
            jefe_aux_id: puestoActivo?.jefe_aux_id || '',

            // Turno
            turno_id: usuario.TURNO_ASIGNADO?.turno_id ||
                usuario.turno?.turno_id ||
                usuario.turno_id ||
                '',
        });
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

    /**
     * Carga los catálogos que usa el form de detalle: roles, subroles, puestos, áreas y turnos.
     * TODO: confirmar los nombres reales de estos métodos en CatalogosService — asumí nombres
     * simétricos a getDepartamentos() que ya usabas.
     */
    loadCatalogos(): void {
        forkJoin({
            permisos: this._rhService.getPermisosCatalogo(),
            puestos: this._rhService.getPuestosActivos(),
            areas: this._rhService.getAreasActivas(),
            turnos: this._rhService.getTurnosActivos(),
        }).subscribe({
            next: ({ permisos, puestos, areas, turnos }) => {
                this.permissions = permisos.permissions || [];
                this.sub_permissions = permisos.sub_permissions || [];

                this.puestos = puestos || [];
                this.areas = areas || [];
                this.turnos = turnos || [];

                this._changeDetectorRef.markForCheck();
            },
            error: (err) => {
                console.error('Error al cargar catálogos', err);
            }
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

        // === PERSONAL (Firebird USUARIOS) ===
        formData.append('name', data.name || '');
        formData.append('email', data.email || '');
        formData.append('usuario', data.usuario || '');

        // === FOTO ===
        if (photoFile) {
            formData.append('photo', photoFile, photoFile.name);
        }

        // === CONTRASEÑA (solo si se cambió) ===
        if (data.password) {
            formData.append('password', data.password);
            formData.append('current_password', data.current_password);
        }

        // === PERMISO / SUBPERMISO ===
        if (data.permission_id) {
            formData.append('permission_id', data.permission_id);
        }

        if (data.sub_permission_id) {
            formData.append('sub_permission_id', data.sub_permission_id);
        }

        // === PUESTO ===
        if (data.puesto_id) {
            formData.append('puesto_id', data.puesto_id);
        }
        if (data.area_id) {
            formData.append('area_id', data.area_id);
        }
        if (data.jefe_id) {
            formData.append('jefe_id', data.jefe_id);
        }
        if (data.jefe_aux_id) {
            formData.append('jefe_aux_id', data.jefe_aux_id);
        }

        // === TURNO ===
        if (data.turno_id) {
            formData.append('turno_id', data.turno_id);
        }

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
                    horizontalPosition: 'end',
                    verticalPosition: 'top',
                });
            },
            error: (err) => {
                this._snackBar.open('Error al actualizar estado', 'Cerrar', {
                    duration: 2000,
                    panelClass: ['error-snackbar'],
                    horizontalPosition: 'end',
                    verticalPosition: 'top',
                });
            }
        });
    }


    loadPosiblesJefes(): void {
        this._rhService.jefes$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(jefes => {
                this.posiblesJefes = jefes || [];
                this._changeDetectorRef.markForCheck(); // OnPush, no lo olvides
            });
    }
}