import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { AlmacenExistencia } from 'app/modules/admin/Inventarios/types/inventario.type';


export const slideUp = trigger('slideUp', [
    transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate(
            '320ms cubic-bezier(0.32, 0.72, 0, 1)',
            style({ transform: 'translateY(0)', opacity: 1 })
        ),
    ]),
    transition(':leave', [
        animate(
            '220ms cubic-bezier(0.4, 0, 1, 1)',
            style({ transform: 'translateY(120%)', opacity: 0 })
        ),
    ]),
]);

export interface DetalleArticuloModalData {
    cve_art: string;
    descripcion: string;
    u_m: string;
    existencia_total: number;
    almacenes: AlmacenExistencia[];
}

@Component({
    selector: 'detalle-articulo-modal',
    templateUrl: './detalle-articulo-modal.component.html',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTableModule],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [slideUp],
})
export class DetalleArticuloModalComponent {
    columnasAlmacenes: string[] = ['almacen', 'existencia', 'costo_prom'];

    // ==================== DRAG TO DISMISS (móvil) ====================
    private _dragY = 0;
    isDragging = false;
    dragTransform = 'translateY(0)';
    dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
    private _touchStartY = 0;
    private readonly DISMISS_THRESHOLD = 140;

    constructor(
        public dialogRef: MatDialogRef<DetalleArticuloModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: DetalleArticuloModalData,
        private _cdr: ChangeDetectorRef
    ) {}

    onTouchStart(event: TouchEvent): void {
        this._touchStartY = event.touches[0].clientY;
        this.isDragging = true;
        this.dragTransition = 'none';
        this._cdr.markForCheck();
    }

    onTouchMove(event: TouchEvent): void {
        if (!this.isDragging) return;
        event.preventDefault();
        const deltaY = event.touches[0].clientY - this._touchStartY;
        if (deltaY <= 0) {
            this.dragTransform = 'translateY(0)';
            return;
        }
        this._dragY = deltaY;
        const resistance =
            deltaY > this.DISMISS_THRESHOLD
                ? this.DISMISS_THRESHOLD + (deltaY - this.DISMISS_THRESHOLD) * 0.35
                : deltaY;
        this.dragTransform = `translateY(${resistance}px)`;
        this._cdr.markForCheck();
    }

    onTouchEnd(): void {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.dragTransition = 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)';
        if (this._dragY >= this.DISMISS_THRESHOLD) {
            this.dragTransform = 'translateY(120%) scale(0.95)';
            this._cdr.markForCheck();
            setTimeout(() => this.dialogRef.close(), 320);
        } else {
            this.dragTransform = 'translateY(0)';
            this._cdr.markForCheck();
        }
    }

    cerrarModal(): void {
        this.dragTransition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        this.dragTransform = 'translateY(110%) scale(0.96)';
        this._cdr.markForCheck();
        setTimeout(() => this.dialogRef.close(), 350);
    }
}