import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ZebraScannerService } from 'app/modules/colaborador/scan/zebra-scanner.service';
import {
  ModalEscanerEmbarquesComponent,
  ScanFeedback,
} from 'app/modules/modals/Embarques/scanner-embarques-modal.component';
import { Observable, Subject } from 'rxjs';
import { finalize, map, shareReplay, takeUntil, tap } from 'rxjs/operators';

import { ModalEditCAComponent } from 'app/modules/modals/inventarios/correccionacabado/edit/edit_ca_modal.component';
import {
  CorreccionAcabadoError,
  CorreccionAcabadoResponse,
  EditCAItem,
  EditCAResultado,
  RolloAcabadoDatos,
} from '../types/correccion acabado.type';
import { CorreccionAcabadoService } from './correccionacabado.service';

type EstadoEnvio = 'enviando' | 'ok' | 'error';

/** Un rollo escaneado y el resultado de consultarlo en el backend. */
interface CorreccionLocal {
  id: number;
  rollo: string;
  op?: string | null;
  pieza?: number | string | null;
  fecha: Date;
  estado: EstadoEnvio;
  mensaje?: string | null;
  datos?: RolloAcabadoDatos | null;
  peso: number;
}

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
  guardando = false;
  eliminando = false;
  // --- Cámara ---
  mostrarEscanerCamara = false;
  ultimoFeedbackCamara: ScanFeedback | null = null;
  totalEscaneadosCamara = 0;
  private _articulo$ = new Map<string, Observable<Partial<EditCAItem>>>();
  private _articuloCache = new Map<string, Partial<EditCAItem>>();
  private _articuloEnVuelo = new Set<string>();
  private _idCounter = 0;
  private _enVuelo = new Set<string>();
  private _feedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private _destroy$ = new Subject<void>();

  constructor(
    protected _scanService: CorreccionAcabadoService,
    private _cdr: ChangeDetectorRef,
    protected _zebraScanner: ZebraScannerService,
  ) {}

  ngOnInit(): void {
    setTimeout(() => {
      this._zebraScanner.init(this.scanInput?.nativeElement);
    }, 100);

    this._zebraScanner.scan$.pipe(takeUntil(this._destroy$)).subscribe((codigo) => {
      this._zebraScanner.focusInput();
      this.procesarCodigo(codigo);
    });

    setTimeout(() => this.scanInput?.nativeElement.focus(), 300);
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._feedbackTimeout) {
      clearTimeout(this._feedbackTimeout);
    }
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

  private _enviar(rollo: string): void {
    if (this._enVuelo.has(rollo)) {
      this._notificar(rollo, false, 'Ya se está consultando');
      return;
    }

    this._enVuelo.add(rollo);

    const item: CorreccionLocal = {
      id: ++this._idCounter,
      rollo,
      fecha: new Date(),
      estado: 'enviando',
      peso: 0,
    };
    this.historial = [item, ...this.historial];
    this._cdr.markForCheck();

    this._scanService
      .escanear(rollo)
      .pipe(
        finalize(() => {
          this._enVuelo.delete(rollo);
          this._cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res: CorreccionAcabadoResponse) => {
          this._actualizar(item.id, {
            estado: 'ok',
            op: res.op,
            pieza: res.pieza,
            datos: res.datos,
            peso: res.peso,
          });

          // Precarga el artículo para que "Editar" abra instantáneo
          const op = (res.datos?.ORDEN ?? res.op ?? '').toString().trim();
          if (op)
            this._articuloObs(op)
              .pipe(takeUntil(this._destroy$))
              .subscribe({ error: () => {} });

          if (this.mostrarEscanerCamara) {
            this.totalEscaneadosCamara++;
          }
          this._notificar(rollo, true, `OP ${res.op} · Pieza ${res.pieza ?? '—'}`);
        },
        error: (e: HttpErrorResponse) => {
          const mensaje = this._mensajeError(e);
          this._actualizar(item.id, { estado: 'error', mensaje });
          this._notificar(rollo, false, mensaje);
        },
      });
  }

  private _mensajeError(e: HttpErrorResponse): string {
    const err = (e?.error ?? {}) as CorreccionAcabadoError;

    switch (err.motivo) {
      case 'rollo_invalido':
        return 'Rollo inválido';
      case 'rollo_no_encontrado':
        return 'No existe el rollo';
      case 'estatus_no_permitido':
        return `La orden tiene estatus ${err.estatus ?? '—'}; solo se puede modificar con estatus 3`;
      default:
        return err.error ?? 'No se pudo consultar';
    }
  }

  private _actualizar(id: number, cambios: Partial<CorreccionLocal>): void {
    this.historial = this.historial.map((h) => (h.id === id ? { ...h, ...cambios } : h));
    this._cdr.markForCheck();
  }

  private _notificar(codigo: string, ok: boolean, mensaje: string): void {
    if (this._feedbackTimeout) {
      clearTimeout(this._feedbackTimeout);
    }

    this.ultimoFeedbackCamara = { codigo, ok, mensaje };
    this._cdr.markForCheck();

    this._feedbackTimeout = setTimeout(() => {
      this.ultimoFeedbackCamara = null;
      this._feedbackTimeout = null;
      this._cdr.markForCheck();
    }, 2500);
  }

  // ------------------------------------------------------------------
  // Cámara
  // ------------------------------------------------------------------

  abrirEscanerCamara(): void {
    this.ultimoFeedbackCamara = null;
    this.totalEscaneadosCamara = 0;
    this.mostrarEscanerCamara = true;
    this._cdr.markForCheck();
  }

  cerrarEscanerCamara(): void {
    this.mostrarEscanerCamara = false;
    this._cdr.markForCheck();
  }

  onCodigoEscaneadoCamara(codigo: string): void {
    this.procesarCodigo(codigo);
  }

  // ------------------------------------------------------------------
  // Historial
  // ------------------------------------------------------------------

  quitar(item: CorreccionLocal): void {
    this.historial = this.historial.filter((h) => h.id !== item.id);
    this._cdr.markForCheck();
  }

  limpiarHistorial(): void {
    this.historial = this.historial.filter((h) => h.estado === 'enviando');
    this._cdr.markForCheck();
  }

  trackById(_: number, item: CorreccionLocal): number {
    return item.id;
  }

  get totalOk(): number {
    return this.historial.filter((h) => h.estado === 'ok').length;
  }

  get totalError(): number {
    return this.historial.filter((h) => h.estado === 'error').length;
  }

  get kilosOk(): number {
    return this.historial.filter((h) => h.estado === 'ok').reduce((acc, h) => acc + h.peso, 0);
  }

  editar(item: CorreccionLocal): void {
    const op = (item.datos?.ORDEN ?? item.op ?? '').toString().trim();
    const rollo = item.rollo;

    this.itemEditando = {
      rollo,
      op: item.op,
      pieza: item.pieza,
      articulo: item.datos?.ARTICULO ?? null,
      peso: item.peso,
      tara: item.datos?.TARA != null ? Number(item.datos.TARA) : 0,
      estatus: item.datos?.OE_ESTATUS ?? null,
    };

    this._cdr.markForCheck();
    if (!op) return;

    this._articuloObs(op)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (extra) => {
          if (this.itemEditando?.rollo !== rollo) return;
          this.itemEditando = { ...this.itemEditando, ...extra };
          this._cdr.markForCheck();
        },
        error: () => this._notificar(rollo, false, 'No se pudo cargar el artículo'),
      });
  }

  cerrarEdicion(): void {
    this.itemEditando = null;
    this._cdr.markForCheck();
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

  seleccionar(item: CorreccionLocal): void {
    this.seleccionadoId = item.id;
    this._cdr.markForCheck();
  }

  private _cargarArticulo(
    op: string,
    alTerminar?: (extra: Partial<EditCAItem> | null) => void,
  ): void {
    const cached = this._articuloCache.get(op);
    if (cached) {
      alTerminar?.(cached);
      return;
    }
    if (this._articuloEnVuelo.has(op)) {
      return;
    }

    this._articuloEnVuelo.add(op);
    this._scanService
      .articulo(op)
      .pipe(
        finalize(() => this._articuloEnVuelo.delete(op)),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (a) => {
          const extra: Partial<EditCAItem> = {
            articulo: a.articulo,
            ancho: a.ancho,
            anchoYds: a.ancho_yds,
            gramaje: a.gramaje,
            gramajeOz: a.gramaje_oz,
            rendimiento: a.rendimiento,
            rendimientoYdLb: a.rendimiento_yd_lb,
          };
          this._articuloCache.set(op, extra);
          alTerminar?.(extra);
        },
        error: () => alTerminar?.(null),
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

  onEliminar(rollo: string): void {
    if (this.eliminando) return;

    this.eliminando = true;
    this._cdr.markForCheck();

    this._scanService
      .eliminar(rollo)
      .pipe(
        finalize(() => {
          this.eliminando = false;
          this._cdr.markForCheck();
        }),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (res) => {
          if (!res.ok) {
            this._notificar(rollo, false, 'No se pudo eliminar');
            return;
          }

          // Quita el rollo del historial y cierra el modal
          this.historial = this.historial.filter((h) => h.rollo !== rollo);
          this.cerrarEdicion();
          this._notificar(rollo, true, 'Rollo eliminado');
        },
        error: (e: HttpErrorResponse) => {
          this._notificar(rollo, false, this._mensajeError(e));
        },
      });
  }
}
