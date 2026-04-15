import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
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
import { CitasService } from 'app/modules/ViewAll/Citas/citas.service';
import { Cita } from 'app/modules/ViewAll/Citas/Types/citas.types';

import { Subject, takeUntil } from 'rxjs';
import { DetallesAccesoModalComponent } from './detalles/detalles.component';

@Component({
  selector: 'day-citas-modal',
  templateUrl: './day-citas-modal.component.html',
  styleUrls: ['./day-citas-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
  ],
})
export class DayCitasModalComponent {
  private _unsubscribeAll = new Subject<void>();

  touchStartX: number = 0;
  touchEndX: number = 0;
  citas: Cita[] = [];
  animacionClase: string = '';
  loading: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<DayCitasModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { fecha: string; citas: Cita[] },
    private _citasService: CitasService,
    private _snackBar: MatSnackBar,
    private _dialog: MatDialog,
  ) {
    this.citas = data.citas || [];
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  editarCita(cita: Cita): void {
    if (this.esFechaPasada()) return;

    if (cita.esExterna) {
      this._dialog
        .open(DetallesAccesoModalComponent, {
          width: '480px',
          maxWidth: '100vw',
          panelClass: ['modal-cita-panel', 'modal-cita-panel--responsive'],
          data: { cita },
        })
        .afterClosed()
        .subscribe((result) => {
          if (result?.estadoActualizado) {
            cita.estado = result.estadoActualizado;
          }
        });
      return;
    }

    this.dialogRef.close({ action: 'edit', cita });
  }

  agregarNuevaCita(): void {
    if (this.esFechaPasada()) return;
    this.dialogRef.close({ action: 'add', fecha: this.data.fecha });
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  handleSwipe(): void {
    const delta = this.touchEndX - this.touchStartX;
    if (Math.abs(delta) < 50) return;

    if (delta > 0) {
      this.animarCambio('right');
      this.cambiarDia(-1);
    } else {
      this.animarCambio('left');
      this.cambiarDia(1);
    }
  }

  cambiarDia(dias: number): void {
    const partes = this.data.fecha.split('-');
    const fechaActual = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    fechaActual.setDate(fechaActual.getDate() + dias);
    const nuevaFecha = fechaActual.toISOString().split('T')[0];

    // Cambio inmediato
    this.data.fecha = nuevaFecha;
    this.citas = [];
    this.loading = true;

    this._citasService.getCitasPorFecha(nuevaFecha).subscribe({
      next: (citasAPI) => {
        const filtradas = citasAPI.filter((c) => c.fecha === nuevaFecha);

        this.citas = filtradas.map((c) => ({
          id: c.id,
          id_visitante: c.id_visitante,
          paciente: c.nombre_visitante || c.visitante?.nombre || 'Sin nombre',
          fecha: c.fecha,
          horaInicio: c.hora_inicio,
          horaFin: c.hora_fin,
          motivo: c.motivo,
          estado: c.estado,
        }));
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar citas:', err);
        this.loading = false;
        this._snackBar.open('Error al cargar las citas', 'OK', { duration: 3000 });
      },
    });
  }

  animarCambio(direccion: 'left' | 'right') {
    this.animacionClase = direccion === 'left' ? 'slide-left' : 'slide-right';
    setTimeout(() => {
      this.animacionClase = '';
    }, 250);
  }

  // Métodos que ya tenías (por si los usas en otro lado)
  confirmarCita(cita: Cita): void {
    this._citasService
      .updateEstado(cita.id!, 'confirmada')
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(() => {
        cita.estado = 'confirmada';
        this._snackBar.open('Cita confirmada ✓', 'OK', { duration: 3000 });
      });
  }

  cancelarCita(cita: Cita): void {
    this._citasService
      .updateEstado(cita.id!, 'cancelada')
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(() => {
        cita.estado = 'cancelada';
        this._snackBar.open('Cita cancelada', 'OK', { duration: 3000 });
      });
  }

  get fechaFormateada(): string {
    const partes = this.data.fecha.split('-');
    const d = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    const meses = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    return `${d.getDate()} ${meses[d.getMonth()]}`;
  }

  get diaSemanaFormateado(): string {
    const partes = this.data.fecha.split('-');
    const d = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[d.getDay()];
  }

  esFechaPasada(): boolean {
    const partes = this.data.fecha.split('-');
    const fecha = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fecha < hoy;
  }
}
