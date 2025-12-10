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
import { Observable, Subject, debounceTime, switchMap, takeUntil } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { Rol } from '../../roles.types';
import { RolesService } from '../roles.service';
import { AddrolesComponent } from 'app/modules/modals/Roles/add-roles/add-rolescomponent';

@Component({
    selector: 'roles-list',
    templateUrl: './rolesList.component.html',
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
export class RolesListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns: string[] = ['CLAVE', 'NOMBRE', 'GUARD_NAME', 'actions'];
    searchInputControl: UntypedFormControl = new UntypedFormControl();
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    @ViewChild('paginator') private _paginator!: MatPaginator;
    @ViewChild(MatSort) private _sort!: MatSort;
    flashMessage: 'success' | 'error' | null = null;
    dataSource = new MatTableDataSource<Rol>([]);
    selectedRol: Rol | null = null;
    selectedRolForm: UntypedFormGroup;
    roles$: Observable<Rol[]>;
    isLoading: boolean = false;
    totalPagesArray: number[] = [];
    pageSize = 10;
    currentPage = 0;
    totalPages = 0;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _rolesService: RolesService,
        private _dialog: MatDialog,
        private snackBar: MatSnackBar,
    ) { }

    ngOnInit(): void {
        this.selectedRolForm = this._formBuilder.group({
            CLAVE: [''],
            NOMBRE: ['', [Validators.required]],
            GUARD_NAME: ['', [Validators.required]],
        });

        this.roles$ = this._rolesService.roles$;

        this._rolesService.getRoles()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe();

        this.searchInputControl.valueChanges
            .pipe(
                takeUntil(this._unsubscribeAll),
                debounceTime(300),
                switchMap(() => {
                    this.isLoading = true;
                    return this.roles$;
                })
            )
            .subscribe();

        this.roles$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(roles => {
                this.dataSource.data = roles ?? [];
                this.totalPages = Math.ceil(this.dataSource.data.length / this.pageSize);
                this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i);
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            });
    }

    ngAfterViewInit(): void {
        if (this._sort && this._paginator) {
            this._sort.sort({ id: 'NOMBRE', start: 'asc', disableClear: true });
            this._changeDetectorRef.markForCheck();
        }
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    toggleDetails(rol: Rol): void {
        if (this.selectedRol && this.selectedRol.CLAVE === rol.CLAVE) {
            this.closeDetails();
            return;
        }
        this.selectedRol = { ...rol };
        this.selectedRolForm.patchValue(this.selectedRol);
        this._changeDetectorRef.markForCheck();
    }

    closeDetails(): void {
        this.selectedRol = null;
        this.selectedRolForm.reset();
    }

    updateSelectedRol(): void {
        const rolData = this.selectedRolForm.getRawValue();
        this._rolesService.updateRol(rolData.CLAVE, {
            NOMBRE: rolData.NOMBRE,
            GUARD_NAME: rolData.GUARD_NAME
        }).subscribe({
            next: () => {
                this.showFlashMessage('success');
                this.snackBar.open('Rol actualizado correctamente', 'Cerrar', { duration: 3000 });
                this.closeDetails();
            },
            error: () => {
                this.showFlashMessage('error');
                this.snackBar.open('Error al actualizar rol', 'Cerrar', { duration: 3000 });
            }
        });
    }

    deleteSelectedRol(): void {
        const confirmation = this._fuseConfirmationService.open({
            title: 'Eliminar rol',
            message: '¿Estás seguro de que deseas eliminar este rol? ¡Esta acción no se puede deshacer!',
            actions: {
                confirm: { label: 'Eliminar' },
                cancel: { label: 'Cancelar' }
            }
        });

        confirmation.afterClosed().subscribe(result => {
            if (result === 'confirmed' && this.selectedRol) {
                this._rolesService.deleteRol(this.selectedRol.CLAVE).subscribe({
                    next: () => {
                        this.snackBar.open('Rol eliminado correctamente', 'Cerrar', { duration: 3000 });
                        this.closeDetails();
                    },
                    error: () => {
                        this.snackBar.open('Error al eliminar rol', 'Cerrar', { duration: 3000 });
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
        return item.CLAVE || index;
    }

    get paginatedRoles() {
        const start = this.currentPage * this.pageSize;
        return this.dataSource.data.slice(start, start + this.pageSize);
    }



    AddModal(): void {
        const dialogRef = this._dialog.open(AddrolesComponent, {
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


    blockPaste(event: ClipboardEvent): void {
        event.preventDefault();
    }


    get paginatedUsuarios() {
        const start = this.currentPage * this.pageSize;
        return this.dataSource.data.slice(start, start + this.pageSize);
    }

    goToPage(page: number) { this.currentPage = page; }
    nextPage() { if (this.currentPage < this.totalPages - 1) this.currentPage++; }
    prevPage() { if (this.currentPage > 0) this.currentPage--; }
}