import { AsyncPipe, CommonModule, CurrencyPipe, NgClass, NgTemplateOutlet, } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators, } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule, } from '@angular/material/checkbox';
import { MatOptionModule, MatRippleModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { fuseAnimations } from '@fuse/animations';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { BehaviorSubject, Observable, Subject, debounceTime, map, merge, switchMap, takeUntil, } from 'rxjs';
import { InventoryBrand, InventoryCategory, InventoryPagination, InventoryProduct, InventoryTag, InventoryVendor, SuAdmin } from '../suadmin.types';
import { SuadminService } from '../suadmin.service';
import { APP_CONFIG } from 'app/core/config/app-config';
import { MatDialog } from '@angular/material/dialog';
import { AddsuadminComponent } from 'app/modules/modals/add-suadmin/add-suadmin.component';
import { ConfirmpasswordComponent } from 'app/modules/modals/confirm-password/confirm-password.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'suadmin-list',
    templateUrl: './suadminlist.component.html',
    styles: [
        /* language=SCSS */
        `
            .inventory-grid {
                grid-template-columns: 48px auto 40px;

                @screen sm {
                    grid-template-columns: 48px auto 112px 72px;
                }

                @screen md {
                    grid-template-columns: 48px 112px auto 112px 72px;
                }

                @screen lg {
                    grid-template-columns: 48px 112px auto 112px 96px 96px 72px;
                }
            }
        `,
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations,
    imports: [
        MatProgressBarModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatSortModule,
        NgTemplateOutlet,
        MatPaginatorModule,
        MatSlideToggleModule,
        MatSelectModule,
        MatOptionModule,
        MatCheckboxModule,
        MatRippleModule,
        AsyncPipe,
        CommonModule,
    ],
})
export class SuadminListComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(MatPaginator) private _paginator: MatPaginator;
    @ViewChild(MatSort) private _sort: MatSort;

    products$: Observable<InventoryProduct[]>;
    brands: InventoryBrand[];
    categories: InventoryCategory[];
    filteredTags: InventoryTag[];
    flashMessage: 'success' | 'error' | null = null;
    isLoading: boolean = false;
    pagination: InventoryPagination;
    searchInputControl: UntypedFormControl = new UntypedFormControl();
    selectedProduct: InventoryProduct | null = null;
    selectedProductForm: UntypedFormGroup;
    tags: InventoryTag[];
    tagsEditMode: boolean = false;
    vendors: InventoryVendor[];
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    apiBase = APP_CONFIG.apiBase;
    photoVersion = Date.now();
    usuarios$: Observable<SuAdmin[]>;
    selectedUsuario: SuAdmin | null = null;
    selectedUsuarioForm: UntypedFormGroup;
    showPassword: boolean = false;
    showPasswordConfirmation: boolean = false;

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _inventoryService: SuadminService,
        private _dialog: MatDialog,
        private snackBar: MatSnackBar,
    ) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {

        // Crear el formulario para usuario seleccionado
        this.selectedUsuarioForm = this._formBuilder.group({
            id: [''],
            name: ['', [Validators.required]],
            email: ['', [Validators.required, Validators.email]],
            departamento: [''],
            desktop: [''],
            usuario: [''],
            photo: [''],
            password: [''],
            password_confirmation: [''],
        });



        // Obtener usuarios desde el servicio
        this.usuarios$ = this._inventoryService.usuarios$;

        // Cargar usuarios inicialmente
        this._inventoryService.getUsuarios()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe();

        // Suscribirse a cambios en el campo de búsqueda
        this.searchInputControl.valueChanges
            .pipe(
                takeUntil(this._unsubscribeAll),
                debounceTime(300),
                switchMap((query) => {
                    this.closeDetails();
                    this.isLoading = true;
                    // Aquí deberías implementar búsqueda en el backend si está disponible
                    // Por ahora solo recargamos los usuarios
                    return this._inventoryService.getUsuarios();
                }),
                map(() => {
                    this.isLoading = false;
                })
            )
            .subscribe();


    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }



    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    ngAfterViewInit(): void {
        if (this._sort && this._paginator) {
            this._sort.sort({
                id: 'name',
                start: 'asc',
                disableClear: true,
            });

            this._changeDetectorRef.markForCheck();
        }
    }

    toggleDetails(usuario: SuAdmin): void {
        if (this.selectedUsuario && this.selectedUsuario.id === usuario.id) {
            this.closeDetails();
            return;
        }
        this.selectedUsuario = { ...usuario };
        this.photoVersion = Date.now();
        this.selectedUsuarioForm.patchValue(this.selectedUsuario);
        this._changeDetectorRef.markForCheck();
    }

    closeDetails(): void {
        this.selectedUsuario = null;
        this.selectedUsuarioForm.reset();
    }

    createUsuario(): void {
        const nuevoUsuario = {
            name: '',
            email: '',
            password: ''
        };

        this._inventoryService.createUsuario(nuevoUsuario).subscribe((newUsuario) => {
            this.selectedUsuario = newUsuario;
            this.selectedUsuarioForm.patchValue(newUsuario);
            this._changeDetectorRef.markForCheck();
        });
    }



    updateSelectedUsuario(): void {
        const usuario = this.selectedUsuarioForm.getRawValue();

        // Si intenta cambiar contraseña, validamos
        if (usuario.password) {

            if (usuario.password !== usuario.password_confirmation) {
                this.showFlashMessage('error');
                this.snackBar.open('Las contraseñas no coinciden', 'Cerrar', {
                    duration: 3000,
                    horizontalPosition: 'right',
                    verticalPosition: 'top',
                    panelClass: ['error-snackbar']
                });
                return;
            }

            // Abrir modal para pedir contraseña actual
            const dialogRef = this._dialog.open(ConfirmpasswordComponent, {
                width: '400px',
                disableClose: true
            });

            dialogRef.afterClosed().subscribe((currentPassword) => {
                if (!currentPassword) return;

                const updateData: any = {
                    name: usuario.name,
                    email: usuario.email,
                    departamento: usuario.departamento,
                    desktop: usuario.desktop,
                    usuario: usuario.usuario,
                    photo: usuario.photo,
                    password: usuario.password,
                    current_password: currentPassword
                };

                this._inventoryService.updateUsuario(usuario.id, updateData).subscribe(
                    () => {
                        this.showFlashMessage('success');

                        this.snackBar.open('Contraseña actualizada correctamente', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'right',
                            verticalPosition: 'top',
                            panelClass: ['success-snackbar']
                        });
                        this.selectedUsuarioForm.patchValue({
                            password: '',
                            password_confirmation: ''
                        });
                        this.closeDetails();
                        this._inventoryService.getUsuarios().subscribe();
                    }
                    ,
                    () => {
                        this.showFlashMessage('error');
                        this.snackBar.open('Error al actualizar la contraseña', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'right',
                            verticalPosition: 'top',
                            panelClass: ['error-snackbar']
                        });
                    }
                );
            });

            return;
        }

        // Si NO cambia contraseña → actualiza normal
        const updateData: any = {
            name: usuario.name,
            email: usuario.email,
            departamento: usuario.departamento,
            desktop: usuario.desktop,
            usuario: usuario.usuario,
            photo: usuario.photo,
        };

        this._inventoryService.updateUsuario(usuario.id, updateData).subscribe(
            () => {
                this.showFlashMessage('success');

                this.snackBar.open('Usuario actualizado correctamente', 'Cerrar', {
                    duration: 3000,
                    horizontalPosition: 'right',
                    verticalPosition: 'top',
                    panelClass: ['success-snackbar']
                });
                this.closeDetails();
                this._inventoryService.getUsuarios().subscribe();
            },
            () => {
                this.showFlashMessage('error');

                this.snackBar.open('Error al actualizar el usuario', 'Cerrar', {
                    duration: 3000,
                    horizontalPosition: 'right',
                    verticalPosition: 'top',
                    panelClass: ['error-snackbar']
                });
            }
        );


    }



    deleteSelectedUsuario(): void {

    const confirmation = this._fuseConfirmationService.open({
        title: 'Eliminar usuario',
        message: '¿Estás seguro de que quieres eliminar este usuario? ¡Esta acción no se puede deshacer!',
        actions: {
            confirm: {
                label: 'Eliminar',
            },
            cancel: {
                label: 'Cancelar'
            }
        }
    });

    confirmation.afterClosed().subscribe((result) => {

        if (result === 'confirmed') {

            const usuario = this.selectedUsuarioForm.getRawValue();

            this._inventoryService.deleteUsuario(usuario.id).subscribe(
                () => {
                    this.snackBar.open('Usuario eliminado correctamente', 'Cerrar', {
                        duration: 3000,
                        horizontalPosition: 'right',
                        verticalPosition: 'top',
                        panelClass: ['success-snackbar']
                    });

                    this.closeDetails();
                    this._inventoryService.getUsuarios().subscribe();
                },
                () => {
                    this.snackBar.open('Error al eliminar el usuario', 'Cerrar', {
                        duration: 3000,
                        horizontalPosition: 'right',
                        verticalPosition: 'top',
                        panelClass: ['error-snackbar']
                    });
                }
            );
        }
    });
}


    showFlashMessage(type: 'success' | 'error'): void {
        this.flashMessage = type;
        this._changeDetectorRef.markForCheck();

        setTimeout(() => {
            this.flashMessage = null;
            this._changeDetectorRef.markForCheck();
        }, 3000);
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }


    get selectedPhotoUrl(): string {
        if (!this.selectedUsuario?.photo) return '';

        const base = this.apiBase.endsWith('/') ? this.apiBase : this.apiBase + '/';
        const photo = this.selectedUsuario.photo.startsWith('/')
            ? this.selectedUsuario.photo.substring(1)
            : this.selectedUsuario.photo;

        return `${base + photo}?v=${this.photoVersion}`;
    }

    getPhotoUrl(photo: string): string {
        if (!photo) return '';

        const base = this.apiBase.endsWith('/') ? this.apiBase : this.apiBase + '/';
        const cleanPhoto = photo.startsWith('/') ? photo.substring(1) : photo;

        return `${base + cleanPhoto}?v=${this.photoVersion}`;
    }


    AddModal(): void {
        const dialogRef = this._dialog.open(AddsuadminComponent, {
            width: '600px',
            disableClose: true,
            data: {}
        });

        dialogRef.afterClosed().subscribe((newUser) => {
            if (newUser) {

                this.snackBar.open('Superadmin agregado correctamente', 'Cerrar', {
                    duration: 3000,
                    horizontalPosition: 'right',
                    verticalPosition: 'top',
                    panelClass: ['success-snackbar']
                });
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
        return password === confirmation && password !== '';
    }

    passwordsDontMatch(): boolean {
        const password = this.selectedUsuarioForm.get('password')?.value;
        const confirmation = this.selectedUsuarioForm.get('password_confirmation')?.value;
        const touched = this.selectedUsuarioForm.get('password_confirmation')?.touched;
        return password !== confirmation && confirmation !== '' && touched;
    }

    blockPaste(event: ClipboardEvent): void {
        event.preventDefault();
    }

}
