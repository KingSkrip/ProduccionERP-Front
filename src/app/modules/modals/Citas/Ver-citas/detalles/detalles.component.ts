import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Cita } from 'app/modules/ViewAll/Citas/Types/citas.types';
import { CitasService } from 'app/modules/ViewAll/Citas/citas.service';

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

  constructor(
    private dialogRef: MatDialogRef<DetallesAccesoModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { cita: Cita; isProveedor?: boolean },
    private citasService: CitasService,
  ) {}

  ngOnInit(): void {
    this.isMobile = window.innerWidth < 768;
    this.isProveedor = this.data.isProveedor ?? false;
    this.estadoSeleccionado = this.data.cita.estado;

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

  cerrar(): void {
    if (this.isMobile) {
      this.isOpen = false;
      setTimeout(() => this.dialogRef.close(), 300);
    } else {
      this.dialogRef.close();
    }
  }
}
