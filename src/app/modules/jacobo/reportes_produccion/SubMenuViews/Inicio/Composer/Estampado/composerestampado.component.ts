import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { SharedDataService } from '../../../../list/shared-data.service';
import { ReportProdService } from 'app/modules/jacobo/reportes_produccion/reportprod.service';
import { ProduccionDia } from '../Tejido/composertejido.component';

@Component({
  selector: 'composer-estampado',
  templateUrl: './composerestampado.component.html',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatProgressSpinnerModule,
    MatButtonModule, MatDialogModule, MatDividerModule,
    MatTooltipModule, DatePipe, DecimalPipe,
  ],
})
export class ComposerEstampadoComponent implements OnInit, OnDestroy {
  private _unsub = new Subject<void>();

  datosPorDia: ProduccionDia[] = [];
  totalCantidad = 0;
  totalPiezas = 0;
  filtros: any = null;
  loading = true;

  constructor(
    private _sharedData: SharedDataService,
    private _reportService: ReportProdService,
    private _dialogRef: MatDialogRef<ComposerEstampadoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  ngOnInit(): void {
    this.filtros = this._sharedData.obtenerFiltros();

    const fechaInicio = this.filtros.fechaInicio
      ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fechaFin = this.filtros.fechaFin ?? new Date();

    setTimeout(() => {
      this._reportService.getEstampadoPorDia(fechaInicio, fechaFin)
        .pipe(takeUntil(this._unsub))
        .subscribe(datos => {
          this.datosPorDia = datos ?? [];
          this.totalCantidad = this.datosPorDia.reduce((a, b) => a + (b.CANTIDAD ?? 0), 0);
          this.totalPiezas   = this.datosPorDia.reduce((a, b) => a + (b.PIEZAS ?? 0), 0);
          this.loading = false;
        });
    });
  }

  ngOnDestroy(): void { this._unsub.next(); this._unsub.complete(); }
  cerrar(): void { this._dialogRef.close(); }
  getPct(val: number): number {
    return this.totalCantidad ? (val / this.totalCantidad) * 100 : 0;
  }
}