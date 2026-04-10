import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from 'app/core/auth/auth.service';
import { RoleEnum } from 'app/core/auth/roles/dataroles';
import { CitasService } from 'app/modules/ViewAll/Citas/citas.service';
import { Cita } from 'app/modules/ViewAll/Citas/Types/citas.types';
import { NotaAccesoModalComponent } from '../Nota/nota.component';
import { NuevaCitaModalComponent } from '../nueva-cita-modal.component';

export const slideUp = trigger('slideUp', [
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
  selector: 'provedores-nueva-cita-modal',
  templateUrl: './provedores-nueva-cita-modal.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
  ],
  encapsulation: ViewEncapsulation.None,
  animations: [slideUp],
})
export class ProvedoresNuevaCitaModalComponent implements OnInit {
  //@ViewChild(MatAutocompleteTrigger) autocomplete!: MatAutocompleteTrigger;
  @ViewChild('inputNative2') inputNativeRef2!: ElementRef<HTMLInputElement>;
  @ViewChild('inputNative') inputNativeRef!: ElementRef<HTMLInputElement>;
  @ViewChild('inputAuto2') autocomplete2!: MatAutocompleteTrigger;
  @ViewChild('inputAuto') autocomplete!: MatAutocompleteTrigger;
  formCita: Partial<Cita> = {};
  editandoCita: boolean = false;
  isProveedor = false;
  usuariosSeleccionados: any[] = [];
  usuarios: any[] = [];
  busquedaUsuario: string = '';
  usuariosFiltrados: any[] = [];
  isDragging = false;
  dragTransform = 'translateY(0)';
  usaVehiculo: boolean = false;
  dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
  private _citaIds: number[] = [];
  private _visitantesIdsIniciales: number[] = [];
  private _conVehiculoInicial: boolean = false;
  private _touchStartY = 0;
  private _dragY = 0;
  private readonly DISMISS_THRESHOLD = 140;

  constructor(
    public dialogRef: MatDialogRef<NuevaCitaModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private _citasService: CitasService,
    private _snackBar: MatSnackBar,
    private _dialog: MatDialog,
    private _authService: AuthService,
    private _cdr: ChangeDetectorRef,
  ) {
    // En ProvedoresNuevaCitaModalComponent constructor:

    if (data?.cita) {
      this.editandoCita = true;
      const trimHora = (h: string = '') => h?.slice(0, 5) ?? '';

      this.formCita = {
        fecha: data.cita.fecha,
        horaInicio: trimHora(data.cita.horaInicio),
        horaFin: trimHora(data.cita.horaFin),
        motivo: data.cita.motivo,
        estado: data.cita.estado,
        notas: data.cita.notas,
      };

      // ✅ Guardar para asignar en ngOnInit
      this._conVehiculoInicial =
        data.cita.con_vehiculo === 1 ||
        data.cita.con_vehiculo === '1' ||
        data.cita.con_vehiculo === true;
      this._citaIds = data.cita.ids ?? [];
      this._visitantesIdsIniciales = (data.cita.visitantes ?? []).map((v: any) => v.id);
    } else {
      this.editandoCita = false;
      this.formCita = {
        fecha: data?.fecha,
        estado: 'pendiente',
        horaInicio: data?.horaInicio ?? '08:00',
        horaFin: data?.horaFin ?? '09:00',
      };
    }
  }

  ngOnInit(): void {
    const user = this._authService.getUser();
    this.isProveedor = user?.permissions?.[0] === RoleEnum.PROVEDORES;

    // ✅ Asignar aquí para que el template ya exista
    this.usaVehiculo = this._conVehiculoInicial;
    this._cdr.markForCheck();

    this._citasService.getUsuariosPermitidosParaProvedores().subscribe({
      next: (res) => {
        this.usuarios = res;
        this.usuariosFiltrados = res;

        if (this._visitantesIdsIniciales.length > 0) {
          this.usuariosSeleccionados = res.filter((u: any) =>
            this._visitantesIdsIniciales.includes(u.id),
          );
        }

        this._cdr.markForCheck();
      },
    });
  }

  // ==================== DRAG TO DISMISS ====================

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

    // Evitar que suba
    if (deltaY <= 0) {
      this.dragTransform = 'translateY(0)';
      return;
    }

    this._dragY = deltaY;

    // Efecto de resistencia cuando se pasa del umbral
    const resistance =
      deltaY > this.DISMISS_THRESHOLD
        ? this.DISMISS_THRESHOLD + (deltaY - this.DISMISS_THRESHOLD) * 0.35
        : deltaY;

    this.dragTransform = `translateY(${resistance}px)`;
    this._cdr.markForCheck();
  }

  onTouchEnd(event: TouchEvent): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.dragTransition = 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)';

    if (this._dragY >= this.DISMISS_THRESHOLD) {
      // Deslizar hacia abajo y cerrar
      this.dragTransform = 'translateY(120%) scale(0.95)';
      this._cdr.markForCheck();
      setTimeout(() => this.dialogRef.close(), 320);
    } else {
      // Volver a la posición original
      this.dragTransform = 'translateY(0)';
      this._cdr.markForCheck();
    }
  }

  // ==================== ACTIONS ====================

  guardarCita(): void {
    const normalizarHora = (h: string = '') => h?.slice(0, 5) || '';
    const payload = {
      ...(this.editandoCita ? { ids: this._citaIds } : {}),
      fecha: this.formCita.fecha!,
      hora_inicio: normalizarHora(this.formCita.horaInicio),
      hora_fin: normalizarHora(this.formCita.horaFin),
      visitantes: this.usuariosSeleccionados.map((u) => u.id),
      motivo: this.formCita.motivo,
      estado: this.formCita.estado,
      notas: this.formCita.notas,
      con_vehiculo: this.usaVehiculo,
    };

    const request$ = this.editandoCita
      ? this._citasService.updateCitaProveedor(payload)
      : this._citasService.createCitaProvedores(payload);

    request$.subscribe({
      next: () => {
        this._snackBar.open(this.editandoCita ? 'Cita actualizada ✓' : 'Cita creada ✓', 'OK', {
          duration: 3000,
        });

        // 👈 Solo al crear, no al editar
        if (!this.editandoCita) {
          this._dialog.open(NotaAccesoModalComponent, {
            width: '400px',
            panelClass: 'day-citas-modal-panel',
          });
        }

        this.dialogRef.close({ success: true });
      },
      error: (err) => {
        const errores: string[] = err.error?.errores ?? [];
        const msg =
          errores.length > 0
            ? errores.join('\n')
            : (err.error?.message ?? 'Error al guardar la cita');
        this._snackBar.open(msg, 'Cerrar', { duration: 6000 });
      },
    });
  }

  cerrarModal(): void {
    this.dragTransition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    this.dragTransform = 'translateY(110%) scale(0.96)';
    this._cdr.markForCheck();

    setTimeout(() => this.dialogRef.close(), 350);
  }

  abrirFecha(input: HTMLInputElement) {
    input.showPicker();
  }

  seleccionarUsuario(usuario: any): void {
    const yaExiste = this.usuariosSeleccionados.find((u) => u.user_id === usuario.user_id);
    if (!yaExiste) {
      this.usuariosSeleccionados.push(usuario);
    }
    setTimeout(() => {
      this.busquedaUsuario = '';
      this.usuariosFiltrados = [...this.usuarios];
      this._cdr.detectChanges();
    });
  }

  removerUsuario(usuario: any): void {
    this.usuariosSeleccionados = this.usuariosSeleccionados.filter(
      (u) => u.user_id !== usuario.user_id,
    );
  }

  displayFn(): string {
    return ''; // Siempre muestra vacío tras seleccionar
  }

  filtrarUsuarios(): void {
    // Protección: si busquedaUsuario no es string, resetear
    if (typeof this.busquedaUsuario !== 'string') {
      this.busquedaUsuario = '';
      this.usuariosFiltrados = [...this.usuarios];
      return;
    }

    const valor = this.busquedaUsuario.toLowerCase();
    this.usuariosFiltrados = this.usuarios.filter((u) => u.nombre?.toLowerCase().includes(valor));
  }

  abrirAutocomplete() {
    if (this.autocomplete) {
      this.autocomplete.openPanel();
    }
  }

  toggleAutocomplete(): void {
    if (this.autocomplete.panelOpen) {
      this.autocomplete.closePanel();
    } else {
      this.inputNativeRef.nativeElement.focus();
      this.autocomplete.openPanel();
    }
  }

  toggleAutocomplete2(): void {
    if (this.autocomplete2.panelOpen) {
      this.autocomplete2.closePanel();
    } else {
      this.inputNativeRef2.nativeElement.focus();
      this.autocomplete2.openPanel();
    }
  }
}
