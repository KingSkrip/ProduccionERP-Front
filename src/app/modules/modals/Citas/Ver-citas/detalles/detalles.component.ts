import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from 'app/core/auth/auth.service';
import { AgendaService } from 'app/modules/ViewAll/Agenda/agenda.service';
import { Cita } from 'app/modules/ViewAll/Agenda/Types/agenda.types';

@Component({
  selector: 'detalles',
  templateUrl: './detalles.component.html',
  styleUrls: ['./detalles.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
  ],
})
export class DetallesAccesoModalComponent implements OnInit {
  isMobile = false;
  isOpen = false;
  isProveedor = false;
  estadoSeleccionado: 'pendiente' | 'confirmada' | 'cancelada' = 'pendiente';
  guardando = false;
  asistenciaSeleccionada: 'confirmada' | 'rechazada' = 'rechazada';
  esParticipante = false;
  esJunta = false;
  participantes: any[] = [];

  constructor(
    private dialogRef: MatDialogRef<DetallesAccesoModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { cita: Cita; isProveedor?: boolean },
    private citasService: AgendaService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const asistenciaRaw = (this.data.cita as any).asistencia;
    this.isMobile = window.innerWidth < 768;
    this.isProveedor = this.data.isProveedor ?? false;
    this.estadoSeleccionado = this.data.cita.estado;
   this.asistenciaSeleccionada = asistenciaRaw === 'confirmada' ? 'confirmada' : 'rechazada';
    const user = this.authService.getUser();
    const miFirebirdId = user?.firebird_user_clave ?? user?.id;
    const cita = this.data.cita as any;
  //     console.log('asistencia raw:', cita.asistencia);
  // console.log('cita completa:', cita);
    this.esJunta = cita.cita_type_id === 2;
    if (this.esJunta) {
      this.participantes = (cita.visitantes ?? []).map((v: any) => ({
        nombre: v.nombre ?? cita.nombre_visitante,
        asistencia: v.asistencia ?? null,
      }));
      if (!this.participantes.length && cita.nombre_visitante) {
        this.participantes = [
          {
            nombre: cita.nombre_visitante,
            asistencia: cita.asistencia ?? null,
          },
        ];
      }
    }

    if (cita.cita_type_id === 2) {
      const miIdentityId = Number(user?.id);
      const visitanteMysqlId = cita.id_visitante;
      const organizadorMysqlId = cita.id_user;
      this.esParticipante =
        miIdentityId === visitanteMysqlId && miIdentityId !== organizadorMysqlId;
    }

    if (this.isMobile) {
      this.dialogRef.updateSize('100vw', '100dvh');
      requestAnimationFrame(() => {
        setTimeout(() => (this.isOpen = true), 10);
      });
    }
  }

  guardarEstado(): void {
    if (this.guardando) return;
    this.guardando = true;

    this.citasService.updateEstado(this.data.cita.id!, this.estadoSeleccionado).subscribe({
      next: () => {
        this.data.cita.estado = this.estadoSeleccionado;
        this.guardando = false;
        this.dialogRef.close({ estadoActualizado: this.estadoSeleccionado });
      },
      error: () => {
        this.guardando = false;
      },
    });
  }

  guardarAsistencia(): void {
    if (this.guardando) return;
    this.guardando = true;

    this.citasService
      .updateAsistenciaJunta(this.data.cita.id!, this.asistenciaSeleccionada)
      .subscribe({
        next: () => {
          this.guardando = false;
          this.dialogRef.close({ asistenciaActualizada: this.asistenciaSeleccionada });
        },
        error: () => {
          this.guardando = false;
        },
      });
  }

  cerrar(): void {
    if (this.isMobile) {
      this.isOpen = false;
      setTimeout(() => this.dialogRef.close(), 300);
    } else {
      this.dialogRef.close();
    }
  }
}
