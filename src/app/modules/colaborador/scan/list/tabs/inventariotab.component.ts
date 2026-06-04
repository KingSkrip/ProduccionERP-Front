import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { ScanService } from '../../scan.service';
import { ZebraScannerService } from '../../zebra-scanner.service';
import { ItemInventario } from '../../scan-embarques.types';


@Component({
  selector: 'inventario-tab',
  templateUrl: './inventarioTab.component.html',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, ReactiveFormsModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventarioTabComponent implements OnInit, OnDestroy {
  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;

  historial: ItemInventario[] = [];
  private _destroy$ = new Subject<void>();
  escaneando = false;

  constructor(
    private _scanService: ScanService,
    private _cdr: ChangeDetectorRef,
    private _zebraScanner: ZebraScannerService,
  ) {}

  get yaInventariados(): ItemInventario[] {
    return this.historial.filter((i) => i.estado === 'ya_inventariado');
  }

  get noInventariados(): ItemInventario[] {
    return this.historial.filter((i) => i.estado === 'no_inventariado');
  }

  ngOnInit(): void {
    // Reutiliza el mismo stream de escaneos de la Zebra
    this._zebraScanner.scan$.pipe(takeUntil(this._destroy$)).subscribe((codigo) => {
      if (this.escaneando) return; // evitar duplicados rápidos
      this.escaneando = true;

      this._scanService.verificarInventario(codigo).subscribe({
        next: () => {
          // 200 → no inventariado
          this.agregarAlHistorial(codigo, 'no_inventariado');
          this.escaneando = false;
          this._cdr.markForCheck();
          this._zebraScanner.focusInput();
        },
        error: (e) => {
          const estado =
            e.status === 409 ? 'ya_inventariado' : 'invalido';
          this.agregarAlHistorial(codigo, estado);
          this.escaneando = false;
          this._cdr.markForCheck();
          this._zebraScanner.focusInput();
        },
      });
    });
  }

  private agregarAlHistorial(
    codigo: string,
    estado: ItemInventario['estado'],
  ): void {
    // Prepend para que el más reciente quede arriba
    this.historial = [{ codigo, fechaHora: new Date(), estado }, ...this.historial];
  }

  limpiarHistorial(): void {
    this.historial = [];
    this._cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}