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
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';


import {
  CorreccionAcabadoError,
  CorreccionAcabadoResponse,
  EditCAItem,
  EditCAResultado,
  RolloAcabadoDatos,
} from '../types/correccion acabado.type';
import { CorreccionAcabadoService } from './correccionacabado.service';
import { ModalEditCAComponent } from 'app/modules/modals/inventarios/correccionacabado/edit/edit_ca_modal.component';

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
  // --- Cámara ---
  mostrarEscanerCamara = false;
  ultimoFeedbackCamara: ScanFeedback | null = null;
  totalEscaneadosCamara = 0;

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

    const abrir = (extra: Partial<EditCAItem> = {}) => {
      this.itemEditando = {
        rollo: item.rollo,
        op: item.op,
        pieza: item.pieza,
        articulo: item.datos?.ARTICULO ?? null,
        peso: item.peso,
        ...extra,
      };
      this._cdr.markForCheck();
    };

    if (!op) {
      abrir();
      return;
    }

    this._scanService.articulo(op).subscribe({
    next: (a) =>
  abrir({
    articulo: a.articulo,
    ancho: a.ancho,
    anchoYds: a.ancho_yds,
    gramaje: a.gramaje,
    gramajeOz: a.gramaje_oz,
    rendimiento: a.rendimiento,
    rendimientoYdLb: a.rendimiento_yd_lb,
  }),
      error: () => {
        this._notificar(item.rollo, false, 'No se pudo cargar el artículo');
        abrir();
      },
    });
  }

  cerrarEdicion(): void {
    this.itemEditando = null;
    this._cdr.markForCheck();
  }

  guardarEdicion(res: EditCAResultado): void {
    // TODO: mandar `res` al backend
    console.log('Guardar', res);
    this.cerrarEdicion();
  }

  seleccionar(item: CorreccionLocal): void {
    this.seleccionadoId = item.id;
    this._cdr.markForCheck();
  }
}
