import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ZebraScannerService } from 'app/modules/colaborador/scan/zebra-scanner.service';
import {
  ModalEscanerEmbarquesComponent,
  ScanFeedback,
} from 'app/modules/modals/Embarques/scanner-embarques-modal.component';
import { ModalEditCAComponent } from 'app/modules/modals/inventarios/correccionacabado/edit/edit_ca_modal.component';
import { Observable, Subject } from 'rxjs';
import { finalize, map, shareReplay, takeUntil, tap } from 'rxjs/operators';
import {
  CorreccionAcabadoError,
  CorreccionAcabadoResponse,
  CorreccionLocal,
  EditCAItem,
  EditCAResultado,
} from '../types/correccion acabado.type';
import { CorreccionAcabadoService } from './correccionacabado.service';

const MENSAJES_ERROR: Record<string, string> = {
  rollo_invalido: 'Rollo inválido',
  rollo_no_encontrado: 'No existe el rollo',
  rollo_eliminado: 'El rollo ya fue eliminado',
  pieza_no_encontrada: 'No existe esa pieza en esa OP',
  op_invalida: 'OP inválida',
};

@Component({
  selector: 'app-correccionacabado',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ModalEscanerEmbarquesComponent,
    ModalEditCAComponent,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './correccionacabado.component.html',
})
export class CorreccionAcabadoComponent implements OnInit, OnDestroy {
  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;

  historial: CorreccionLocal[] = [];
  itemEditando: EditCAItem | null = null;
  seleccionadoId: number | null = null;
  seleccionMovil = new Set<number>();
  guardando = false;
  eliminando = false;
  mostrarEscanerCamara = false;
  ultimoFeedbackCamara: ScanFeedback | null = null;
  totalEscaneadosCamara = 0;
  private _articulo$ = new Map<string, Observable<Partial<EditCAItem>>>();
  private _idCounter = 0;
  private _enVuelo = new Set<string>();
  private _feedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private _pressTimer: ReturnType<typeof setTimeout> | null = null;
  private _longPressDisparado = false;
  private _destroy$ = new Subject<void>();
  private _destroyed = false;

  constructor(
    protected _scanService: CorreccionAcabadoService,
    private _cdr: ChangeDetectorRef,
    private _ngZone: NgZone,
    protected _zebraScanner: ZebraScannerService,
  ) {}

  get modoSeleccion(): boolean {
    return this.seleccionMovil.size > 0;
  }

  get totalError(): number {
    return this.historial.filter((h) => h.estado === 'error').length;
  }

  ngOnInit(): void {
    setTimeout(() => this._zebraScanner.init(this.scanInput?.nativeElement), 100);

    this._zebraScanner.scan$.pipe(takeUntil(this._destroy$)).subscribe((codigo) => {
      this._ngZone.run(() => {
        this._zebraScanner.focusInput();
        this.procesarCodigo(codigo);
      });
    });

    setTimeout(() => this.scanInput?.nativeElement.focus(), 300);
  }

  ngOnDestroy(): void {
    this._destroyed = true;
    this._destroy$.next();
    this._destroy$.complete();
    if (this._feedbackTimeout) clearTimeout(this._feedbackTimeout);
    this._clearPressTimer();
  }

  // ------------------------------------------------------------------
  // Escaneo (pistola Zebra y cámara): un solo escaneo = rollo
  // ------------------------------------------------------------------

  procesarCodigo(codigoRaw: string): void {
    const codigo = (codigoRaw ?? '').trim();

    if (!/^\d{1,10}$/.test(codigo)) {
      this._notificar(codigo, false, 'Rollo inválido (solo números, máx. 10 dígitos)');
      return;
    }

    this._enviar(codigo);
  }

  buscarManual(opInput: HTMLInputElement, piezaInput: HTMLInputElement): void {
    const op = opInput.value.trim();
    const pieza = piezaInput.value.trim();

    if (!op) {
      this._notificar('Manual', false, 'Captura la OP');
      opInput.focus();
      return;
    }
    if (!pieza) {
      this._notificar('Manual', false, 'Captura el no. de rollo');
      piezaInput.focus();
      return;
    }
    if (!/^\d{1,10}$/.test(pieza)) {
      this._notificar(pieza, false, 'No. de rollo inválido (solo números)');
      return;
    }

    this._enviar(null, { op, pieza });

    // La OP se queda; solo se limpia el no. de rollo
    piezaInput.value = '';
    piezaInput.focus();
  }

  soloNumeros(input: HTMLInputElement): void {
    input.value = input.value.replace(/\D/g, '');
  }

  private _enviar(rolloClave: string | null, manual?: { op: string; pieza: string }): void {
    const etiqueta = manual ? `${manual.op} · ${manual.pieza}` : rolloClave!;
    const llave = manual ? `${manual.op}|${manual.pieza}` : rolloClave!;
    if (this._enVuelo.has(llave)) {
      this._notificar(etiqueta, false, 'Ya se está consultando');
      return;
    }
    this._enVuelo.add(llave);
    const item: CorreccionLocal = {
      id: ++this._idCounter,
      rollo: etiqueta,
      fecha: new Date(),
      estado: 'enviando',
      peso: 0,
    };
    this.historial = [item, ...this.historial];
    this._render();
    const peticion$ = manual
      ? this._scanService.escanearManual(manual.op, manual.pieza)
      : this._scanService.escanear(rolloClave!);
    peticion$
      .pipe(
        finalize(() => {
          this._enVuelo.delete(llave);
          this._render();
        }),
      )
      .subscribe({
        next: (res: CorreccionAcabadoResponse) => {
          this._actualizar(item.id, {
            estado: 'ok',
            rollo: res.rollo,
            op: res.op,
            pieza: res.pieza,
            datos: res.datos,
            peso: res.peso,
          });
          const opArt = (res.datos?.ORDEN ?? res.op ?? '').toString().trim();
          if (opArt) {
            this._articuloObs(opArt)
              .pipe(takeUntil(this._destroy$))
              .subscribe({ error: () => {} });
          }
          if (this.mostrarEscanerCamara) this.totalEscaneadosCamara++;
          this._notificar(res.rollo, true, `OP ${res.op} · Pieza ${res.pieza ?? '—'}`);
        },
        error: (e: HttpErrorResponse) => {
          const mensaje = this._mensajeError(e);
          this._actualizar(item.id, { estado: 'error', mensaje });
          this._notificar(etiqueta, false, mensaje);
        },
      });
  }

  private _mensajeError(e: HttpErrorResponse): string {
    const err = (e?.error ?? {}) as CorreccionAcabadoError;
    if (err.motivo === 'estatus_no_permitido') {
      return `La orden tiene estatus ${err.estatus ?? '—'}; solo se puede modificar con estatus 3`;
    }
    return (err.motivo && MENSAJES_ERROR[err.motivo]) || err.error || 'No se pudo consultar';
  }

  private _actualizar(id: number, cambios: Partial<CorreccionLocal>): void {
    this.historial = this.historial.map((h) => (h.id === id ? { ...h, ...cambios } : h));
    this._render();
  }

  private _notificar(codigo: string, ok: boolean, mensaje: string): void {
    if (this._feedbackTimeout) clearTimeout(this._feedbackTimeout);
    this.ultimoFeedbackCamara = { codigo, ok, mensaje };
    this._render();
    this._feedbackTimeout = setTimeout(() => {
      this.ultimoFeedbackCamara = null;
      this._feedbackTimeout = null;
      this._render();
    }, 2500);
  }

  // ------------------------------------------------------------------
  // Cámara
  // ------------------------------------------------------------------

  abrirEscanerCamara(): void {
    this.ultimoFeedbackCamara = null;
    this.totalEscaneadosCamara = 0;
    this.mostrarEscanerCamara = true;
    this._render();
  }

  cerrarEscanerCamara(): void {
    this.mostrarEscanerCamara = false;
    this._render();
  }

  onCodigoEscaneadoCamara(codigo: string): void {
    this.procesarCodigo(codigo);
  }

  // ------------------------------------------------------------------
  // Historial
  // ------------------------------------------------------------------

  quitar(item: CorreccionLocal): void {
    this.historial = this.historial.filter((h) => h.id !== item.id);
    this.seleccionMovil.delete(item.id);
    this._render();
  }

  limpiarHistorial(): void {
    this.historial = this.historial.filter((h) => h.estado === 'enviando');
    this.seleccionMovil = new Set();
    this._render();
  }

  trackById(_: number, item: CorreccionLocal): number {
    return item.id;
  }

  seleccionar(item: CorreccionLocal): void {
    this.seleccionadoId = item.id;
    this._render();
  }

  // ------------------------------------------------------------------
  // Edición
  // ------------------------------------------------------------------

  editar(item: CorreccionLocal): void {
    const op = (item.datos?.ORDEN ?? item.op ?? '').toString().trim();
    const rollo = item.rollo;
    const psdEstatus = item.datos?.PSD_ESTATUS;
    this.itemEditando = {
      rollo,
      op: item.op,
      pieza: item.pieza,
      articulo: item.datos?.ARTICULO ?? null,
      peso: item.peso,
      tara: item.datos?.TARA != null ? Number(item.datos.TARA) : 0,
      estatus: item.datos?.OE_ESTATUS ?? null,
      eliminado: psdEstatus != null && Number(psdEstatus) === 0,
    };
    this._render();
    if (!op) return;
    this._articuloObs(op)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (extra) => {
          if (this.itemEditando?.rollo !== rollo) return;
          this.itemEditando = { ...this.itemEditando, ...extra };
          this._render();
        },
        error: () => this._notificar(rollo, false, 'No se pudo cargar el artículo'),
      });
  }

  cerrarEdicion(): void {
    this.itemEditando = null;
    this._render();
  }

  guardarEdicion(res: EditCAResultado): void {
    const h = this.historial.find((x) => x.rollo === res.rollo);
    const previo = h ? { peso: h.peso, datos: h.datos } : null;
    if (h) {
      this._actualizar(h.id, {
        peso: res.kilogramos,
        datos: h.datos && {
          ...h.datos,
          'PESO NETO': res.kilogramos,
          PESO_BRUTO: res.pbruto,
          TARA: res.tara,
          PESO_LIBRAS: res.libras,
          LONGITUD: res.metros,
          LONG_YARDAS: res.yardas,
        },
      });
    }
    this.cerrarEdicion();
    this._notificar(res.rollo, true, 'Rollo actualizado');
    this._scanService
      .guardar({
        rollo: res.rollo,
        kilogramos: res.kilogramos,
        libras: res.libras,
        metros: res.metros,
        yardas: res.yardas,
        tara: res.tara,
        pbruto: res.pbruto,
      })
      .subscribe({
        error: (e: HttpErrorResponse) => {
          if (h && previo) this._actualizar(h.id, previo);
          this._notificar(res.rollo, false, this._mensajeError(e));
        },
      });
  }

  onEliminar(rollo: string): void {
    if (this.eliminando) return;
    this.eliminando = true;
    this._render();
    this._scanService
      .eliminar(rollo)
      .pipe(
        finalize(() => {
          this.eliminando = false;
          this._render();
        }),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (res) => {
          if (!res.ok) {
            this._notificar(rollo, false, 'No se pudo eliminar');
            return;
          }

          this.historial = this.historial.filter((h) => h.rollo !== rollo);
          this.cerrarEdicion();
          this._notificar(rollo, true, 'Rollo eliminado');
        },
        error: (e: HttpErrorResponse) => this._notificar(rollo, false, this._mensajeError(e)),
      });
  }

  private _articuloObs(op: string): Observable<Partial<EditCAItem>> {
    let o = this._articulo$.get(op);
    if (!o) {
      o = this._scanService.articulo(op).pipe(
        map((a) => ({
          articulo: a.articulo,
          ancho: a.ancho,
          anchoYds: a.ancho_yds,
          gramaje: a.gramaje,
          gramajeOz: a.gramaje_oz,
          rendimiento: a.rendimiento,
          rendimientoYdLb: a.rendimiento_yd_lb,
        })),
        tap({ error: () => this._articulo$.delete(op) }),
        shareReplay(1),
      );
      this._articulo$.set(op, o);
    }
    return o;
  }

  // ------------------------------------------------------------------
  // Selección múltiple (móvil)
  // ------------------------------------------------------------------

  onPressStart(item: CorreccionLocal): void {
    if (item.estado === 'enviando') return;
    this._longPressDisparado = false;
    this._clearPressTimer();
    this._pressTimer = setTimeout(() => {
      this._longPressDisparado = true;
      this._toggleSeleccion(item);
      navigator.vibrate?.(15);
    }, 500);
  }

  onPressEnd(): void {
    this._clearPressTimer();
  }

  onTapMovil(item: CorreccionLocal): void {
    if (this._longPressDisparado) {
      this._longPressDisparado = false;
      return;
    }
    if (this.modoSeleccion) {
      this._toggleSeleccion(item);
      return;
    }
    if (item.estado === 'ok') this.editar(item);
  }

  cancelarSeleccion(): void {
    this.seleccionMovil = new Set();
    this._render();
  }

  quitarSeleccionados(): void {
    const ids = this.seleccionMovil;
    this.historial = this.historial.filter((h) => !ids.has(h.id));
    this.seleccionMovil = new Set();
    this._render();
  }

  private _toggleSeleccion(item: CorreccionLocal): void {
    const s = new Set(this.seleccionMovil);
    if (!s.delete(item.id)) s.add(item.id);
    this.seleccionMovil = s;
    this._render();
  }

  private _clearPressTimer(): void {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer);
      this._pressTimer = null;
    }
  }

  private _render(): void {
    if (this._destroyed) return;
    this._ngZone.run(() => this._cdr.detectChanges());
  }
}
