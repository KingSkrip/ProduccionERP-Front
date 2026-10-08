import { animate, style, transition, trigger } from '@angular/animations';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, debounceTime } from 'rxjs';
import { ReprocesosService } from './reprocesos.component.service';
import { LiberarReprocesoResponse, Reproceso, ReprocesosFiltros } from './types/reproceso.type';

// El trigger va ANTES del @Component, nunca entre el decorador y la clase
export const slideUp = trigger('slideUp', [
  transition(':enter', [
    style({ transform: 'translateY(100%)', opacity: 0 }),
    animate(
      '320ms cubic-bezier(0.32, 0.72, 0, 1)',
      style({ transform: 'translateY(0)', opacity: 1 }),
    ),
  ]),
  transition(':leave', [
    animate(
      '220ms cubic-bezier(0.4, 0, 1, 1)',
      style({ transform: 'translateY(120%)', opacity: 0 }),
    ),
  ]),
]);

type CampoDetalle = {
  label: string;
  key: keyof Reproceso;
  tipo?: 'fecha' | 'fechahora' | 'num';
};

type GrupoDetalle = {
  titulo: string;
  icono: string;
  abierto: boolean;
  campos: CampoDetalle[];
};

@Component({
  selector: 'aut_reprocesos',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, MatIconModule],
  templateUrl: './reprocesos.component.html',
  animations: [slideUp],
})
export class ReprocesosComponent implements OnInit {
  private readonly service = inject(ReprocesosService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly _cdr = inject(ChangeDetectorRef);
  readonly liberando = signal<number | null>(null);
  readonly porLiberar = signal<Reproceso | null>(null);
  readonly aviso = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  private avisoTimer?: ReturnType<typeof setTimeout>;
  private peticion?: Subscription;

  // ── Estado ──
  readonly reprocesos = signal<Reproceso[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly perPage = signal(25);
  readonly lastPage = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly filtrosAbiertos = signal(false);
  readonly filtrosActivos = signal(0);
  readonly seleccionado = signal<Reproceso | null>(null);

  readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.perPage() + 1,
  );
  readonly hasta = computed(() => Math.min(this.page() * this.perPage(), this.total()));

  readonly perPageOpciones = [10, 25, 50, 100];

  readonly form = this.fb.nonNullable.group({
    buscar: '',
  });

  // ── Drag to dismiss (móvil) ──
  isDragging = false;
  dragTransform = 'translateY(0)';
  dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
  private _touchStartY = 0;
  private _dragY = 0;
  private readonly DISMISS_THRESHOLD = 140;

  /** Lista plana: la usa el modal de PC */
  readonly camposDetalle: CampoDetalle[] = [
    { label: 'Orden', key: 'ORDEN' },
    { label: 'Folio', key: 'FOLIO' },
    { label: 'ID reproceso', key: 'IDREPRRM' },
    { label: 'Tipo de reporte', key: 'TIPO_REPORTE' },
    { label: 'Estatus', key: 'ESTATUS' },
    { label: 'Estatus reporte', key: 'ESTATUS_REPORTE' },
    { label: 'Fecha', key: 'FECHA', tipo: 'fechahora' },
    { label: 'Pedido', key: 'PEDIDO' },
    { label: 'Partida', key: 'PARTIDA' },
    { label: 'Cliente', key: 'CLIENTE' },
    { label: 'Artículo', key: 'ARTICULO' },
    { label: 'Composición', key: 'COMPOSICION' },
    { label: 'Ancho', key: 'ANCHO' },
    { label: 'Peso', key: 'PESO', tipo: 'num' },
    { label: 'Código color', key: 'CODIGO COLOR' },
    { label: 'Color', key: 'COLOR' },
    { label: 'Estampado', key: 'ESTAMPADO' },
    { label: 'Dibujo', key: 'DIBUJO' },
    { label: 'Nombre dibujo', key: 'NOMBRE DIB.' },
    { label: 'Variante', key: 'VARIANTE' },
    { label: 'Cantidad', key: 'CANTIDAD', tipo: 'num' },
    { label: 'Cant. entregada', key: 'CANT. ENT.', tipo: 'num' },
    { label: 'Rollos', key: 'ROLLOS', tipo: 'num' },
    { label: 'Lote', key: 'LOTE' },
    { label: 'Ruta', key: 'RUTA' },
    { label: 'Agente', key: 'AGENTE' },
    { label: 'Usuario', key: 'USUARIO' },
    { label: 'Observaciones', key: 'OBS' },
  ];

  /** Métricas destacadas (tiles del móvil) */
  readonly metricas: { label: string; key: keyof Reproceso; icono: string }[] = [
    { label: 'Cantidad', key: 'CANTIDAD', icono: 'inventory_2' },
    { label: 'Entregada', key: 'CANT. ENT.', icono: 'local_shipping' },
    { label: 'Rollos', key: 'ROLLOS', icono: 'album' },
    { label: 'Peso', key: 'PESO', icono: 'scale' },
  ];

  /** Detalle agrupado por tema (secciones del móvil) */
  readonly grupos: GrupoDetalle[] = [
    {
      titulo: 'Pedido',
      icono: 'receipt_long',
      abierto: true,
      campos: [
        { label: 'Pedido', key: 'PEDIDO' },
        { label: 'Partida', key: 'PARTIDA' },
        { label: 'Cliente', key: 'CLIENTE' },
        { label: 'Agente', key: 'AGENTE' },
        { label: 'Ruta', key: 'RUTA' },
        { label: 'Lote', key: 'LOTE' },
      ],
    },
    {
      titulo: 'Producto',
      icono: 'checkroom',
      abierto: true,
      campos: [
        { label: 'Artículo', key: 'ARTICULO' },
        { label: 'Composición', key: 'COMPOSICION' },
        { label: 'Ancho', key: 'ANCHO' },
        { label: 'Variante', key: 'VARIANTE' },
      ],
    },
    {
      titulo: 'Color y diseño',
      icono: 'palette',
      abierto: false,
      campos: [
        { label: 'Código color', key: 'CODIGO COLOR' },
        { label: 'Color', key: 'COLOR' },
        { label: 'Estampado', key: 'ESTAMPADO' },
        { label: 'Dibujo', key: 'DIBUJO' },
        { label: 'Nombre dibujo', key: 'NOMBRE DIB.' },
      ],
    },
    {
      titulo: 'Trazabilidad',
      icono: 'history',
      abierto: false,
      campos: [
        { label: 'Orden', key: 'ORDEN' },
        { label: 'Folio', key: 'FOLIO' },
        { label: 'ID reproceso', key: 'IDREPRRM' },
        { label: 'Tipo de reporte', key: 'TIPO_REPORTE' },
        { label: 'Estatus reporte', key: 'ESTATUS_REPORTE' },
        { label: 'Usuario', key: 'USUARIO' },
      ],
    },
  ];

  ngOnInit(): void {
    this.form.valueChanges
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.cargar();
      });

    this.cargar();
  }

  cargar(): void {
    const v = this.form.getRawValue();
    this.filtrosActivos.set(Object.values(v).filter((x) => !!x).length);

    const filtros: ReprocesosFiltros = {
      ...v,
      page: this.page(),
      per_page: this.perPage(),
    };

    this.loading.set(true);
    this.error.set(null);
    this.peticion?.unsubscribe(); // evita respuestas fuera de orden

    this.peticion = this.service.getReprocesos(filtros).subscribe({
      next: (res) => {
        this.reprocesos.set(res.data);
        this.total.set(res.total);
        this.lastPage.set(Math.max(res.last_page, 1));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los reprocesos. Intenta de nuevo.');
        this.reprocesos.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  limpiarFiltros(): void {
    this.form.reset(); // dispara valueChanges → recarga
  }

  irAPagina(p: number): void {
    if (p < 1 || p > this.lastPage() || p === this.page()) return;
    this.page.set(p);
    this.cargar();
  }

  cambiarPerPage(valor: string): void {
    this.perPage.set(Number(valor));
    this.page.set(1);
    this.cargar();
  }

  // ── Detalle ──
  abrirDetalle(r: Reproceso): void {
    this._resetDrag();
    this.seleccionado.set(r);
  }

  cerrarDetalle(): void {
    this.seleccionado.set(null);
    this._resetDrag();
  }

  valorDetalle(r: Reproceso, key: keyof Reproceso): unknown {
    return r[key];
  }

  /** ¿El valor está vacío? */
  esVacio(v: unknown): boolean {
    return v === null || v === undefined || v === '';
  }

  /** Solo los campos del grupo que sí tienen valor */
  camposConValor(r: Reproceso, g: GrupoDetalle): CampoDetalle[] {
    return g.campos.filter((c) => !this.esVacio(r[c.key]));
  }

  /** % entregado (0-100) */
  progreso(r: Reproceso): number {
    const total = Number(r['CANTIDAD']);
    const ent = Number(r['CANT. ENT.']);
    if (!total || isNaN(total) || isNaN(ent)) return 0;
    return Math.min(100, Math.max(0, (ent / total) * 100));
  }

  /** Color del badge según el estatus */
  claseEstatus(estatus: string | null): string {
    switch ((estatus ?? '').toLowerCase()) {
      case 'en proceso':
        return 'bg-sky-100 text-sky-700';
      case 'pendiente':
        return 'bg-amber-100 text-amber-700';
      case 'terminado':
      case 'finalizado':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  // ==================== DRAG TO DISMISS ====================
  private _resetDrag(): void {
    this.isDragging = false;
    this._dragY = 0;
    this.dragTransform = 'translateY(0)';
    this.dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';
  }

  onTouchStart(event: TouchEvent): void {
    this._touchStartY = event.touches[0].clientY;
    this._dragY = 0;
    this.isDragging = true;
    this.dragTransition = 'none';
    this._cdr.markForCheck();
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging) return;
    event.preventDefault();
    const deltaY = event.touches[0].clientY - this._touchStartY;
    if (deltaY <= 0) {
      this._dragY = 0;
      this.dragTransform = 'translateY(0)';
      this._cdr.markForCheck();
      return;
    }
    this._dragY = deltaY;
    const resistance =
      deltaY > this.DISMISS_THRESHOLD
        ? this.DISMISS_THRESHOLD + (deltaY - this.DISMISS_THRESHOLD) * 0.35
        : deltaY;
    this.dragTransform = `translateY(${resistance}px)`;
    this._cdr.markForCheck();
  }

  onTouchEnd(_event: TouchEvent): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.dragTransition = 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)';

    if (this._dragY >= this.DISMISS_THRESHOLD) {
      this.dragTransform = 'translateY(120%) scale(0.95)';
      this._cdr.markForCheck();
      setTimeout(() => this.cerrarDetalle(), 320);
    } else {
      this.dragTransform = 'translateY(0)';
      this._cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.porLiberar()) {
      this.cancelarLiberar();
      return;
    }
    if (this.seleccionado()) this.cerrarDetalle();
  }

  // ── Liberar ──
  pedirLiberar(r: Reproceso, event?: Event): void {
    event?.stopPropagation(); // que no abra el detalle
    if (this.liberando() !== null) return;
    this.porLiberar.set(r);
  }

  cancelarLiberar(): void {
    if (this.liberando() === null) this.porLiberar.set(null);
  }

  confirmarLiberar(): void {
    const r = this.porLiberar();
    if (!r || this.liberando() !== null) return;

    this.liberando.set(r.IDREPRRM);

    this.service
      .liberarReproceso(r.IDREPRRM)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.liberando.set(null);
          this.porLiberar.set(null);
          if (this.seleccionado()?.IDREPRRM === r.IDREPRRM) this.cerrarDetalle();
          this.mostrarAviso('ok', this.textoLiberado(res));
          this.cargar(); // el reproceso liberado sale de la lista
        },
        error: (err) => {
          this.liberando.set(null);
          this.porLiberar.set(null);
          this.mostrarAviso('error', err?.error?.message ?? 'No se pudo liberar el reproceso.');
        },
      });
  }

  private textoLiberado(res: LiberarReprocesoResponse): string {
    if (res.accion === 'TEJE') {
      return res.ot
        ? `Reproceso liberado. Orden de tejido ${res.ot} generada.`
        : 'Reproceso liberado. La ruta no lleva tejido.';
    }
    if (res.accion === 'SURTE') return 'Reproceso liberado. La ruta tiene ST, se surte.';
    return 'Reproceso liberado correctamente.';
  }

  private mostrarAviso(tipo: 'ok' | 'error', texto: string): void {
    clearTimeout(this.avisoTimer);
    this.aviso.set({ tipo, texto });
    this.avisoTimer = setTimeout(() => this.aviso.set(null), 5000);
  }
}
