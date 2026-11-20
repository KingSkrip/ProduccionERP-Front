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
import { Observable, of, Subject } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';

/**
 * Item de la cola local de escaneos (pistola o cámara) que todavía NO se
 * han guardado en el backend. El usuario decide, con el checkbox, cuáles
 * de estos se guardan al darle "Guardar".
 */
interface ScanPendienteLocal {
  id: number;
  codigo: string;
  fecha: Date;
  seleccionado: boolean;
  guardando: boolean;
  error?: string | null;
  peso: number;
  datos?: Record<string, any> | null;
}

/** Escaneo hecho en la pestaña Inventario, solo para comparar (no se guarda). */
interface ScanComparado {
  id: number;
  codigo: string;
  fecha: Date;
}

interface ScanPorAprobar extends ScanComparado {
  /** Estado si existe en BD pero no está aprobado (Pendiente/Rechazado) */
  estadoBackend: string | null;
}

type ResultadoEscaneo = 'agregado' | 'duplicado' | 'ya_inventariado' | 'no_encontrado' | 'error';
type FiltroComparacion = 'repetidos' | 'porAprobar';

@Component({
  selector: 'app-scaninventario_sincliente',
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
  templateUrl: './scaninventarios_sincliente.component.html',
})
export class ScanInventariosSinClienteComponent implements OnInit, OnDestroy {
  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;
  @ViewChild('searchInputRef') searchInputRef!: ElementRef<HTMLInputElement>;
  private searchFocused = false;
  tabActiva: 'pendientes' | 'aprobadas' | 'comparación' = 'pendientes';
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
  private _enVuelo = new Set<string>();
  pageSize = 13;
  paginaActual = 0;

  // --- Cola local de escaneos, pendientes de confirmar/guardar ---
  scansPendientesLocal: ScanPendienteLocal[] = [];
  guardandoSeleccionados = false;
  private _idLocalCounter = 0;

  // --- Aviso de código duplicado (ya registrado o ya en la cola local) ---
  avisoDuplicado: string | null = null;
  private _avisoDuplicadoTimeout: ReturnType<typeof setTimeout> | null = null;

  // --- Comparación de inventario (escaneos vs aprobados) ---
  @ViewChild('searchInputMobileRef') searchInputMobileRef?: ElementRef<HTMLInputElement>;
  mostrarBusquedaMovil = false;
  filtroComparacion: FiltroComparacion = 'repetidos';
  escaneadosComparacion: ScanComparado[] = [];
  repetidos: ScanComparado[] = [];
  porAprobar: ScanPorAprobar[] = [];
  private _idComparacionCounter = 0;

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
      this.scanControl.setValue(codigo);
      this.scanControl.reset();
      this._zebraScanner.focusInput();

      const enInventario = this.tabActiva === 'comparación';

      // Siempre se registra para comparar
      this._registrarParaComparacion(codigo, enInventario);

      // Consulta peso/datos al backend y encola en Pendientes (sin guardar)
      this._procesarEscaneo(codigo, !enInventario).subscribe((resultado) => {
        if (resultado === 'agregado') {
          this.escaneando = true;
          this._cdr.markForCheck();
          setTimeout(() => {
            this.escaneando = false;
            this._cdr.markForCheck();
          }, 150);
        }
      });
    });

    this._scanService.init();

    this._scanService.scans$.pipe(takeUntil(this._destroy$)).subscribe((scans) => {
      this.aplicarFiltros(scans);
      this.recalcularComparacion();
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

  cambiarTab(tab: 'pendientes' | 'aprobadas' | 'comparación'): void {
    this.tabActiva = tab;
    if (tab !== 'comparación') {
      this.aplicarFiltros(this._scanService['_scans$'].getValue());
    } else {
      this.recalcularComparacion();
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
    const enInventario = this.tabActiva === 'comparación';

    const comparacion = this._registrarParaComparacion(codigo, false);

    this._procesarEscaneo(codigo, false).subscribe((resultado) => {
      switch (resultado) {
        case 'agregado':
          this.totalEscaneadosCamara = enInventario
            ? this.escaneadosComparacion.length
            : this.totalEscaneadosCamara + 1;
          this.ultimoFeedbackCamara = { codigo, ok: true, mensaje: 'Agregado (sin guardar)' };
          break;
        case 'ya_inventariado':
          this.totalEscaneadosCamara = enInventario
            ? this.escaneadosComparacion.length
            : this.totalEscaneadosCamara;
          this.ultimoFeedbackCamara = enInventario
            ? { codigo, ok: true, mensaje: 'Repetido (ya aprobado)' }
            : { codigo, ok: false, mensaje: 'Ya inventariado' };
          break;
        case 'no_encontrado':
          this.ultimoFeedbackCamara = { codigo, ok: false, mensaje: 'No existe el rollo' };
          break;
        case 'error':
          this.ultimoFeedbackCamara = { codigo, ok: false, mensaje: 'Error al consultar' };
          break;
        default:
          // duplicado: ya estaba en la cola o ya guardado como pendiente
          this.ultimoFeedbackCamara =
            enInventario && comparacion === 'porAprobar'
              ? { codigo, ok: true, mensaje: 'Por aprobar' }
              : { codigo, ok: false, mensaje: 'Ya está registrado' };
      }
      this._cdr.markForCheck();
    });
  }

  // ------------------------------------------------------------------
  // Cola local de escaneos (pendientes de guardar)
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
          const motivo = e?.error?.motivo;
          item.error =
            motivo === 'ya_inventariado'
              ? 'Ya inventariado'
              : motivo === 'duplicado'
                ? 'Ya está guardado'
                : (e?.error?.message ?? 'No se pudo guardar');
          this._finalizarGuardadoSiTermino();
        },
      });
    });
  }

  private _finalizarGuardadoSiTermino(): void {
    this.guardandoSeleccionados = this.scansPendientesLocal.some((s) => s.guardando);
    this._cdr.markForCheck();
  }

  // ------------------------------------------------------------------
  // Comparación de inventario: escaneado vs aprobados
  // ------------------------------------------------------------------

  cambiarFiltroComparacion(filtro: FiltroComparacion): void {
    this.filtroComparacion = filtro;
    this._cdr.markForCheck();
  }

  limpiarComparacion(): void {
    this.escaneadosComparacion = [];
    this.recalcularComparacion();
    this._cdr.markForCheck();
  }

  quitarDeComparacion(item: ScanComparado): void {
    this.escaneadosComparacion = this.escaneadosComparacion.filter((s) => s.id !== item.id);
    this.recalcularComparacion();
    this._cdr.markForCheck();
  }

  private _registrarParaComparacion(
    codigoRaw: string,
    avisar = true,
  ): 'repetido' | 'porAprobar' | 'yaEscaneado' {
    const codigo = (codigoRaw ?? '').trim();

    if (this.escaneadosComparacion.some((s) => s.codigo === codigo)) {
      if (avisar) {
        this._mostrarAvisoDuplicado(codigo);
      }
      return 'yaEscaneado';
    }

    this.escaneadosComparacion = [
      { id: ++this._idComparacionCounter, codigo, fecha: new Date() },
      ...this.escaneadosComparacion,
    ];
    this.recalcularComparacion();
    this._cdr.markForCheck();

    return this.repetidos.some((c) => c.codigo === codigo) ? 'repetido' : 'porAprobar';
  }

  recalcularComparacion(): void {
    const todos: ScanEmbarque[] = this._scanService['_scans$'].getValue() ?? [];
    const aprobados = todos.filter((s) => s.PROCESADO === 1);
    const setAprobados = new Set(aprobados.map((s) => s.CODIGO));
    const porCodigo = new Map(todos.map((s) => [s.CODIGO, s]));
    this.repetidos = this.escaneadosComparacion.filter((e) => setAprobados.has(e.codigo));

    this.porAprobar = this.escaneadosComparacion
      .filter((e) => !setAprobados.has(e.codigo))
      .map((e) => {
        const existente = porCodigo.get(e.codigo);
        const estadoBackend =
          existente === undefined ? null : existente.PROCESADO === 0 ? 'Pendiente' : 'Rechazado';
        return { ...e, estadoBackend };
      });
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

  /**
   * Agrega el código a la cola local (sin guardar) si no existe ya.
   * Entra SIN seleccionar: el usuario elige cuáles guardar.
   */
  private _encolarLocal(
    codigoRaw: string,
    avisar = true,
    datos: Record<string, any> | null = null,
  ): 'agregado' | 'duplicado' {
    const codigo = (codigoRaw ?? '').trim();

    if (this._codigoYaRegistrado(codigo)) {
      if (avisar) {
        this._mostrarAvisoDuplicado(codigo);
      }
      return 'duplicado';
    }

    this.scansPendientesLocal = [
      {
        id: ++this._idLocalCounter,
        codigo,
        fecha: new Date(),
        seleccionado: false, // ← ya no entra seleccionado
        guardando: false,
        error: null,
        datos,
        peso: Number(datos?.['PESO NETO'] ?? 0),
      },
      ...this.scansPendientesLocal,
    ];
    this._cdr.markForCheck();
    return 'agregado';
  }

  /**
   * Flujo único para pistola y cámara:
   * 1) descarta duplicados locales o en vuelo (sin pegarle al backend)
   * 2) verificarInventario -> datos/peso desde PSDTABPZAS + chequeo en INVFISVSTEOPT
   * 3) encola en la cola local con los datos
   */
  private _procesarEscaneo(codigoRaw: string, avisar = true): Observable<ResultadoEscaneo> {
    const codigo = (codigoRaw ?? '').trim();

    if (this._enVuelo.has(codigo) || this._codigoYaRegistrado(codigo)) {
      if (avisar) {
        this._mostrarAvisoDuplicado(codigo);
      }
      return of<ResultadoEscaneo>('duplicado');
    }

    this._enVuelo.add(codigo);

    return this._scanService.verificarInventario(codigo).pipe(
      map((res): ResultadoEscaneo => {
        // Ya guardado como pendiente en INVFISVSTEOPT: no se vuelve a encolar
        if (res?.ya_pendiente) {
          if (avisar) {
            this._mostrarAvisoDuplicado(codigo);
          }
          return 'duplicado';
        }
        return this._encolarLocal(codigo, avisar, res?.datos ?? null);
      }),
      catchError((e) => {
        if (e?.status === 409) {
          if (avisar) {
            this._mostrarAvisoDuplicado(codigo);
          }
          return of<ResultadoEscaneo>('ya_inventariado');
        }
        if (e?.status === 404) {
          return of<ResultadoEscaneo>('no_encontrado');
        }
        return of<ResultadoEscaneo>('error');
      }),
      finalize(() => {
        this._enVuelo.delete(codigo);
        this._cdr.markForCheck();
      }),
    );
  }

  toggleBusquedaMovil(): void {
    this.mostrarBusquedaMovil = !this.mostrarBusquedaMovil;
    this._cdr.markForCheck();

    if (this.mostrarBusquedaMovil) {
      // esperamos a que el input exista en el DOM
      setTimeout(() => this.searchInputMobileRef?.nativeElement.focus(), 50);
    } else {
      this.searchControl.setValue('');
    }
  }

  onSearchBlurMovil(): void {
    this.onSearchBlur();
    // si lo dejó vacío, se oculta solo para recuperar el espacio
    if (!this.searchControl.value) {
      this.mostrarBusquedaMovil = false;
      this._cdr.markForCheck();
    }
  }

  get totalPendientesLocales(): number {
    return this.scansPendientesLocal.length;
  }

  get kilosPendientesLocales(): number {
    return this.scansPendientesLocal.reduce((acc, s) => acc + s.peso, 0);
  }

  get kilosSeleccionadosLocales(): number {
    return this.scansPendientesLocal
      .filter((s) => s.seleccionado)
      .reduce((acc, s) => acc + s.peso, 0);
  }

  get sinPesoLocales(): number {
    return this.scansPendientesLocal.filter((s) => !s.datos).length;
  }
}