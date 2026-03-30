import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CitaPayload, CitasService } from 'app/modules/ViewAll/Citas/citas.service';

import { AuthService } from 'app/core/auth/auth.service';
import { RoleEnum } from 'app/core/auth/roles/dataroles';
import { Cita } from 'app/modules/ViewAll/Citas/Types/citas.types';
import { NotaAccesoModalComponent } from './Nota/nota.component';

@Component({
  selector: 'nueva-cita-modal',
  templateUrl: './nueva-cita-modal.component.html',
  styleUrls: ['./nueva-cita-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    FormsModule,
    CommonModule,
    // CitasAllUsersListComponent,
    // CitasProvedoresListComponent,
  ],

  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevaCitaModalComponent implements OnInit {
  formCita: Partial<Cita> = {};
  editandoCita: boolean = false;
  isProveedor = false;

  constructor(
    public dialogRef: MatDialogRef<NuevaCitaModalComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      fecha?: string;
      horaInicio?: string;
      horaFin?: string;
      cita?: Cita;
    },
    private _citasService: CitasService,
    private _snackBar: MatSnackBar,
    private _dialog: MatDialog,
    private _authService: AuthService,
  ) {
    if (data?.cita) {
      this.editandoCita = true;
      this.formCita = { ...data.cita };
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
    const roleId = user?.permissions?.[0];
    this.isProveedor = roleId === RoleEnum.PROVEDORES;
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  guardarCita(): void {
    const normalizarHora = (h: string = '') => h.slice(0, 5);

    const payload: CitaPayload = {
      fecha: this.formCita.fecha!,
      hora_inicio: normalizarHora(this.formCita.horaInicio),
      hora_fin: normalizarHora(this.formCita.horaFin),
      nombre_visitante: this.formCita.paciente,
      motivo: this.formCita.motivo,
      estado: this.formCita.estado,
      notas: this.formCita.notas,
    };

    const request$ = this.editandoCita
      ? this._citasService.updateCita(this.formCita.id!, payload)
      : this._citasService.createCita(payload);

    request$.subscribe({
      next: () => {
        this._snackBar.open(this.editandoCita ? 'Cita actualizada ✓' : 'Cita creada ✓', 'OK', {
          duration: 3000,
        });

        // 👇 NUEVO: abrir modal con la nota
        this._dialog.open(NotaAccesoModalComponent, {
          width: '400px',
          panelClass: 'day-citas-modal-panel',
        });

        this.dialogRef.close({ success: true });
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al guardar la cita';
        this._snackBar.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  cerrarModal(): void {
    this._dialog.closeAll();
  }
}
