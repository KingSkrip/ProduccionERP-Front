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
import { FormControl, FormsModule } from '@angular/forms';
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
import { AgendaService } from 'app/modules/ViewAll/Agenda/agenda.service';
import { Cita } from 'app/modules/ViewAll/Agenda/Types/agenda.types';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
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
  selector: 'all-users-nueva-cita-modal',
  templateUrl: './all-users-nueva-cita-modal.component.html',
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
export class AllUsersNuevaCitaModalComponent implements OnInit {
  @ViewChild('inputNative2') inputNativeRef2!: ElementRef<HTMLInputElement>;
  @ViewChild('inputNative') inputNativeRef!: ElementRef<HTMLInputElement>;
  @ViewChild('inputAuto2') autocomplete2!: MatAutocompleteTrigger;
  @ViewChild('inputAuto') autocomplete!: MatAutocompleteTrigger;
  @ViewChild('inputNative3') inputNativeRef3!: ElementRef<HTMLInputElement>;
  @ViewChild('inputNative4') inputNativeRef4!: ElementRef<HTMLInputElement>;
  @ViewChild('inputAuto3') autocomplete3!: MatAutocompleteTrigger;
  @ViewChild('inputAuto4') autocomplete4!: MatAutocompleteTrigger;
  tipoFormulario: 'cita' | 'junta' = 'cita';
  formCita: Partial<Cita> = {};
  juntaSearchCtrl = new FormControl('');
  private _juntaSearch$ = new Subject<string>();
  editandoCita: boolean = false;
  isProveedor = false;
  usuariosSeleccionados: any[] = [];
  usuarios: any[] = [];
  busquedaUsuario: string = '';
  usuariosFiltrados: any[] = [];
  isDragging = false;
  dragTransform = 'translateY(0)';
  tipoFormularioFijo: boolean = false;
  usaVehiculo: boolean = false;
  dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
  private _citaIds: number[] = [];
  private _visitantesIdsIniciales: number[] = [];
  private _conVehiculoInicial: boolean = false;
  private _touchStartY = 0;
  usuariosInternos: any[] = [];
  private _dragY = 0;
  private readonly DISMISS_THRESHOLD = 140;
  constructor(
    public dialogRef: MatDialogRef<NuevaCitaModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private _citasService: AgendaService,
    private _snackBar: MatSnackBar,
    private _dialog: MatDialog,
    private _authService: AuthService,
    private _cdr: ChangeDetectorRef,
  ) {
    if (data?.cita) {
      this.editandoCita = true;

      // ← NUEVO: detectar tipo por cita_type_id
      this.tipoFormulario = data.cita.cita_type_id === 2 ? 'junta' : 'cita';
      this.tipoFormularioFijo = true; // bloquear los tabs al editar

      const trimHora = (h: string = '') => h?.slice(0, 5) ?? '';
      this.formCita = {
        fecha: data.cita.fecha,
        horaInicio: trimHora(data.cita.horaInicio ?? data.cita.hora_inicio),
        horaFin: trimHora(data.cita.horaFin ?? data.cita.hora_fin),
        lugar: data.cita.sala ?? '',
        motivo: data.cita.motivo,
        estado: data.cita.estado,
        notas: data.cita.notas,
      };

      if (this.tipoFormulario === 'junta') {
        const visitantesAgrupados = (data.cita.visitantes ?? []).filter((v: any) => v.id != null);

        if (visitantesAgrupados.length > 0) {
          this._visitantesIdsIniciales = visitantesAgrupados.map((v: any) => v.id); // mysql_id
          this.usuariosSeleccionados = visitantesAgrupados.map((v: any) => ({
            mysql_id: v.id,
            nombre: v.nombre,
            // ← NUEVO: guarda el firebird_user_clave si viene en el objeto visitante
            firebird_user_clave: v.firebird_user_clave ?? null,
            id: v.firebird_user_clave ?? null,
          }));
        } else if (data.cita.id_visitante) {
          this._visitantesIdsIniciales = [data.cita.id_visitante];
          this.usuariosSeleccionados = [
            {
              mysql_id: data.cita.id_visitante,
              firebird_user_clave: data.cita.visitante?.firebird_user_clave,
              id: data.cita.visitante?.firebird_user_clave,
              nombre: data.cita.nombre_visitante,
            },
          ];
        }
      }

      this._conVehiculoInicial =
        data.cita.con_vehiculo === 1 ||
        data.cita.con_vehiculo === '1' ||
        data.cita.con_vehiculo === true;
      this._citaIds = data.cita.ids ?? [];

      if (this.tipoFormulario === 'cita') {
        this._visitantesIdsIniciales = (data.cita.visitantes ?? [])
          .filter((v: any) => v.id != null)
          .map((v: any) => v.id);

        if (this._visitantesIdsIniciales.length === 0) {
          const nombreExterno = data.cita.nombre_visitante ?? data.cita.paciente;
          if (nombreExterno) {
            this.busquedaUsuario = nombreExterno;
          }
        }
      }
    } else {
      this.editandoCita = false;
      this.tipoFormulario = 'cita';
      this.tipoFormularioFijo = false;
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
    this.usaVehiculo = this._conVehiculoInicial;
    this._cdr.markForCheck();

    const nombreExternoInicial = this.busquedaUsuario;

    // ── Usuarios para CITAS (proveedores/externos) ──
    // ── Usuarios para CITAS (proveedores/externos) ──
    this._citasService.getUsuariosPermitidosParaAllUsers().subscribe({
      next: (res) => {
        this.usuarios = res;
        this.usuariosFiltrados = res;

        // ← AGREGAR ESTE GUARD — no tocar seleccionados si es junta
        if (this.tipoFormulario !== 'junta') {
          if (this._visitantesIdsIniciales.length > 0) {
            this.usuariosSeleccionados = res.filter((u: any) =>
              this._visitantesIdsIniciales.includes(u.id),
            );
            if (this.usuariosSeleccionados.length > 0) {
              this.busquedaUsuario = '';
            }
          } else if (nombreExternoInicial) {
            this.busquedaUsuario = nombreExternoInicial;
            setTimeout(() => {
              if (this.inputNativeRef?.nativeElement) {
                this.inputNativeRef.nativeElement.value = nombreExternoInicial;
              }
              if (this.inputNativeRef2?.nativeElement) {
                this.inputNativeRef2.nativeElement.value = nombreExternoInicial;
              }
              this._cdr.detectChanges();
            }, 0);
          }
        }

        this._cdr.markForCheck();
      },
    });

    // ── Usuarios para JUNTAS (internos) ──
    this._citasService.getUsuariosDisponiblesJuntas('', 500).subscribe({
      next: (res) => {
        this.usuariosInternos = res;
        this.usuariosFiltrados = [...res];

        if (
          this.editandoCita &&
          this.tipoFormulario === 'junta' &&
          this._visitantesIdsIniciales.length > 0
        ) {
          const fromList = res.filter((u: any) =>
            this._visitantesIdsIniciales.includes(u.mysql_id),
          );
          if (fromList.length > 0) {
            this.usuariosSeleccionados = fromList;
          }
        }
        this._cdr.markForCheck();
      },
    });
    this._juntaSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => this._citasService.getUsuariosDisponiblesJuntas(q || '')),
      )
      .subscribe({
        next: (res) => {
          this.usuariosFiltrados = res;
          this._cdr.markForCheck();
        },
        error: console.error,
      });
  }

  ngOnDestroy(): void {
    this._juntaSearch$.complete();
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

  onTouchEnd(event: TouchEvent): void {
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

  // ==================== ACTIONS ====================

  // Nuevas propiedades (agrega junto a las existentes)
  modoExterno = false; // true cuando el texto escrito no coincide con nadie de la lista

  guardarCita(): void {
    const normalizarHora = (h: string = '') => h?.slice(0, 5) || '';

    if (this.tipoFormulario === 'junta') {
      // ── GUARDAR JUNTA ──
      if (this.usuariosSeleccionados.length === 0) {
        this._snackBar.open('Selecciona al menos un participante.', 'Cerrar', { duration: 4000 });
        return;
      }

      const payloadJunta: any = {
        fecha: this.formCita.fecha!,
        hora_inicio: normalizarHora(this.formCita.horaInicio),
        hora_fin: normalizarHora(this.formCita.horaFin),
        asunto: this.formCita.motivo,
        estado: this.formCita.estado,
        notas: this.formCita.notas,
        sala: this.formCita.lugar,
        participantes: this.usuariosSeleccionados
          .map((u) => Number(u.firebird_user_clave ?? u.id ?? u.mysql_id))
          .filter((n) => Number.isInteger(n) && n > 0),
      };

      const request$ = this.editandoCita
        ? this._citasService.updateJunta(this.data.cita.id, payloadJunta)
        : this._citasService.createJunta(payloadJunta);

      request$.subscribe({
        next: () => {
          this._snackBar.open(this.editandoCita ? 'Junta actualizada ✓' : 'Junta creada ✓', 'OK', {
            duration: 3000,
          });
          this.dialogRef.close({ success: true });
        },
        error: (err) => {
          const errores: string[] = err.error?.errores ?? [];
          const msg =
            errores.length > 0
              ? errores.join('\n')
              : (err.error?.message ?? 'Error al guardar la junta');
          this._snackBar.open(msg, 'Cerrar', { duration: 6000 });
        },
      });

      return;
    }

    // ── GUARDAR CITA (lógica original sin cambios) ──
    const tieneRegistrado = this.usuariosSeleccionados.length > 0;
    const nombreLibre = this.busquedaUsuario?.trim();
    const tieneExterno = !tieneRegistrado && nombreLibre.length > 0;

    if (!tieneRegistrado && !tieneExterno) {
      this._snackBar.open('Escribe o selecciona al menos un visitante.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    if (!this.editandoCita) {
      const fechaHoraInicio = new Date(
        `${this.formCita.fecha}T${normalizarHora(this.formCita.horaInicio)}:00`,
      );
      if (fechaHoraInicio <= new Date()) {
        this._snackBar.open('No puedes agendar citas en una fecha u hora que ya pasó.', 'Cerrar', {
          duration: 4000,
        });
        return;
      }
    }

    const payload: any = {
      ...(this.editandoCita ? { ids: this._citaIds } : {}),
      fecha: this.formCita.fecha!,
      hora_inicio: normalizarHora(this.formCita.horaInicio),
      hora_fin: normalizarHora(this.formCita.horaFin),
      motivo: this.formCita.motivo,
      estado: this.formCita.estado,
      notas: this.formCita.notas,
      con_vehiculo: this.usaVehiculo,
      ...(tieneExterno
        ? { nombre_visitante_externo: nombreLibre }
        : { visitantes: this.usuariosSeleccionados.map((u) => u.id) }),
    };

    const request$ = this.editandoCita
      ? this._citasService.updateCita(this.data.cita.id, payload)
      : this._citasService.createCita(payload);

    request$.subscribe({
      next: () => {
        this._snackBar.open(this.editandoCita ? 'Cita actualizada ✓' : 'Cita creada ✓', 'OK', {
          duration: 3000,
        });
        if (!this.editandoCita) {
          this._dialog.open(NotaAccesoModalComponent, {
            width: '400px',
            panelClass: 'day-citas-modal-panel',
            disableClose: true,
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
    const id = usuario.user_id ?? usuario.id;
    const yaExiste = this.usuariosSeleccionados.find((u) => u.mysql_id === usuario.mysql_id);
    if (!yaExiste) {
      this.usuariosSeleccionados.push(usuario);
    }

    setTimeout(() => {
      this.busquedaUsuario = '';

      // 👇 IMPORTANTE
      if (this.tipoFormulario === 'junta') {
        this.usuariosFiltrados = [...this.usuariosInternos];
      } else {
        this.usuariosFiltrados = [...this.usuarios];
      }

      this._cdr.detectChanges();
    });
  }

  // removerUsuario(usuario: any): void {
  //   const id = usuario.user_id ?? usuario.id;

  //   this.usuariosSeleccionados = this.usuariosSeleccionados.filter(
  //     (u) => (u.user_id ?? u.id) !== id,
  //   );
  // }

  removerUsuario(usuario: any): void {
    this.usuariosSeleccionados = this.usuariosSeleccionados.filter(
      (u) => u.mysql_id !== usuario.mysql_id,
    );
  }

  displayFn(): string {
    return '';
  }

  filtrarUsuarios(): void {
    if (typeof this.busquedaUsuario !== 'string') {
      this.busquedaUsuario = '';
      if (this.tipoFormulario === 'junta') {
        this.usuariosFiltrados = [...this.usuariosInternos];
      } else {
        this.usuariosFiltrados = [...this.usuarios];
      }
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

  // Horarios disponibles: 8am-6pm cada 30min, bloqueando 2pm-3pm
  readonly horasDisponibles: string[] = (() => {
    const horas: string[] = [];
    for (let h = 8; h < 18; h++) {
      for (const m of [0, 30]) {
        if (h === 14 || h === 15) continue;
        const hStr = h.toString().padStart(2, '0');
        const mStr = m.toString().padStart(2, '0');
        horas.push(`${hStr}:${mStr}`);
      }
    }
    horas.push('18:00');
    return horas;
  })();

  filtrarUsuariosInternos(): void {
    const valor = typeof this.busquedaUsuario === 'string' ? this.busquedaUsuario.trim() : '';

    if (!valor) {
      this.usuariosFiltrados = [...this.usuariosInternos];
      return;
    }

    this._juntaSearch$.next(valor);
  }

  toggleAutocomplete3(): void {
    if (this.autocomplete3.panelOpen) {
      this.autocomplete3.closePanel();
    } else {
      this.inputNativeRef3.nativeElement.focus();
      this.autocomplete3.openPanel();
    }
  }

  toggleAutocomplete4(): void {
    if (this.autocomplete4.panelOpen) {
      this.autocomplete4.closePanel();
    } else {
      this.inputNativeRef4.nativeElement.focus();
      this.autocomplete4.openPanel();
    }
  }
}
