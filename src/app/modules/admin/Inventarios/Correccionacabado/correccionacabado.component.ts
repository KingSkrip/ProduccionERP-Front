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
  CorreccionAcabadoLoteRequest,
  CorreccionAcabadoLoteResponse,
  CorreccionAcabadoResponse,
  CorreccionLocal,
  EditCAItem,
  EditCAResultado,
  EliminarLoteResponse,
} from '../types/correccion acabado.type';
import { CorreccionAcabadoService } from './correccionacabado.service';

const MENSAJES_ERROR: Record<string, string> = {
  rollo_invalido: 'Rollo inválido',
  rollo_no_encontrado: 'No existe el rollo',
  rollo_eliminado: 'El rollo ya fue eliminado',
  pieza_no_encontrada: 'No existe esa pieza en esa OP',
  op_invalida: 'OP inválida',
};

export const TIPOS_CA: { cod: number; clave: string; etiqueta: string }[] = [
  { cod: 51, clave: 'PRIMERA',   etiqueta: 'Primera' },
  { cod: 52, clave: 'PREFERIDA', etiqueta: 'Preferida' },
  { cod: 77, clave: 'SEGUNDA',   etiqueta: 'Segunda' },
  { cod: 81, clave: 'MUESTRAS',  etiqueta: 'Muestras' },
  { cod: 73, clave: 'ORILLAS',   etiqueta: 'Orillas' },
  { cod: 74, clave: 'RETAZO',    etiqueta: 'Retazo' },
];

/** Orden en que se muestran los chips de filtro */
const ORDEN_TIPOS = ['PRIMERA', 'PREFERIDA', 'SEGUNDA', 'MUESTRAS', 'ORILLAS', 'RETAZO', 'OTRAS'];

const ETIQUETA_TIPO: Record<string, string> = {
  TODOS: 'Todos',
  PRIMERA: 'Primera',
  PREFERIDA: 'Preferida',
  SEGUNDA: 'Segunda',
  MUESTRAS: 'Muestras',
  ORILLAS: 'Orillas',
  RETAZO: 'Retazo',
  OTRAS: 'Otras',
};

export interface FiltroTipo {
  valor: string;
  etiqueta: string;
  total: number;
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

  /** Selección múltiple (PC y móvil) */
  seleccion = new Set<number>();

  /** Filtro por tipo */
  filtroTipo = 'TODOS';
  tiposFiltro: FiltroTipo[] = [];
  visibles: CorreccionLocal[] = [];

  /** Confirmación de borrado masivo en BD */
  confirmarEliminar = false;

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

  // ------------------------------------------------------------------
  // Getters
  // ------------------------------------------------------------------

  /** Modo selección (móvil): hay algo seleccionado */
  get modoSeleccion(): boolean {
    return this.seleccion.size > 0;
  }

  get totalError(): number {
    return this.historial.filter((h) => h.estado === 'error').length;
  }

  /** Filas visibles que se pueden seleccionar (no "consultando") */
  get seleccionables(): CorreccionLocal[] {
    return this.visibles.filter((h) => h.estado !== 'enviando');
  }

  get todosSeleccionados(): boolean {
    const s = this.seleccionables;
    return s.length > 0 && s.every((h) => this.seleccion.has(h.id));
  }

  get algunosSeleccionados(): boolean {
    return this.seleccionables.some((h) => this.seleccion.has(h.id));
  }

  /** Seleccionados que existen en BD (los que sí se pueden eliminar) */
  get seleccionadosOk(): CorreccionLocal[] {
    return this.historial.filter((h) => this.seleccion.has(h.id) && h.estado === 'ok');
  }

  /** Resumen por tipo de lo que se va a borrar, para el modal de confirmación */
  get resumenEliminar(): { tipo: string; total: number }[] {
    const m = new Map<string, number>();
    for (const h of this.seleccionadosOk) {
      const t = this._tipoDe(h);
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return [...m.entries()].map(([tipo, total]) => ({ tipo: ETIQUETA_TIPO[tipo] ?? tipo, total }));
  }

  // ------------------------------------------------------------------
  // Ciclo de vida
  // ------------------------------------------------------------------

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

  buscarManual(opInput: HTMLInputElement, rollosInput: HTMLInputElement): void {
    const op = opInput.value.trim();
    const texto = rollosInput.value.trim();

    if (!op && !texto) {
      this._notificar('Manual', false, 'Captura la OP o el ID del rollo');
      opInput.focus();
      return;
    }

    let valores: number[] = [];
    if (texto) {
      const p = this._parsearLista(texto);
      if (p.error) {
        this._notificar(texto, false, p.error);
        rollosInput.focus();
        return;
      }
      valores = p.valores;
    }

    if (!op) {
      // Solo ID(s)
      if (valores.length === 1) this._enviar(String(valores[0]));
      else this._enviarLote({ claves: valores }, `${valores.length} IDs`);
    } else if (valores.length === 1) {
      this._enviar(null, { op, pieza: String(valores[0]) });
    } else if (valores.length > 1) {
      this._enviarLote({ op, piezas: valores }, `OP ${op} · ${valores.length} rollos`);
    } else {
      this._enviarLote({ op }, `OP ${op} · todos`);
    }

    // La OP se queda; solo se limpian los rollos
    rollosInput.value = '';
    rollosInput.focus();
  }

  /** "1,4,7,9,3,7,4" · "1-10, 15" → números únicos, en orden de aparición */
  private _parsearLista(texto: string): { valores: number[]; error?: string } {
    const MAX = 300;
    const valores: number[] = [];
    const vistos = new Set<number>();

    for (const t of texto.split(/[\s,;]+/).filter(Boolean)) {
      const m = /^(\d{1,10})(?:-(\d{1,10}))?$/.exec(t);
      if (!m) return { valores: [], error: `"${t}" no es válido. Usa 1,4,7 o rangos 1-10` };

      const a = Number(m[1]);
      const b = m[2] !== undefined ? Number(m[2]) : a;
      if (b < a) return { valores: [], error: `Rango inválido: ${t}` };
      if (b - a + 1 > MAX) return { valores: [], error: `Máximo ${MAX} rollos por búsqueda` };

      for (let n = a; n <= b; n++) {
        if (vistos.has(n)) continue;
        vistos.add(n);
        valores.push(n);
        if (valores.length > MAX) {
          return { valores: [], error: `Máximo ${MAX} rollos por búsqueda` };
        }
      }
    }
    return { valores };
  }

  private _enviarLote(req: CorreccionAcabadoLoteRequest, etiqueta: string): void {
    const llave = `lote|${JSON.stringify(req)}`;
    if (this._enVuelo.has(llave)) {
      this._notificar(etiqueta, false, 'Ya se está consultando');
      return;
    }
    this._enVuelo.add(llave);

    const placeholder: CorreccionLocal = {
      id: ++this._idCounter,
      rollo: etiqueta,
      fecha: new Date(),
      estado: 'enviando',
      peso: 0,
    };
    this.historial = [placeholder, ...this.historial];
    this._render();

    this._scanService
      .escanearLote(req)
      .pipe(
        finalize(() => {
          this._enVuelo.delete(llave);
          this._render();
        }),
      )
      .subscribe({
        next: (res: CorreccionAcabadoLoteResponse) => {
          const ahora = new Date();
          const nuevos: CorreccionLocal[] = res.items.map((r) => ({
            id: ++this._idCounter,
            rollo: r.rollo,
            op: r.op,
            pieza: r.pieza,
            datos: r.datos,
            peso: r.peso,
            fecha: ahora,
            estado: 'ok',
          }));

          const faltantes: CorreccionLocal[] = res.no_encontradas.map((n) => ({
            id: ++this._idCounter,
            rollo: req.claves ? String(n).padStart(10, '0') : `${req.op} · ${n}`,
            fecha: ahora,
            estado: 'error',
            mensaje: req.claves
              ? MENSAJES_ERROR['rollo_no_encontrado']
              : MENSAJES_ERROR['pieza_no_encontrada'],
            peso: 0,
          }));

          // si el rollo ya estaba en el historial, se reemplaza por el nuevo
          const rollosNuevos = new Set(nuevos.map((n) => n.rollo));
          this.historial = [
            ...faltantes,
            ...nuevos,
            ...this.historial.filter((h) => h.id !== placeholder.id && !rollosNuevos.has(h.rollo)),
          ];

          const opArt = (res.items[0]?.datos?.ORDEN ?? res.items[0]?.op ?? '').toString().trim();
          if (opArt) {
            this._articuloObs(opArt).pipe(takeUntil(this._destroy$)).subscribe({ error: () => {} });
          }

          let msg = `${nuevos.length} rollo(s) cargados`;
          if (faltantes.length) msg += ` · ${faltantes.length} no encontrados`;
          if (res.truncado) msg += ' · resultado limitado, usa una lista más corta';
          this._notificar(etiqueta, nuevos.length > 0, msg);
          this._render();
        },
        error: (e: HttpErrorResponse) => {
          const mensaje = this._mensajeError(e);
          this._actualizar(placeholder.id, { estado: 'error', mensaje });
          this._notificar(etiqueta, false, mensaje);
        },
      });
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
  // Historial (solo la vista; NO toca la BD)
  // ------------------------------------------------------------------

  quitar(item: CorreccionLocal): void {
    this.historial = this.historial.filter((h) => h.id !== item.id);
    this.seleccion.delete(item.id);
    this.seleccion = new Set(this.seleccion);
    this._render();
  }

  /** Vacía la tabla. No borra nada de la BD. */
  limpiarHistorial(): void {
    this.historial = this.historial.filter((h) => h.estado === 'enviando');
    this.seleccion = new Set();
    this.filtroTipo = 'TODOS';
    this.seleccionadoId = null;
    this._render();
  }

  trackById(_: number, item: CorreccionLocal): number {
    return item.id;
  }

  trackByTipo(_: number, t: FiltroTipo): string {
    return t.valor;
  }

  seleccionar(item: CorreccionLocal): void {
    this.seleccionadoId = item.id;
    this._render();
  }

  // ------------------------------------------------------------------
  // Filtro por tipo
  // ------------------------------------------------------------------

  setFiltro(valor: string): void {
    this.filtroTipo = valor;
    this._render();
    // seguridad: no dejar seleccionados rollos que ya no se ven
    const visibles = new Set(this.visibles.map((v) => v.id));
    const s = new Set([...this.seleccion].filter((id) => visibles.has(id)));
    if (s.size !== this.seleccion.size) {
      this.seleccion = s;
      this._render();
    }
  }

  private _tipoDe(h: CorreccionLocal): string {
    return (h.datos?.TIPO ?? 'OTRAS').toString().toUpperCase();
  }

  private _recalcularVista(): void {
    // conteo por tipo (solo rollos cargados correctamente)
    const conteo = new Map<string, number>();
    let totalOk = 0;
    for (const h of this.historial) {
      if (h.estado !== 'ok') continue;
      totalOk++;
      const t = this._tipoDe(h);
      conteo.set(t, (conteo.get(t) ?? 0) + 1);
    }

    const tipos = [...conteo.keys()].sort((a, b) => {
      const ia = ORDEN_TIPOS.indexOf(a);
      const ib = ORDEN_TIPOS.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    this.tiposFiltro =
      tipos.length >= 2
        ? [
            { valor: 'TODOS', etiqueta: ETIQUETA_TIPO['TODOS'], total: totalOk },
            ...tipos.map((t) => ({
              valor: t,
              etiqueta: ETIQUETA_TIPO[t] ?? t,
              total: conteo.get(t)!,
            })),
          ]
        : [];

    // si el tipo filtrado ya no existe, regresa a "Todos"
    if (this.filtroTipo !== 'TODOS' && !conteo.has(this.filtroTipo)) {
      this.filtroTipo = 'TODOS';
    }

    // los errores / "consultando" siempre se ven, para no esconder fallos
    this.visibles =
      this.filtroTipo === 'TODOS'
        ? this.historial
        : this.historial.filter((h) => h.estado !== 'ok' || this._tipoDe(h) === this.filtroTipo);
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
    const clave = TIPOS_CA.find((t) => t.cod === res.tipo)?.clave ?? 'OTRAS';
    if (h) {
this._actualizar(h.id, {
  peso: res.kilogramos,
  datos: h.datos && {
    ...h.datos,
    TIPO: clave,
    TIPO_COD: res.tipo,
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
        tipo: res.tipo
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
  // Selección múltiple (PC y móvil)
  // ------------------------------------------------------------------

  toggleSeleccion(item: CorreccionLocal): void {
    if (item.estado === 'enviando') return;
    const s = new Set(this.seleccion);
    if (!s.delete(item.id)) s.add(item.id);
    this.seleccion = s;
    this._render();
  }

  /** Selecciona / deselecciona todo lo que se ve (respeta el filtro) */
  toggleTodosVisibles(): void {
    const s = new Set(this.seleccion);
    if (this.todosSeleccionados) {
      this.seleccionables.forEach((h) => s.delete(h.id));
    } else {
      this.seleccionables.forEach((h) => s.add(h.id));
    }
    this.seleccion = s;
    this._render();
  }

  cancelarSeleccion(): void {
    this.seleccion = new Set();
    this._render();
  }

  /** Quita de la tabla lo seleccionado. NO toca la BD. */
  quitarSeleccionados(): void {
    const ids = this.seleccion;
    this.historial = this.historial.filter((h) => !ids.has(h.id));
    this.seleccion = new Set();
    this._render();
  }

  // --- Borrado masivo en BD ---

  pedirEliminarSeleccionados(): void {
    if (this.seleccionadosOk.length === 0) {
      this._notificar('Selección', false, 'No hay rollos válidos seleccionados');
      return;
    }
    this.confirmarEliminar = true;
    this._render();
  }

  cancelarEliminar(): void {
    if (this.eliminando) return;
    this.confirmarEliminar = false;
    this._render();
  }

  confirmarEliminacion(): void {
    if (this.eliminando) return;
    const items = this.seleccionadosOk;
    if (!items.length) {
      this.confirmarEliminar = false;
      this._render();
      return;
    }

    this.eliminando = true;
    this._render();

    this._scanService
      .eliminarLote(items.map((i) => i.rollo))
      .pipe(
        finalize(() => {
          this.eliminando = false;
          this.confirmarEliminar = false;
          this._render();
        }),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (res: EliminarLoteResponse) => {
          const eliminados = new Set(res.eliminados);
          const fallos = new Map((res.fallidos ?? []).map((f) => [f.rollo, f]));

          this.historial = this.historial
            .filter((h) => !eliminados.has(h.rollo))
            .map((h) => {
              const f = fallos.get(h.rollo);
              if (!f) return h;
              const mensaje =
                f.motivo === 'estatus_no_permitido'
                  ? `Orden con estatus ${f.estatus ?? '—'}; no se puede eliminar`
                  : (f.motivo && MENSAJES_ERROR[f.motivo]) || f.error || 'No se pudo eliminar';
              return { ...h, estado: 'error' as const, mensaje };
            });

          this.seleccion = new Set();

          const nOk = eliminados.size;
          const nFail = fallos.size;
          let msg = `${nOk} rollo(s) eliminados`;
          if (nFail) msg += ` · ${nFail} con error (revisa la lista)`;
          this._notificar('Eliminar', nOk > 0, msg);
        },
        error: (e: HttpErrorResponse) => this._notificar('Eliminar', false, this._mensajeError(e)),
      });
  }

  // --- Móvil: long press + tap ---

  onPressStart(item: CorreccionLocal): void {
    if (item.estado === 'enviando') return;
    this._longPressDisparado = false;
    this._clearPressTimer();
    this._pressTimer = setTimeout(() => {
      this._longPressDisparado = true;
      this.toggleSeleccion(item);
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
      this.toggleSeleccion(item);
      return;
    }
    if (item.estado === 'ok') this.editar(item);
  }

  private _clearPressTimer(): void {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer);
      this._pressTimer = null;
    }
  }

  private _render(): void {
    if (this._destroyed) return;
    this._recalcularVista();
    this._ngZone.run(() => this._cdr.detectChanges());
  }
}