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
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from 'app/core/auth/auth.service';
import { RoleEnum } from 'app/core/auth/roles/dataroles';
import { AllUsersNuevaCitaModalComponent } from './allusers/all-users-nueva-cita-modal.component';
import { NotaAccesoModalComponent } from './Nota/nota.component';
import { ProvedoresNuevaCitaModalComponent } from './provedores/provedores-nueva-cita-modal.component';
import { AgendaService, CitaPayload } from 'app/modules/ViewAll/Agenda/agenda.service';
import { Cita } from 'app/modules/ViewAll/Agenda/Types/agenda.types';

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
  selector: 'nueva-cita-modal',
  templateUrl: './nueva-cita-modal.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormsModule,
    AllUsersNuevaCitaModalComponent,
    ProvedoresNuevaCitaModalComponent,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [slideUp],
})
export class NuevaCitaModalComponent implements OnInit {
  private _dragY = 0;
  isDragging = false;
  isProveedor = false;
  private _touchStartY = 0;
  formCita: Partial<Cita> = {};
  editandoCita: boolean = false;
  dragTransform = 'translateY(0)';
  private readonly DISMISS_THRESHOLD = 140;
  dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
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
    this.isProveedor = user?.permissions?.[0] === RoleEnum.PROVEDORES;
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

  guardarCita(): void {
    const normalizarHora = (h: string = '') => h?.slice(0, 5) || '';
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

        this._dialog.open(NotaAccesoModalComponent, {
          width: '400px',
          panelClass: 'day-citas-modal-panel',
          disableClose: true,
        });
        this.dialogRef.close({ success: true });
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al guardar la cita';
        this._snackBar.open(msg, 'Cerrar', { duration: 4500 });
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
}
