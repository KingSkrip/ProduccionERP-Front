import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from 'app/core/auth/auth.service';
import { RoleEnum } from 'app/core/auth/roles/dataroles';

@Component({
  selector: 'nota-cita',
  templateUrl: './nota.component.html',
  styleUrls: ['./nota.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    FormsModule,
  ],
})
export class NotaAccesoModalComponent {
  isProveedor = false;

  constructor(
    private _authService: AuthService,
    private dialogRef: MatDialogRef<NotaAccesoModalComponent>,
  ) {}

  ngOnInit(): void {
    const user = this._authService.getUser();
    this.isProveedor = user?.permissions?.[0] === RoleEnum.PROVEDORES;
  }

  cerrar() {
    this.dialogRef.close();
  }
}
