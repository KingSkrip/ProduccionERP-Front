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
  currentPage = signal(1);
  totalPages = signal(1);
  totalClients = signal(0);
  perPage = 10;

  private _destroy$ = new Subject<void>();
  searchControl = new FormControl('');
  estadoControl = new FormControl('Parcial');
  condicionControl = new FormControl('todas');
  searchSignal = signal('');
  estadoSignal = signal('Parcial');
  condicionSignal = signal('todas');
  mostrarPanelFiltros = false;
  mostrarPanelFiltrosPc = false;
  clienteExpandido = signal<string | null>(null);
  pedidoExpandido = signal<string | null>(null);
  pedidosSeleccionados = signal<Set<string>>(new Set());
  pedidos = signal<Pedido[]>([]);
  cargando = signal(false);
  descargando = signal<string | null>(null);
  pedidoCargando = signal<string | null>(null);
  private blobCacheIndividual = new Map<string, Blob>();
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
  totalSeleccionados = computed(
    () => this.clientesSeleccionados().size + this.pedidosSeleccionados().size,
  );
  blobCacheKey = '';
  private _cancelarPreparacion$ = new Subject<void>();
  isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  private pedidosFiltradosFlat = computed(() => {
    const texto = this.searchSignal().toLowerCase();
    const condicion = this.condicionSignal();

    return this.pedidos().filter((p) => {
      const coincideTexto =
        !texto ||
        p.cve_ped.toLowerCase().includes(texto) ||
        (p.referencia ?? '').toLowerCase().includes(texto) ||
        (p.nombre ?? '').toLowerCase().includes(texto);

      const coincideCondicion = condicion === 'todas' || p.condicion === condicion;

      return coincideTexto && coincideCondicion;
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

    this.condicionControl.valueChanges
      .pipe(debounceTime(200), takeUntil(this._destroy$))
      .subscribe((val) => {
        this.condicionSignal.set(val ?? 'todas');
        this.cargarPedidos(1);
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._cancelarPreparacion$.next();
    this._cancelarPreparacion$.complete();
    this.blobCacheIndividual.clear();
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
    return this.condicionControl.value !== 'todas' ? 1 : 0;
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('');
    this.condicionControl.setValue('todas');
    this.searchSignal.set('');
    this.condicionSignal.set('todas');
    this.cargarPedidos(1);
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

  cargarPedidos(page = 1): void {
    this.cargando.set(true);
    this._pedidosService
      .getPedidos(page, this.perPage, this.condicionSignal())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.pedidos.set(res.data ?? []);
          if (res.pagination) {
            this.currentPage.set(res.pagination.page);
            this.totalPages.set(res.pagination.total_pages);
            this.totalClients.set(res.pagination.total_clients);
          }
          this.cargando.set(false);
          this.clienteExpandido.set(null);
          this.pedidoExpandido.set(null);
        },
        error: () => {
          this._snackBar.open('Error al cargar pedidos', 'Cerrar', { duration: 4000 });
          this.cargando.set(false);
        },
      });
  }

  irAPagina(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.cargarPedidos(page);
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
  togglePedido(pedido: Pedido): void {
    const cvePed = pedido.cve_ped;

    // Si ya está expandido, colapsar
    if (this.pedidoExpandido() === cvePed) {
      this.pedidoExpandido.set(null);
      return;
    }

    this.pedidoExpandido.set(cvePed);

    // Si ya tiene artículos cargados, no volver a pedir
    if (pedido.articulos?.length > 0 || pedido.cardigans?.length > 0) return;

    // Lazy load
    this.pedidoCargando.set(cvePed);
    this._pedidosService
      .getDetallePedido(cvePed)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          // Mutar el pedido dentro del signal de pedidos
          this.pedidos.update((lista) =>
            lista.map((p) =>
              p.cve_ped === cvePed
                ? { ...p, articulos: res.articulos ?? [], cardigans: res.cardigans ?? [] }
                : p,
            ),
          );
          this.pedidoCargando.set(null);
        },
        error: () => {
          this._snackBar.open('Error al cargar detalle', 'Cerrar', { duration: 3000 });
          this.pedidoCargando.set(null);
        },
      });
  }

  estaExpandido(cvePed: string): boolean {
    return this.pedidoExpandido() === cvePed;
  }

  async compartirPDF(cvePed: string): Promise<void> {
    // Si ya tenemos el blob en cache, compartir directamente (síncrono al click)
    const cached = this.blobCacheIndividual.get(cvePed);
    if (cached) {
      await this._compartirBlob(cached, cvePed);
      return;
    }

    this.descargando.set(cvePed);
    this._pedidosService
      .descargarPDF(cvePed)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: async (blob) => {
          const fileName = `pedido-${cvePed}.pdf`;
          const file = new File([blob], fileName, { type: 'application/pdf' });
          try {
            await navigator.share({
              title: `Pedido ${cvePed}`,
              files: [file],
            });
          } catch (err) {
            if ((err as DOMException).name !== 'AbortError') {
              this._snackBar.open('No se pudo compartir el PDF', 'Cerrar', { duration: 4000 });
            }
          }
          this.descargando.set(null);
        },
        error: () => {
          this._snackBar.open('Error al obtener el PDF', 'Cerrar', { duration: 4000 });
          this.descargando.set(null);
        },
      });
  }
  private async _compartirBlob(blob: Blob, cvePed: string): Promise<void> {
    const file = new File([blob], `pedido-${cvePed}.pdf`, { type: 'application/pdf' });
    try {
      await navigator.share({ title: `Pedido ${cvePed}`, files: [file] });
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        this._snackBar.open('No se pudo compartir el PDF', 'Cerrar', { duration: 4000 });
      }
    }
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
    // Si ya se cargaron los artículos, calcular desde ellos (más preciso post-lazy-load)
    if (pedido.articulos?.length > 0 || pedido.cardigans?.length > 0) {
      const kgArt = (pedido.articulos ?? []).reduce((s, a) => s + Number(a.CANTIDAD ?? 0), 0);
      const kgCard = (pedido.cardigans ?? []).reduce((s, c) => s + Number(c.CANTIDAD ?? 0), 0);
      return kgArt + kgCard;
    }
    // Si aún no se han cargado, usar el valor precalculado del backend
    return pedido.kg_total ?? 0;
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
    this.pedidosSeleccionados.set(new Set());
    this.blobCache = null;
    this.blobCacheKey = '';
    this._cd.markForCheck();
  }

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

    // Activar si hay clientes O pedidos sueltos seleccionados
    if (this.clientesSeleccionados().size > 0 || this.pedidosSeleccionados().size > 0) {
      this.prepararPDFEnBackground();
    }
    this._cd.markForCheck();
  }

  private prepararPDFEnBackground(): void {
    // IDs de pedidos vía clientes seleccionados
    const pedidosPorCliente = this.clientesConPedidos()
      .filter((c) => this.clientesSeleccionados().has(c.cve_clie))
      .flatMap((c) => c.pedidos.map((p) => p.cve_ped));

    // IDs de pedidos seleccionados individualmente
    const pedidosSueltos = Array.from(this.pedidosSeleccionados());

    // Merge sin duplicados
    const pedidosIds = [...new Set([...pedidosPorCliente, ...pedidosSueltos])];

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
          // Verificar que la selección no cambió (clientes + sueltos)
          const idsActuales = [
            ...new Set([
              ...this.clientesConPedidos()
                .filter((c) => this.clientesSeleccionados().has(c.cve_clie))
                .flatMap((c) => c.pedidos.map((p) => p.cve_ped)),
              ...Array.from(this.pedidosSeleccionados()),
            ]),
          ]
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

  getPaginasVisibles(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: number[] = [1];
    if (current > 3) pages.push(-1); // ellipsis

    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }

    if (current < total - 2) pages.push(-1); // ellipsis
    pages.push(total);
    return pages;
  }

  toggleSeleccionPedido(event: Event, cvePed: string): void {
    event.stopPropagation();
    this.pedidosSeleccionados.update((set) => {
      const nuevo = new Set(set);
      nuevo.has(cvePed) ? nuevo.delete(cvePed) : nuevo.add(cvePed);
      return nuevo;
    });
    this.invalidarCache();
    this._cd.markForCheck();
  }
  estaSeleccionadoPedido(cvePed: string): boolean {
    return this.pedidosSeleccionados().has(cvePed);
  }
}
