import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CatalogoPermiso, PermisosService } from 'app/modules/ViewAll/Permisos/permisos.service';
import { finalize } from 'rxjs';

export const slideUpPermiso = trigger('slideUpPermiso', [
  transition(':enter', [
    style({ transform: 'translateY(100%)', opacity: 0 }),
    animate(
      '320ms cubic-bezier(0.32, 0.72, 0, 1)',
      style({ transform: 'translateY(0)', opacity: 1 }),
    ),
  ]),
  transition(':leave', [
    animate(
      '220ms cubic-bezier(0.4, 0, 1, 1)',
      style({ transform: 'translateY(120%)', opacity: 0 }),
    ),
  ]),
]);

@Component({
  selector: 'permisos-modal',
  templateUrl: './PermisosModal.component.html',
  styleUrls: ['./PermisosModal.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [slideUpPermiso],
})
export class PermisosModalComponent implements OnInit {
  form: FormGroup;

  catalogo: CatalogoPermiso[] = [];
  cargandoCatalogo = false;
  enviando = false;

  mensaje: { tipo: 'ok' | 'error'; texto: string } | null = null;

  // ==================== DRAG TO DISMISS (móvil) ====================
  isDragging = false;
  dragTransform = 'translateY(0)';
  dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
  private _touchStartY = 0;
  private _dragY = 0;
  private readonly DISMISS_THRESHOLD = 140;

  constructor(
    private fb: FormBuilder,
    private permisosService: PermisosService,
    public dialogRef: MatDialogRef<PermisosModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      checador_catalogo_permiso_id: [null, Validators.required],
      tipo: ['normal'],
      fecha_inicio: [this.hoyISO(), Validators.required],
      fecha_fin: [this.hoyISO(), Validators.required],
      hora_inicio: [''],
      hora_fin: [''],
      motivo: ['', [Validators.required, Validators.maxLength(255)]],
    });
  }

  ngOnInit(): void {
    this.cargarCatalogo();
  }

  cargarCatalogo(): void {
    this.cargandoCatalogo = true;
    this.permisosService
      .getCatalogo()
      .pipe(
        finalize(() => {
          this.cargandoCatalogo = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (catalogo) => {
          this.catalogo = catalogo;
          this.cdr.markForCheck();
        },
        error: () => {
          this.mensaje = { tipo: 'error', texto: 'No se pudo cargar el catálogo de permisos.' };
          this.cdr.markForCheck();
        },
      });
  }

  enviarSolicitud(): void {
    this.mensaje = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    this.enviando = true;

    this.permisosService
      .solicitar({
        checador_catalogo_permiso_id: v.checador_catalogo_permiso_id,
        tipo: v.tipo || undefined,
        fecha_inicio: v.fecha_inicio,
        fecha_fin: v.fecha_fin,
        hora_inicio: v.hora_inicio || undefined,
        hora_fin: v.hora_fin || undefined,
        motivo: v.motivo,
      })
      .pipe(
        finalize(() => {
          this.enviando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          // Cerramos el modal y le pasamos el resultado al padre
          this.dialogRef.close({
            success: true,
            mensaje: res.message ?? 'Permiso solicitado.',
          });
        },
        error: (err) => {
          this.mensaje = {
            tipo: 'error',
            texto: err?.error?.message ?? 'Ocurrió un error al solicitar el permiso.',
          };
          this.cdr.markForCheck();
        },
      });
  }

  cerrarModal(): void {
    this.dragTransition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    this.dragTransform = 'translateY(110%) scale(0.96)';
    this.cdr.markForCheck();
    setTimeout(() => this.dialogRef.close(), 350);
  }

  abrirFecha(input: HTMLInputElement): void {
    input.showPicker();
  }

  // ==================== DRAG TO DISMISS (móvil) ====================
  onTouchStart(event: TouchEvent): void {
    this._touchStartY = event.touches[0].clientY;
    this.isDragging = true;
    this.dragTransition = 'none';
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  onTouchEnd(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.dragTransition = 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)';
    if (this._dragY >= this.DISMISS_THRESHOLD) {
      this.dragTransform = 'translateY(120%) scale(0.95)';
      this.cdr.markForCheck();
      setTimeout(() => this.dialogRef.close(), 320);
    } else {
      this.dragTransform = 'translateY(0)';
      this.cdr.markForCheck();
    }
  }

  private hoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
