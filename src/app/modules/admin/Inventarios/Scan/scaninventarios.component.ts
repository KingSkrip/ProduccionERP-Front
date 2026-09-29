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
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fuseAnimations } from '@fuse/animations';
import { APP_CONFIG } from 'app/core/config/app-config';
import { ScanEmbarque } from 'app/modules/colaborador/scan/scan-embarques.types';
import { ScanService } from 'app/modules/colaborador/scan/scan.service';
import { ZebraScannerService } from 'app/modules/colaborador/scan/zebra-scanner.service';
import {
  ModalEscanerEmbarquesComponent,
  ScanFeedback,
} from 'app/modules/modals/Embarques/scanner-embarques-modal.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Item de la cola local de escaneos hechos con el lector (Zebra) que
 * todavía NO se han guardado en el backend. El usuario decide, con el
 * checkbox, cuáles de estos se guardan al darle "Guardar".
 */
interface ScanPendienteLocal {
  id: number;
  codigo: string;
  fecha: Date;
  seleccionado: boolean;
  guardando: boolean;
  error?: string | null;
}

@Component({
  selector: 'app-scaninventario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSelectModule,
    ReactiveFormsModule,
    ModalEscanerEmbarquesComponent,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: fuseAnimations,
  templateUrl: './Scaninventarios.component.html',
})
export class ScanInventariosComponent implements OnInit, OnDestroy {
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

  // --- Cola local de escaneos del lector, pendientes de confirmar/guardar ---
  scansPendientesLocal: ScanPendienteLocal[] = [];
  guardandoSeleccionados = false;
  private _idLocalCounter = 0;

  // --- Aviso de código duplicado (ya registrado o ya en la cola local) ---
  avisoDuplicado: string | null = null;
  private _avisoDuplicadoTimeout: ReturnType<typeof setTimeout> | null = null;

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
      this.scanControl.reset();
      this._zebraScanner.focusInput();

      // Si el código ya existe en el backend (pendiente, aprobada o rechazada)
      // o ya está en la cola local sin guardar, no se agrega de nuevo.
      if (this._codigoYaRegistrado(codigo)) {
        this._mostrarAvisoDuplicado(codigo);
        return;
      }

      // Ya NO se guarda automáticamente en el backend. Se agrega a la
      // cola local para que el usuario revise/seleccione y confirme.
      this.escaneando = true;
      this._cdr.markForCheck();

      this.scansPendientesLocal = [
        {
          id: ++this._idLocalCounter,
          codigo,
          fecha: new Date(),
          seleccionado: true,
          guardando: false,
          error: null,
        },
        ...this.scansPendientesLocal,
      ];

      // Pequeño feedback visual de "se escaneó", ya no depende de la respuesta del servidor
      setTimeout(() => {
        this.escaneando = false;
        this._cdr.markForCheck();
      }, 150);

      this._cdr.markForCheck();
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
    if (this._avisoDuplicadoTimeout) {
      clearTimeout(this._avisoDuplicadoTimeout);
    }
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

  // ------------------------------------------------------------------
  // Cola local de escaneos del lector (pendientes de guardar)
  // ------------------------------------------------------------------

  toggleSeleccionLocal(item: ScanPendienteLocal): void {
    item.seleccionado = !item.seleccionado;
    this._cdr.markForCheck();
  }

  get todosLocalesSeleccionados(): boolean {
    return (
      this.scansPendientesLocal.length > 0 && this.scansPendientesLocal.every((s) => s.seleccionado)
    );
  }

  toggleSeleccionarTodosLocales(): void {
    const nuevoValor = !this.todosLocalesSeleccionados;
    this.scansPendientesLocal.forEach((s) => (s.seleccionado = nuevoValor));
    this._cdr.markForCheck();
  }

  get totalSeleccionadosLocales(): number {
    return this.scansPendientesLocal.filter((s) => s.seleccionado).length;
  }

  quitarLocal(item: ScanPendienteLocal): void {
    this.scansPendientesLocal = this.scansPendientesLocal.filter((s) => s.id !== item.id);
    this._cdr.markForCheck();
  }

  limpiarPendientesLocales(): void {
    this.scansPendientesLocal = [];
    this._cdr.markForCheck();
  }

  guardarSeleccionadosLocales(): void {
    const seleccionados = this.scansPendientesLocal.filter((s) => s.seleccionado && !s.guardando);
    if (seleccionados.length === 0) {
      return;
    }

    this.guardandoSeleccionados = true;
    seleccionados.forEach((item) => {
      item.guardando = true;
      item.error = null;
    });
    this._cdr.markForCheck();

    seleccionados.forEach((item) => {
      this._scanService.enviarScan(item.codigo).subscribe({
        next: () => {
          // Al guardarse, sale de la cola local (el listado "Pendientes" real
          // se actualizará solo vía scans$)
          this.scansPendientesLocal = this.scansPendientesLocal.filter((s) => s.id !== item.id);
          this._finalizarGuardadoSiTermino();
        },
        error: (e) => {
          item.guardando = false;
          item.error = e?.error?.message ?? 'No se pudo guardar';
          this._finalizarGuardadoSiTermino();
        },
      });
    });
  }

  private _finalizarGuardadoSiTermino(): void {
    this.guardandoSeleccionados = this.scansPendientesLocal.some((s) => s.guardando);
    this._cdr.markForCheck();
  }

  /**
   * true si el código ya existe en el backend (sin importar el estado:
   * pendiente/aprobada/rechazada) o ya está en la cola local sin guardar.
   */
  private _codigoYaRegistrado(codigo: string): boolean {
    const yaEnLocal = this.scansPendientesLocal.some((s) => s.codigo === codigo);
    if (yaEnLocal) {
      return true;
    }

    const todosLosScans: ScanEmbarque[] = this._scanService['_scans$'].getValue() ?? [];
    return todosLosScans.some((s) => s.CODIGO === codigo);
  }

  private _mostrarAvisoDuplicado(codigo: string): void {
    if (this._avisoDuplicadoTimeout) {
      clearTimeout(this._avisoDuplicadoTimeout);
    }

    this.avisoDuplicado = codigo;
    this._cdr.markForCheck();

    this._avisoDuplicadoTimeout = setTimeout(() => {
      this.avisoDuplicado = null;
      this._avisoDuplicadoTimeout = null;
      this._cdr.markForCheck();
    }, 2500);
  }
}
