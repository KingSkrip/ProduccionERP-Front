import { AsyncPipe, CommonModule, NgTemplateOutlet } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { fuseAnimations } from '@fuse/animations';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { Observable, Subject, debounceTime, map, merge, switchMap, takeUntil } from 'rxjs';

import { APP_CONFIG } from 'app/core/config/app-config';
import { MatDialog } from '@angular/material/dialog';
import { AddcolaboradorComponent } from 'app/modules/modals/Colaborador/add-colaborador/add-colaborador.component';
import { ConfirmpasswordComponent } from 'app/modules/modals/Colaborador/confirm-password/confirm-password.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { Usuarios } from '../../usuarios.types';
import { ColaboradorService } from '../colaborador.service';

@Component({
    selector: 'colaborador-list',
    templateUrl: './colaboradorList.component.html',
    styles: [`
        .inventory-grid {
            grid-template-columns: 48px auto 40px;
            @screen sm { grid-template-columns: 48px auto 112px 72px; }
            @screen md { grid-template-columns: 48px 112px auto 112px 72px; }
            @screen lg { grid-template-columns: 48px 112px auto 112px 96px 96px 72px; }
        }
    `],
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
        AsyncPipe,
        CommonModule,
        MatTableModule,
    ],
})
export class ColaboradorListComponent implements OnInit, AfterViewInit, OnDestroy {
    displayedColumns: string[] = ['id', 'photo', 'name', 'email', 'actions'];
    searchInputControl: UntypedFormControl = new UntypedFormControl();
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    @ViewChild('paginator') private _paginator!: MatPaginator;
    @ViewChild(MatSort) private _sort!: MatSort;
    flashMessage: 'success' | 'error' | null = null;
    dataSource = new MatTableDataSource<any>([]);
    showPasswordConfirmation: boolean = false;
    selectedUsuario: Usuarios | null = null;
    selectedUsuarioForm: UntypedFormGroup;
    usuarios$: Observable<Usuarios[]>;
    showPassword: boolean = false;
    apiBase = APP_CONFIG.apiBase;
    isLoading: boolean = false;
    photoVersion = Date.now();
    totalPagesArray: number[] = [];
    pageSize = 10;
    currentPage = 0;
    totalPages = 0;



    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _inventoryService: ColaboradorService,
        private _dialog: MatDialog,
        private snackBar: MatSnackBar,
    ) { }

    // -----------------------------------------------------------------------------------------------------
    // Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    ngOnInit(): void {
        // Formulario del usuario seleccionado
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

        this.usuarios$ = this._inventoryService.usuarios$;

        this._inventoryService.getUsuarios()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe();

        // Búsqueda con debounce
        this.searchInputControl.valueChanges
            .pipe(
                takeUntil(this._unsubscribeAll),
                debounceTime(300),
                switchMap(query => {
                    this.isLoading = true;
                    return this.usuarios$;

                })

            )
            .subscribe();

     this.usuarios$
    .pipe(takeUntil(this._unsubscribeAll))
    .subscribe(usuarios => {
        this.dataSource.data = usuarios ?? [];
        this.totalPages = Math.ceil(this.dataSource.data.length / this.pageSize);
        this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i);
        this._changeDetectorRef.markForCheck();
    });


    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    ngAfterViewInit(): void {
        if (this._sort && this._paginator) {
            this._sort.sort({ id: 'name', start: 'asc', disableClear: true });
            this._changeDetectorRef.markForCheck();
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // Métodos públicos
    // -----------------------------------------------------------------------------------------------------

    toggleDetails(usuario: Usuarios): void {
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

    updateSelectedUsuario(): void {
        const usuario = this.selectedUsuarioForm.getRawValue();

        // Cambio de contraseña
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

                this._inventoryService.updateUsuario(usuario.id, updateData).subscribe({
                    next: () => {
                        this.showFlashMessage('success');
                        this.snackBar.open('Contraseña actualizada correctamente', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'right',
                            verticalPosition: 'top',
                            panelClass: ['success-snackbar']
                        });
                        this.selectedUsuarioForm.patchValue({ password: '', password_confirmation: '' });
                        this.closeDetails();
                        this._inventoryService.getUsuarios().subscribe();
                    },
                    error: () => {
                        this.showFlashMessage('error');
                        this.snackBar.open('Error al actualizar la contraseña', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'right',
                            verticalPosition: 'top',
                            panelClass: ['error-snackbar']
                        });
                    }
                });
            });
            return;
        }

        // Actualización sin contraseña
        const updateData: any = {
            name: usuario.name,
            email: usuario.email,
            departamento: usuario.departamento,
            desktop: usuario.desktop,
            usuario: usuario.usuario,
            photo: usuario.photo,
        };

        this._inventoryService.updateUsuario(usuario.id, updateData).subscribe({
            next: () => {
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
            error: () => {
                this.showFlashMessage('error');
                this.snackBar.open('Error al actualizar el usuario', 'Cerrar', {
                    duration: 3000,
                    horizontalPosition: 'right',
                    verticalPosition: 'top',
                    panelClass: ['error-snackbar']
                });
            }
        });
    }

    deleteSelectedUsuario(): void {
        const confirmation = this._fuseConfirmationService.open({
            title: 'Eliminar usuario',
            message: '¿Estás seguro de que deseas eliminar este usuario? ¡Esta acción no se puede deshacer!',
            actions: {
                confirm: { label: 'Eliminar' },
                cancel: { label: 'Cancelar' }
            }
        });

        confirmation.afterClosed().subscribe((result) => {
            if (result === 'confirmed') {
                const usuario = this.selectedUsuarioForm.getRawValue();
                this._inventoryService.deleteUsuario(usuario.id).subscribe({
                    next: () => {
                        this.snackBar.open('Usuario eliminado correctamente', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'right',
                            verticalPosition: 'top',
                            panelClass: ['success-snackbar']
                        });
                        this.closeDetails();
                        this._inventoryService.getUsuarios().subscribe();
                    },
                    error: () => {
                        this.snackBar.open('Error al eliminar el usuario', 'Cerrar', {
                            duration: 3000,
                            horizontalPosition: 'right',
                            verticalPosition: 'top',
                            panelClass: ['error-snackbar']
                        });
                    }
                });
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
        const photo = this.selectedUsuario.photo.startsWith('/') ? this.selectedUsuario.photo.substring(1) : this.selectedUsuario.photo;
        return `${base}${photo}?v=${this.photoVersion}`;
    }

    getPhotoUrl(photo: string): string {
        if (!photo) return '';
        const base = this.apiBase.endsWith('/') ? this.apiBase : this.apiBase + '/';
        const cleanPhoto = photo.startsWith('/') ? photo.substring(1) : photo;
        return `${base}${cleanPhoto}?v=${this.photoVersion}`;
    }

    AddModal(): void {
        const dialogRef = this._dialog.open(AddcolaboradorComponent, {
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


    get paginatedUsuarios() {
        const start = this.currentPage * this.pageSize;
        return this.dataSource.data.slice(start, start + this.pageSize);
    }

    goToPage(page: number) {
        this.currentPage = page;
    }

    nextPage() {
        if (this.currentPage < this.totalPages - 1) this.currentPage++;
    }

    prevPage() {
        if (this.currentPage > 0) this.currentPage--;
    }
}