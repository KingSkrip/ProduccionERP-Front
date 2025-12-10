import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation, } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators, } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule, MatRippleModule } from '@angular/material/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { fuseAnimations } from '@fuse/animations';



@Component({
    selector: 'confirm-password',
    templateUrl: './confirm-password.component.html',
    styleUrls: ['./confirm-password.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations,
    imports: [
        CommonModule,
        MatProgressBarModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
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
    ],
})


export class ConfirmpasswordComponent implements OnInit, OnDestroy {
    newUsuarioForm: UntypedFormGroup;
    showPassword: boolean = false;

    constructor(
        private _formBuilder: UntypedFormBuilder,
        private _dialogRef: MatDialogRef<ConfirmpasswordComponent>,
    ) { }

    ngOnInit(): void {
        this.newUsuarioForm = this._formBuilder.group({
            current_password: ['', Validators.required],
        });
    }

    submitForm(): void {
        if (this.newUsuarioForm.invalid) {
            this.newUsuarioForm.markAllAsTouched();
            return;
        }

        this._dialogRef.close(
            this.newUsuarioForm.get('current_password')?.value
        );
    }

    closeModal(): void {
        this._dialogRef.close(null);
    }

    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    ngOnDestroy(): void { }
}
