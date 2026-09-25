import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
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
import { ModalEscanerEmbarquesComponent, ScanFeedback } from 'app/modules/modals/Embarques/scanner-embarques-modal.component';
import { Subject, takeUntil } from 'rxjs';
import { ScanEmbarque } from '../scan-embarques.types';
import { ScanService } from '../scan.service';
import { ZebraScannerService } from '../zebra-scanner.service';
import { InventarioTabComponent } from './tabs/inventariotab.component';

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
    InventarioTabComponent,
    ModalEscanerEmbarquesComponent,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: fuseAnimations,
})
export class ScanListComponent implements OnInit, OnDestroy {
  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;
  @ViewChild('searchInputRef') searchInputRef!: ElementRef<HTMLInputElement>;
  private searchFocused = false;
  tabActiva: 'pendientes' | 'aprobadas' | 'inventario' = 'pendientes';
  searchControl = new FormControl('');
  scansFiltrados: ScanEmbarque[] = [];
  loading = false;
  ipLocal = '';
  tcpPort = APP_CONFIG.tcpPort ?? '5000';
  private audioDesbloqueado = false;
  private _destroy$ = new Subject<void>();
  scanControl = new FormControl('');
  escaneando = false;
  mostrarEscanerCamara = false;
  ultimoFeedbackCamara: ScanFeedback | null = null;
  totalEscaneadosCamara = 0;

  pageSize = 13;
  paginaActual = 0;

  constructor(
    protected _scanService: ScanService,
    private _cdr: ChangeDetectorRef,
    private _zone: NgZone,
    protected _zebraScanner: ZebraScannerService,
  ) {}

  async ngOnInit(): Promise<void> {
    setTimeout(() => {
      this._zebraScanner.init(this.scanInput?.nativeElement);
    }, 100);

    this._zebraScanner.scan$.pipe(takeUntil(this._destroy$)).subscribe((codigo) => {
      //console.log('📤 Barcode recibido:', codigo);
      this.scanControl.setValue(codigo);
      this.escaneando = true;
      this._cdr.markForCheck();

      this._scanService.enviarScan(codigo).subscribe({
        next: (res) => {
          this.scanControl.reset();
          this.escaneando = false;
          this._cdr.markForCheck();
          this._zebraScanner.focusInput(); // el servicio sabe si está pausado o no
        },
        error: (e) => {
          this.escaneando = false;
          this._cdr.markForCheck();
          this._zebraScanner.focusInput();
        },
      });
    });

    this._scanService.init();

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

    setTimeout(() => this.scanInput?.nativeElement.focus(), 300);
  }

  // getter calculado
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.scansFiltrados.length / this.pageSize));
  }

  get scansPaginados(): ScanEmbarque[] {
    const start = this.paginaActual * this.pageSize;
    return this.scansFiltrados.slice(start, start + this.pageSize);
  }

  irPagina(n: number): void {
    this.paginaActual = n;
    this._cdr.markForCheck();
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  cambiarTab(tab: 'pendientes' | 'aprobadas' | 'inventario'): void {
    this.tabActiva = tab;
    if (tab !== 'inventario') {
      this.aplicarFiltros(this._scanService['_scans$'].getValue());
    }
    this._cdr.markForCheck();
  }

  private aplicarFiltros(scans: ScanEmbarque[]): void {
    const tabMap = { pendientes: 0, aprobadas: 1 };
    const busqueda = (this.searchControl.value || '').toLowerCase();
    this.scansFiltrados = scans
      .filter((s) => s.PROCESADO === tabMap[this.tabActiva])
      .filter(
        (s) =>
          !busqueda ||
          s.CODIGO.toLowerCase().includes(busqueda) ||
          s.CODIGOENT.toString().includes(busqueda),
      );
    this.paginaActual = 0;
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  copiarIP(): void {
    const texto = `${this.ipLocal}:${this.tcpPort}`;
    navigator.clipboard.writeText(texto);
  }

  copiarPuerto(): void {
    navigator.clipboard.writeText(String(this.tcpPort));
  }

  onSearchFocus(): void {
    this._zebraScanner.pause();
  }

  onSearchBlur(): void {
    this._zebraScanner.resume();
  }

  abrirEscanerCamara(): void {
    this.ultimoFeedbackCamara = null;
    this.totalEscaneadosCamara = 0;
    this.mostrarEscanerCamara = true;
     this._cdr.markForCheck();
  }

  cerrarEscanerCamara(): void {
    this.mostrarEscanerCamara = false;
  }

  onCodigoEscaneadoCamara(codigo: string): void {
    this._scanService.enviarScan(codigo).subscribe({
      next: () => {
        this.totalEscaneadosCamara++;
        this.ultimoFeedbackCamara = { codigo, ok: true, mensaje: 'Registrado' };
        this._cdr.markForCheck();
      },
      error: (e) => {
        this.ultimoFeedbackCamara = {
          codigo,
          ok: false,
          mensaje: e?.error?.message ?? 'No se pudo registrar',
        };
        this._cdr.markForCheck();
      },
    });
  }
}
