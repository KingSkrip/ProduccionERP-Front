import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  computed,
  signal,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule, MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fuseAnimations } from '@fuse/animations';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { ClienteConPedidos, Pedido, PedidosService } from '../pedidos.service';

export const slideDown = trigger('slideDown', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-8px) scale(0.98)' }),
    animate('150ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
  ]),
  transition(':leave', [
    animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(-8px) scale(0.98)' })),
  ]),
]);

export const fadeIn = trigger('fadeIn', [
  transition(':enter', [style({ opacity: 0 }), animate('150ms ease-out', style({ opacity: 1 }))]),
  transition(':leave', [animate('120ms ease-in', style({ opacity: 0 }))]),
]);

@Component({
  selector: 'pedidos-list',
  templateUrl: './pedidosList.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatBadgeModule,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [...fuseAnimations, slideDown, fadeIn],
})
export class PedidosListComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject<void>();
  searchControl = new FormControl('');
  estadoControl = new FormControl('todos');
  condicionControl = new FormControl('todas');
  searchSignal = signal('');
  estadoSignal = signal('todos');
  condicionSignal = signal('todas');
  mostrarPanelFiltros = false;
  mostrarPanelFiltrosPc = false;
  clienteExpandido = signal<string | null>(null);
  pedidoExpandido = signal<string | null>(null);
  pedidos = signal<Pedido[]>([]);
  cargando = signal(false);
  descargando = signal<string | null>(null);
  opcionesEstado = [
    { value: 'todos', label: 'Todos los estados' },
    { value: 'Completo', label: 'Entregados' },
    { value: 'Parcial', label: 'En proceso' },
    { value: 'Sin Def.', label: 'Sin autorizar' },
  ];
  opcionesCondicion = [
    { value: 'todas', label: 'Todas las condiciones' },
    { value: 'Credito', label: 'Crédito' },
    { value: 'Sin definir', label: 'Sin definir' },
  ];
  blobCache: Blob | null = null;
  blobCacheKey = '';
  private _cancelarPreparacion$ = new Subject<void>();
  isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  private pedidosFiltradosFlat = computed(() => {
    const texto = this.searchSignal().toLowerCase();
    const estado = this.estadoSignal();
    const condicion = this.condicionSignal();
    return this.pedidos().filter((p) => {
      const coincideTexto =
        !texto ||
        p.cve_ped.toLowerCase().includes(texto) ||
        (p.referencia ?? '').toLowerCase().includes(texto) ||
        (p.nombre ?? '').toLowerCase().includes(texto);

      const coincideEstado = estado === 'todos' || p.status === estado;
      const coincideCondicion = condicion === 'todas' || p.condicion === condicion;

      return coincideTexto && coincideEstado && coincideCondicion;
    });
  });
  clientesConPedidos = computed((): ClienteConPedidos[] => {
    const mapa = new Map<string, ClienteConPedidos>();

    for (const p of this.pedidosFiltradosFlat()) {
      const key = p.cve_clie || 'sin-clave';

      if (!mapa.has(key)) {
        mapa.set(key, {
          cve_clie: p.cve_clie,
          nombre: p.nombre,
          pedidos: [],
          totalPedidos: 0,
          completos: 0,
          parciales: 0,
          sinDef: 0,
        });
      }

      const cliente = mapa.get(key)!;
      cliente.pedidos.push(p);
      cliente.totalPedidos++;
      if (p.status === 'Completo') cliente.completos++;
      else if (p.status === 'Parcial') cliente.parciales++;
      else cliente.sinDef++;
    }
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  constructor(
    private _cd: ChangeDetectorRef,
    private _pedidosService: PedidosService,
    private _snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.cargarPedidos();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), takeUntil(this._destroy$))
      .subscribe((val) => this.searchSignal.set(val ?? ''));

    this.estadoControl.valueChanges
      .pipe(takeUntil(this._destroy$))
      .subscribe((val) => this.estadoSignal.set(val ?? 'todos'));

    this.condicionControl.valueChanges
      .pipe(takeUntil(this._destroy$))
      .subscribe((val) => this.condicionSignal.set(val ?? 'todas'));
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._cancelarPreparacion$.next();
    this._cancelarPreparacion$.complete();
  }

  togglePanelFiltros(): void {
    this.mostrarPanelFiltros = !this.mostrarPanelFiltros;
    this._cd.markForCheck();
  }

  togglePanelFiltrosPc(): void {
    this.mostrarPanelFiltrosPc = !this.mostrarPanelFiltrosPc;
    this._cd.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.mostrarPanelFiltros = false;
    this.mostrarPanelFiltrosPc = false;
    this._cd.markForCheck();
  }

  filtrosActivosCount(): number {
    let count = 0;
    if (this.estadoControl.value !== 'todos') count++;
    if (this.condicionControl.value !== 'todas') count++;
    return count;
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('');
    this.estadoControl.setValue('todos');
    this.condicionControl.setValue('todas');
    this.searchSignal.set('');
    this.estadoSignal.set('todos');
    this.condicionSignal.set('todas');
    this._cd.markForCheck();
  }

  aplicarFiltrosPc(): void {
    this.mostrarPanelFiltrosPc = false;
    this._cd.markForCheck();
  }

  aplicarFiltrosMovil(): void {
    this.mostrarPanelFiltros = false;
    this._cd.markForCheck();
  }

  cargarPedidos(): void {
    this.cargando.set(true);
    this._pedidosService
      .getPedidos()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.pedidos.set(res.data ?? []);
          this.cargando.set(false);
        },
        error: () => {
          this._snackBar.open('Error al cargar pedidos', 'Cerrar', { duration: 4000 });
          this.cargando.set(false);
        },
      });
  }

  // ── Acordeón clientes ──
  toggleCliente(cveClie: string): void {
    this.clienteExpandido.update((c) => (c === cveClie ? null : cveClie));
    this.pedidoExpandido.set(null); // colapsa pedidos al cambiar de cliente
  }

  estaClienteExpandido(cveClie: string): boolean {
    return this.clienteExpandido() === cveClie;
  }

  // ── Acordeón pedidos ──
  togglePedido(cvePed: string): void {
    this.pedidoExpandido.update((c) => (c === cvePed ? null : cvePed));
  }

  estaExpandido(cvePed: string): boolean {
    return this.pedidoExpandido() === cvePed;
  }

  descargarPDF(cvePed: string): void {
    this.descargando.set(cvePed);
    this._pedidosService
      .descargarPDF(cvePed)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: async (blob) => {
          const fileName = `pedido-${cvePed}.pdf`;

          // Intenta compartir si el navegador lo soporta
          if (navigator.share && navigator.canShare) {
            const file = new File([blob], fileName, { type: 'application/pdf' });
            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  title: `Pedido ${cvePed}`,
                  text: `Aquí está el pedido ${cvePed}`,
                  files: [file],
                });
                this.descargando.set(null);
                return;
              } catch (err) {
                // Si el usuario cancela el share, no hacer nada
                if ((err as DOMException).name !== 'AbortError') {
                  console.warn('Share falló, descargando...', err);
                } else {
                  this.descargando.set(null);
                  return;
                }
              }
            }
          }

          // Fallback: descarga normal
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
          this.descargando.set(null);
        },
        error: () => {
          this._snackBar.open('Error al descargar el PDF', 'Cerrar', { duration: 4000 });
          this.descargando.set(null);
        },
      });
  }

  trackByClie(_i: number, c: ClienteConPedidos): string {
    return c.cve_clie;
  }
  trackByCve(_i: number, p: Pedido): string {
    return p.cve_ped;
  }

  totalPedidos = computed(() => this.clientesConPedidos().reduce((s, c) => s + c.totalPedidos, 0));
  totalEntregados = computed(() => this.clientesConPedidos().reduce((s, c) => s + c.completos, 0));
  totalEnProceso = computed(() => this.clientesConPedidos().reduce((s, c) => s + c.parciales, 0));
  totalSinAutorizar = computed(() => this.clientesConPedidos().reduce((s, c) => s + c.sinDef, 0));

  expandirTodos(): void {
    const todos = this.clientesConPedidos().map((c) => c.cve_clie);
    const hayAlgunExpandido = todos.some((id) => this.estaClienteExpandido(id));

    if (hayAlgunExpandido) {
      this.clienteExpandido.set(null);
    } else {
      this.clienteExpandido.set(todos[0] ?? null);
    }
  }
  getTotalKilosCliente(cliente: ClienteConPedidos): number {
    return cliente.pedidos.reduce((s, p) => s + this.getKilosPedido(p), 0);
  }

  getKilosPedido(pedido: Pedido): number {
    const kgArt = (pedido.articulos ?? []).reduce((s, a) => s + Number(a.CANTIDAD ?? 0), 0);
    const kgCard = (pedido.cardigans ?? []).reduce((s, c) => s + Number(c.CANTIDAD ?? 0), 0);
    return kgArt + kgCard;
  }
  totalKilos = computed(() =>
    this.clientesConPedidos().reduce(
      (s, c) => s + c.pedidos.reduce((sp, p) => sp + this.getKilosPedido(p), 0),
      0,
    ),
  );

  // ── Selección múltiple de clientes ──
  clientesSeleccionados = signal<Set<string>>(new Set());

  toggleSeleccionCliente(event: Event, cveClie: string): void {
    event.stopPropagation();
    this.clientesSeleccionados.update((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(cveClie)) {
        nuevo.delete(cveClie);
      } else {
        nuevo.add(cveClie);
      }
      return nuevo;
    });
    this.invalidarCache();
    this._cd.markForCheck();
  }

  estaSeleccionado(cveClie: string): boolean {
    return this.clientesSeleccionados().has(cveClie);
  }

  limpiarSeleccion(): void {
    this.clientesSeleccionados.set(new Set());
    this.blobCache = null;
    this.blobCacheKey = '';
    this._cd.markForCheck();
  }

  totalSeleccionados = computed(() => this.clientesSeleccionados().size);

  async compartirSeleccionados(): Promise<void> {
    if (!this.blobCache || this.descargando() === '__multi__') return;

    const fileName = `pedidos-${Date.now()}.pdf`;
    const file = new File([this.blobCache], fileName, { type: 'application/pdf' });

    try {
      await navigator.share({ title: 'Pedidos', files: [file] });
      this.limpiarSeleccion();
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        this._snackBar.open('No se pudo compartir el PDF', 'Cerrar', { duration: 4000 });
      }
    }
  }

  private invalidarCache(): void {
    this._cancelarPreparacion$.next();
    this.blobCache = null;
    this.blobCacheKey = '';
    this.descargando.set(null);

    if (this.clientesSeleccionados().size > 0) {
      this.prepararPDFEnBackground();
    }
    this._cd.markForCheck();
  }

  private prepararPDFEnBackground(): void {
    const pedidosIds = this.clientesConPedidos()
      .filter((c) => this.clientesSeleccionados().has(c.cve_clie))
      .flatMap((c) => c.pedidos.map((p) => p.cve_ped));

    if (pedidosIds.length === 0) return;

    const cacheKey = pedidosIds.slice().sort().join(',');
    if (this.blobCacheKey === cacheKey && this.blobCache) return;

    this.descargando.set('__multi__');
    this._cd.markForCheck();

    this._pedidosService
      .descargarMultiples(pedidosIds)
      .pipe(takeUntil(this._cancelarPreparacion$))
      .subscribe({
        next: (blob) => {
          // Verificar que la selección no cambió
          const idsActuales = this.clientesConPedidos()
            .filter((c) => this.clientesSeleccionados().has(c.cve_clie))
            .flatMap((c) => c.pedidos.map((p) => p.cve_ped))
            .sort()
            .join(',');

          if (idsActuales !== cacheKey) return;

          this.blobCache = new Blob([blob], { type: 'application/pdf' });
          this.blobCacheKey = cacheKey;
          this.descargando.set(null);
          this._cd.markForCheck();
        },
        error: () => {
          this._snackBar.open('Error al preparar PDF', 'Cerrar', { duration: 4000 });
          this.descargando.set(null);
          this._cd.markForCheck();
        },
      });
  }
}
