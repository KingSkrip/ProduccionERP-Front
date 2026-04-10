import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Cita } from 'app/modules/ViewAll/Citas/Types/citas.types';

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
  ],
})
export class DetallesAccesoModalComponent {
  constructor(
    private dialogRef: MatDialogRef<DetallesAccesoModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { cita: Cita },
  ) {}

  cerrar() {
    this.dialogRef.close();
  }
}