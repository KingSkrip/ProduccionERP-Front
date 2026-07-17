import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
// ya no importes MAT_DIALOG_DATA, MatDialogModule, MatDialogRef
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogoPermiso } from 'app/modules/Checador/types/Catalogopermiso.types';
import { CLAVES_PAGO_TIEMPO, PermisosService } from 'app/modules/ViewAll/Permisos/permisos.service';
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatStepperModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatDividerModule,
    MatCardModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTooltipModule,
    // MatDialogModule fuera
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [slideUpPermiso],
})

export class PermisosModalComponent implements OnInit, OnDestroy {
  form: FormGroup;
  cerrar: (result?: any) => void = () => {};
  catalogo: CatalogoPermiso[] = [];
  cargandoCatalogo = false;
  enviando = false;

  mensaje: { tipo: 'ok' | 'error'; texto: string } | null = null;
  /** Opciones de pago de tiempo */
  readonly pagoTiempoOptions: PagoTiempoOption[] = [
    {
      value: 'tiempo_por_tiempo',
      label: 'Tiempo por tiempo',
      descripcion:
        'Lo pagas poco a poco: llegando antes de tu hora de entrada o saliendo después de tu hora de salida en cualquier día. No necesitas especificar cuándo ni cuánto.',
      icon: 'sync',
    },
    {
      value: 'dia_descanso',
      label: 'Día de descanso',
      descripcion:
        'Vienes un día que no es tu turno (ej. sábado). Al aprobar se genera tu permiso automáticamente para ese día.',
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
  isDragging = false;
  dragTransform = 'translateY(0)';
  dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
  private _touchStartY = 0;
  private _dragY = 0;
  private readonly DISMISS_THRESHOLD = 140;

 constructor(
    private fb: FormBuilder,
    private permisosService: PermisosService,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      checador_catalogo_permiso_id: [null, Validators.required],
      tipo: ['normal'],
      fecha_inicio: [this.hoyISO(), Validators.required],
      fecha_fin: [this.hoyISO(), Validators.required],
      todo_el_dia: [false],
      hora_inicio: [''],
      hora_fin: [''],
      no_regresa: [false],
      motivo: ['', [Validators.required, Validators.maxLength(255)]],
      tipo_pago_tiempo: [null],
      fecha_reposicion: [''],
      hora_inicio_reposicion: [''],
      hora_fin_reposicion: [''],
      justificacion_pago_tiempo: [''],
    });
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

  /** "Tiempo por tiempo" NO muestra campos — solo informativo */
  get esTiempoPorTiempo(): boolean {
    return this.tipoPagoTiempo === 'tiempo_por_tiempo';
  }

  /** "Día de descanso" SÍ muestra campo de fecha */
  get muestraReposicionDia(): boolean {
    return this.tipoPagoTiempo === 'dia_descanso';
  }

  /** Justificación se muestra para cualquier opción que no sea null */
  get muestraJustificacionPago(): boolean {
    return this.tipoPagoTiempo !== null && this.tipoPagoTiempo !== undefined;
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
    // 1. Tipo de permiso → limpiar pago de tiempo si no aplica
    this.form
      .get('checador_catalogo_permiso_id')
      ?.valueChanges.pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        if (!this.requierePagoTiempo) {
          this.form.get('tipo_pago_tiempo')?.clearValidators();
          this.form.get('fecha_reposicion')?.clearValidators();
          this.form.get('hora_inicio_reposicion')?.clearValidators();
          this.form.get('hora_fin_reposicion')?.clearValidators();
          [
            'tipo_pago_tiempo',
            'fecha_reposicion',
            'hora_inicio_reposicion',
            'hora_fin_reposicion',
            'justificacion_pago_tiempo',
          ].forEach((nombre) => {
            this.form.get(nombre)?.updateValueAndValidity({ emitEvent: false });
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
          // Solo required en tipo_pago_tiempo
          this.form.get('tipo_pago_tiempo')?.setValidators(Validators.required);
          this.form.get('tipo_pago_tiempo')?.updateValueAndValidity({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });

    // 2. no_regresa → toggle required en hora_fin
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

    // 3. tipo_pago_tiempo → solo "dia_descanso" requiere fecha
    this.form
      .get('tipo_pago_tiempo')
      ?.valueChanges.pipe(takeUntil(this._destroy$))
      .subscribe((val: string | null) => {
        const frCtrl = this.form.get('fecha_reposicion');
        const hirCtrl = this.form.get('hora_inicio_reposicion');
        const hfrCtrl = this.form.get('hora_fin_reposicion');

        // Siempre limpiar todo al cambiar opción
        this.form.patchValue(
          { fecha_reposicion: '', hora_inicio_reposicion: '', hora_fin_reposicion: '' },
          { emitEvent: false },
        );

        if (val === 'dia_descanso') {
          frCtrl?.setValidators(Validators.required);
          hirCtrl?.clearValidators();
          hfrCtrl?.clearValidators();
        } else {
          // tiempo_por_tiempo, sin_goce o null → nada es requerido
          frCtrl?.clearValidators();
          hirCtrl?.clearValidators();
          hfrCtrl?.clearValidators();
        }

        frCtrl?.updateValueAndValidity({ emitEvent: false });
        hirCtrl?.updateValueAndValidity({ emitEvent: false });
        hfrCtrl?.updateValueAndValidity({ emitEvent: false });

        this.cdr.markForCheck();
      });

    // 4. todo_el_dia → si es true, no se requieren horas, se asume ausencia completa
    this.form
      .get('todo_el_dia')
      ?.valueChanges.pipe(takeUntil(this._destroy$))
      .subscribe((val: boolean) => {
        const hiControl = this.form.get('hora_inicio');
        const hfControl = this.form.get('hora_fin');
        const nrControl = this.form.get('no_regresa');

        if (val) {
          hiControl?.clearValidators();
          hfControl?.clearValidators();

          this.form.patchValue(
            {
              hora_inicio: '',
              hora_fin: '',
            },
            { emitEvent: false },
          );
        } else if (!nrControl?.value) {
          hfControl?.addValidators(Validators.required);
        }

        hiControl?.updateValueAndValidity({ emitEvent: false });
        hfControl?.updateValueAndValidity({ emitEvent: false });
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
      todo_el_dia: !!v.todo_el_dia,
      motivo: v.motivo,
    };

    if (v.hora_inicio) {
      payload.hora_inicio = v.hora_inicio;
    }

    if (!v.no_regresa && v.hora_fin) {
      payload.hora_fin = v.hora_fin;
    }

    // Solo enviamos pago de tiempo si aplica y hay opción seleccionada
    if (this.requierePagoTiempo && v.tipo_pago_tiempo) {
      payload.tipo_pago_tiempo = v.tipo_pago_tiempo;

      // Solo enviamos fecha_reposicion para "dia_descanso" (es el único que la requiere)
      if (v.tipo_pago_tiempo === 'dia_descanso' && v.fecha_reposicion) {
        payload.fecha_reposicion = v.fecha_reposicion;
      }

      // tiempo_por_tiempo ya NO envía fecha/hora — se paga automáticamente al checar

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
          this.cerrar({ success: true, mensaje: res.message ?? 'Permiso solicitado.' });
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
  setTimeout(() => this.cerrar(), 350);
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
     setTimeout(() => this.cerrar(), 320);
    } else {
      this.dragTransform = 'translateY(0)';
      this.cdr.markForCheck();
    }
  }

  private hoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get muestraInfoTiempoPorTiempo(): boolean {
    return this.esTiempoPorTiempo;
  }

  /** Justificación se muestra para cualquier opción que no sea null */
  // get muestraJustificacionPago(): boolean {
  //   return this.tipoPagoTiempo !== null && this.tipoPagoTiempo !== undefined;
  // }

  /** Valida que la hora fin de reposición sea posterior a la hora inicio de reposición */
  get horaFinReposicionInvalida(): boolean {
    const inicio = this.form.get('hora_inicio_reposicion')?.value;
    const fin = this.form.get('hora_fin_reposicion')?.value;
    if (!inicio || !fin) return false;
    return fin <= inicio;
  }

  get todoElDia(): boolean {
    return !!this.form.get('todo_el_dia')?.value;
  }

  get nombreTipoPermisoSeleccionado(): string {
    const id = this.form.get('checador_catalogo_permiso_id')?.value;
    const item = this.catalogo.find((c) => c.id === id);
    return item?.nombre ?? '—';
  }

  pagoTiempoOptionLabel(): string {
    const opt = this.pagoTiempoOptions.find((o) => o.value === this.tipoPagoTiempo);
    return opt?.label ?? '';
  }

  abrirHora(input: HTMLInputElement): void {
    input.showPicker();
  }

  get requiereReposicionTiempo(): boolean {
    return (
      this.requierePagoTiempo && this.tipoPagoTiempo !== null && this.tipoPagoTiempo !== 'sin_goce'
    );
  }



  // ───────── FOOTER ÚNICO (navegación entre pasos) ─────────

/** true si el paso actual es el de "Pago de tiempo" (solo existe si requierePagoTiempo) */
private esPagoTiempoStep(index: number): boolean {
  return this.requierePagoTiempo && index === 2;
}

/** true si el paso actual es el último (Motivo y revisión) */
esUltimoPaso(index: number): boolean {
  const total = this.requierePagoTiempo ? 4 : 3;
  return index === total - 1;
}

/** Regla de validación de "Siguiente" según el paso actual */
siguienteDeshabilitado(index: number): boolean {
  if (index === 0) {
    return !!this.form.get('checador_catalogo_permiso_id')?.invalid;
  }
  if (index === 1) {
    return (
      !!this.form.get('fecha_inicio')?.invalid ||
      !!this.form.get('fecha_fin')?.invalid ||
      (!this.todoElDia && !this.noRegresa && !!this.form.get('hora_fin')?.invalid)
    );
  }
  if (this.esPagoTiempoStep(index)) {
    return (
      !!this.form.get('tipo_pago_tiempo')?.invalid ||
      (this.muestraReposicionDia && !!this.form.get('fecha_reposicion')?.invalid)
    );
  }
  return false; // último paso: el botón de "Siguiente" no aplica, es "Solicitar permiso"
}

private marcarTocadosPaso(index: number): void {
  if (index === 0) {
    this.form.get('checador_catalogo_permiso_id')?.markAsTouched();
  } else if (index === 1) {
    this.form.get('fecha_inicio')?.markAsTouched();
    this.form.get('fecha_fin')?.markAsTouched();
    this.form.get('hora_fin')?.markAsTouched();
  } else if (this.esPagoTiempoStep(index)) {
    this.form.get('tipo_pago_tiempo')?.markAsTouched();
    this.form.get('fecha_reposicion')?.markAsTouched();
  }
}

siguiente(stepper: MatStepper): void {
  const index = stepper.selectedIndex ?? 0;
  this.marcarTocadosPaso(index);
  if (!this.siguienteDeshabilitado(index)) {
    stepper.next();
  }
}
}
