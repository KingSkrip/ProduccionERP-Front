import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fuseAnimations } from '@fuse/animations';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Subject, takeUntil } from 'rxjs';
import { obtenerIPLocal } from '../ip.service';
import { ScanEmbarque } from '../scan-embarques.types';
import { ScanService } from '../scan.service';

@Component({
  selector: 'scan-list',
  templateUrl: './scanList.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatIconModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: fuseAnimations,
})
export class ScanListComponent implements OnInit, OnDestroy {
  tabActiva: 'pendientes' | 'aprobadas' | 'rechazadas' = 'pendientes';
  searchControl = new FormControl('');
  scansFiltrados: ScanEmbarque[] = [];
  loading = false;
  ipLocal = '';
  tcpPort = APP_CONFIG.tcpPort ?? '5000';

  private _destroy$ = new Subject<void>();

  constructor(
    protected _scanService: ScanService,
    private _cdr: ChangeDetectorRef,
    private _zone: NgZone,
  ) {}

  async ngOnInit(): Promise<void> {
    this._scanService.init();

    // IP sin bloquear el resto del init
    obtenerIPLocal().then((ip) => {
      this.ipLocal = ip;
      this._cdr.markForCheck();
    });

    this._scanService.scans$.pipe(takeUntil(this._destroy$)).subscribe((scans) => {
      this.aplicarFiltros(scans);
      this._cdr.markForCheck();
    });

    this.searchControl.valueChanges.pipe(takeUntil(this._destroy$)).subscribe(() => {
      this.aplicarFiltros(this._scanService['_scans$'].getValue());
      this._cdr.markForCheck();
    });

    this._scanService.loading$.pipe(takeUntil(this._destroy$)).subscribe((v) => {
      this.loading = v;
      this._cdr.markForCheck();
    });
  }

  cambiarTab(tab: 'pendientes' | 'aprobadas' | 'rechazadas'): void {
    this.tabActiva = tab;
    this.aplicarFiltros(this._scanService['_scans$'].getValue());
    this._cdr.markForCheck();
  }

  private aplicarFiltros(scans: ScanEmbarque[]): void {
    const tabMap = { pendientes: 0, aprobadas: 1, rechazadas: 2 };
    const busqueda = (this.searchControl.value || '').toLowerCase();
    this.scansFiltrados = scans
      .filter((s) => s.PROCESADO === tabMap[this.tabActiva])
      .filter(
        (s) =>
          !busqueda ||
          s.CODIGO.toLowerCase().includes(busqueda) ||
          s.CODIGOENT.toString().includes(busqueda),
      );
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  copiarIP(): void {
    const texto = `${this.ipLocal}:${this.tcpPort}`;
    navigator.clipboard.writeText(texto);
  }
}
