import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  CatalogoPermiso,
  CLAVES_PAGO_TIEMPO,
  PermisosService,
} from 'app/modules/ViewAll/Permisos/permisos.service';
import { finalize, Subject, takeUntil } from 'rxjs';

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

interface PagoTiempoOption {
  value: 'tiempo_por_tiempo' | 'dia_descanso' | 'sin_goce';
  label: string;
  descripcion: string;
  icon: string;
}

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
export class PermisosModalComponent implements OnInit, OnDestroy {
  form: FormGroup;

  catalogo: CatalogoPermiso[] = [];
  cargandoCatalogo = false;
  enviando = false;

  mensaje: { tipo: 'ok' | 'error'; texto: string } | null = null;

  readonly pagoTiempoOptions: PagoTiempoOption[] = [
    {
      value: 'tiempo_por_tiempo',
      label: 'Tiempo por tiempo',
      descripcion:
        'Pagas con tiempo equivalente en otro horario. Ej. debiste 30 min, entras 30 min antes otro día.',
      icon: 'sync',
    },
    {
      value: 'dia_descanso',
      label: 'Día de descanso',
      descripcion:
        'Vienes un día que no es tu turno (ej. sábado). Al aprobar se genera tu permiso automáticamente.',
      icon: 'event',
    },
    {
      value: 'sin_goce',
      label: 'Sin goce de sueldo',
      descripcion: 'No pagas el tiempo ausente, se descuenta de tu sueldo.',
      icon: 'money_off',
    },
  ];

  private readonly _destroy$ = new Subject<void>();

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
    this.form = this.fb.group(
      {
        checador_catalogo_permiso_id: [null, Validators.required],
        tipo: ['normal'],
        fecha_inicio: [this.hoyISO(), Validators.required],
        fecha_fin: [this.hoyISO(), Validators.required],
        hora_inicio: [''],
        hora_fin: [''],
        no_regresa: [false],
        motivo: ['', [Validators.required, Validators.maxLength(255)]],
        tipo_pago_tiempo: [null],
        fecha_reposicion: [''],
        hora_inicio_reposicion: [''],
        hora_fin_reposicion: [''],
        justificacion_pago_tiempo: [''],
      },
      { validators: this.validarHorasReposicion },
    );
  }

  // ───────── GETTERS ─────────

  get requierePagoTiempo(): boolean {
    const catalogoId = this.form.get('checador_catalogo_permiso_id')?.value;
    if (!catalogoId) return false;
    const item = this.catalogo.find((c) => c.id === catalogoId);
    return item ? CLAVES_PAGO_TIEMPO.includes(item.clave ?? '') : false;
  }

  get noRegresa(): boolean {
    return !!this.form.get('no_regresa')?.value;
  }

  get tipoPagoTiempo(): string | null {
    return this.form.get('tipo_pago_tiempo')?.value ?? null;
  }

  get muestraReposicionTiempo(): boolean {
    return this.tipoPagoTiempo === 'tiempo_por_tiempo';
  }

  get muestraReposicionDia(): boolean {
    return this.tipoPagoTiempo === 'dia_descanso';
  }

  get muestraJustificacionPago(): boolean {
    return this.tipoPagoTiempo !== null && this.tipoPagoTiempo !== undefined;
  }

  get horaFinReposicionInvalida(): boolean {
    const hi = this.form.get('hora_inicio_reposicion')?.value;
    const hf = this.form.get('hora_fin_reposicion')?.value;
    if (!hi || !hf) return false;
    return hf <= hi;
  }

  // ───────── LIFECYCLE ─────────

  ngOnInit(): void {
    this.cargarCatalogo();
    this.escucharCambiosForm();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // ───────── CARGA ─────────

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
          this.catalogo = catalogo.filter(
            (item) => item.nombre?.trim().toLowerCase() !== 'hora de comida',
          );
          this.cdr.markForCheck();
        },
        error: () => {
          this.mensaje = { tipo: 'error', texto: 'No se pudo cargar el catálogo de permisos.' };
          this.cdr.markForCheck();
        },
      });
  }

  // ───────── REACTIVIDAD DEL FORM ─────────

  private escucharCambiosForm(): void {
    // 1. Tipo de permiso → activar/desactivar validadores de pago de tiempo
    this.form
      .get('checador_catalogo_permiso_id')
      ?.valueChanges.pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        const controlesPago = [
          'tipo_pago_tiempo',
          'fecha_reposicion',
          'hora_inicio_reposicion',
          'hora_fin_reposicion',
        ] as const;

        if (!this.requierePagoTiempo) {
          // Limpiar todo: valores + validadores
          controlesPago.forEach((nombre) => {
            const c = this.form.get(nombre);
            c?.clearValidators();
            c?.updateValueAndValidity({ emitEvent: false });
          });
          this.form.patchValue(
            {
              tipo_pago_tiempo: null,
              fecha_reposicion: '',
              hora_inicio_reposicion: '',
              hora_fin_reposicion: '',
              justificacion_pago_tiempo: '',
            },
            { emitEvent: false },
          );
        } else {
          // Solo activar required en tipo_pago_tiempo; los demás se activan
          // al elegir opción concreta en el subscription de abajo
          this.form.get('tipo_pago_tiempo')?.addValidators(Validators.required);
          this.form.get('tipo_pago_tiempo')?.updateValueAndValidity({ emitEvent: false });
        }

        this.cdr.markForCheck();
      });

    // 2. no_regresa → limpiar hora_fin + toggle required
    this.form
      .get('no_regresa')
      ?.valueChanges.pipe(takeUntil(this._destroy$))
      .subscribe((val: boolean) => {
        const hfControl = this.form.get('hora_fin');
        if (val) {
          hfControl?.removeValidators(Validators.required);
          hfControl?.patchValue('', { emitEvent: false });
        } else {
          hfControl?.addValidators(Validators.required);
        }
        hfControl?.updateValueAndValidity({ emitEvent: false });
        this.cdr.markForCheck();
      });

    // 3. tipo_pago_tiempo → limpiar campos que no aplican + toggle required
    this.form
      .get('tipo_pago_tiempo')
      ?.valueChanges.pipe(takeUntil(this._destroy$))
      .subscribe((val: string | null) => {
        const frCtrl = this.form.get('fecha_reposicion');
        const hirCtrl = this.form.get('hora_inicio_reposicion');
        const hfrCtrl = this.form.get('hora_fin_reposicion');

        // Siempre limpiar horas de reposición al cambiar opción
        this.form.patchValue(
          { hora_inicio_reposicion: '', hora_fin_reposicion: '' },
          { emitEvent: false },
        );

        if (val === 'tiempo_por_tiempo') {
          // Opcional: no se agregan validadores required
        } else if (val === 'dia_descanso') {
          frCtrl?.addValidators(Validators.required);
          hirCtrl?.removeValidators(Validators.required);
          hfrCtrl?.removeValidators(Validators.required);
        } else {
          // sin_goce o null
          frCtrl?.removeValidators(Validators.required);
          hirCtrl?.removeValidators(Validators.required);
          hfrCtrl?.removeValidators(Validators.required);
          this.form.patchValue({ fecha_reposicion: '' }, { emitEvent: false });
        }

        frCtrl?.updateValueAndValidity({ emitEvent: false });
        hirCtrl?.updateValueAndValidity({ emitEvent: false });
        hfrCtrl?.updateValueAndValidity({ emitEvent: false });

        this.cdr.markForCheck();
      });
  }

  // ───────── ENVÍO ─────────

  enviarSolicitud(): void {
    this.mensaje = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const v = this.form.value;
    this.enviando = true;

    const payload: any = {
      checador_catalogo_permiso_id: v.checador_catalogo_permiso_id,
      tipo: v.tipo || undefined,
      fecha_inicio: v.fecha_inicio,
      fecha_fin: v.fecha_fin,
      no_regresa: !!v.no_regresa,
      motivo: v.motivo,
    };

    if (v.hora_inicio) {
      payload.hora_inicio = v.hora_inicio;
    }

    if (!v.no_regresa && v.hora_fin) {
      payload.hora_fin = v.hora_fin;
    }

    if (this.requierePagoTiempo && v.tipo_pago_tiempo) {
      payload.tipo_pago_tiempo = v.tipo_pago_tiempo;

      if (v.tipo_pago_tiempo === 'tiempo_por_tiempo') {
        payload.fecha_reposicion = v.fecha_reposicion || undefined;
        payload.hora_inicio_reposicion = v.hora_inicio_reposicion || undefined;
        payload.hora_fin_reposicion = v.hora_fin_reposicion || undefined;
      }

      if (v.tipo_pago_tiempo === 'dia_descanso') {
        payload.fecha_reposicion = v.fecha_reposicion || undefined;
      }

      if (v.justificacion_pago_tiempo) {
        payload.justificacion_pago_tiempo = v.justificacion_pago_tiempo;
      }
    }

    this.permisosService
      .solicitar(payload)
      .pipe(
        finalize(() => {
          this.enviando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
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

  // ───────── HELPERS ─────────

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

  private validarHorasReposicion(group: FormGroup) {
    const hi = group.get('hora_inicio_reposicion')?.value;
    const hf = group.get('hora_fin_reposicion')?.value;
    if (hi && hf && hf <= hi) {
      group.get('hora_fin_reposicion')?.setErrors({ horaInvalida: true });
      return { horaInvalida: true };
    }
    return null;
  }



  
}
