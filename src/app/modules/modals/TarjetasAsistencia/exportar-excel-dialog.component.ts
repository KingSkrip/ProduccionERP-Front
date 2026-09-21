import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { OpcionEmpleado, PermisosService } from 'app/modules/ViewAll/Permisos/permisos.service';
import { OpcionEmpresa, OpcionFiltro } from 'app/modules/ViewAll/Permisos/RH/rh.component';

export interface ExportarExcelDialogData {
  empresas: OpcionEmpresa[];
  areas: OpcionFiltro[];
  departamentos: OpcionFiltro[];
  turnos: OpcionFiltro[];
}

export interface ExportarExcelResultado {
  empresa?: string;
  areaId?: number;
  departamentoId?: number;
  turnoId?: number;
  identityId?: number;
}

@Component({
  selector: 'exportar-excel-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './exportar-excel-dialog.component.html',
  styleUrls: ['./exportar-excel-dialog.component.scss'],
})
export class ExportarExcelDialogComponent implements OnInit {
  empresa?: string;
  areaId?: number;
  departamentoId?: number;
  turnoId?: number;
  identityId?: number;

  empleados: OpcionEmpleado[] = [];
  cargandoEmpleados = false;

  constructor(
    public dialogRef: MatDialogRef<
      ExportarExcelDialogComponent,
      ExportarExcelResultado | undefined
    >,
    @Inject(MAT_DIALOG_DATA) public data: ExportarExcelDialogData,
    private permisosService: PermisosService,
  ) {}

  ngOnInit(): void {
    Promise.resolve().then(() => this.cargarEmpleados());
  }

  /** Se llama cada vez que cambia empresa/área/departamento/turno */
  onFiltroCambio(): void {
    this.identityId = undefined; // el trabajador elegido ya no es válido con el nuevo filtro
    this.cargarEmpleados();
  }

  private cargarEmpleados(): void {
    this.cargandoEmpleados = true;
    this.permisosService
      .listaEmpleados({
        empresa: this.empresa,
        areaId: this.areaId,
        departamentoId: this.departamentoId,
        turnoId: this.turnoId,
      })
      .subscribe({
        next: (lista) => {
          this.empleados = lista;
          this.cargandoEmpleados = false;
        },
        error: () => {
          this.empleados = [];
          this.cargandoEmpleados = false;
        },
      });
  }

  exportar(): void {
    this.dialogRef.close({
      empresa: this.empresa,
      areaId: this.areaId,
      identityId: this.identityId,
    });
  }
}
