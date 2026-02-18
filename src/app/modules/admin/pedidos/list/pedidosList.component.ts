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
import { Pedido, PedidosService } from '../../pedidos/pedidos.service';

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

  // Controles de filtros de texto/select
  searchControl = new FormControl('');
  estadoControl = new FormControl('todos');
  condicionControl = new FormControl('todas');

  // Controles de fecha
  fechaInicioControl = new FormControl<Date | null>(null);
  fechaFinControl = new FormControl<Date | null>(null);

  searchSignal = signal('');
  estadoSignal = signal('todos');
  condicionSignal = signal('todas');

  // UI States panel
  mostrarPanelFiltros = false;
  mostrarPanelFiltrosPc = false;


  // Signals
  pedidoExpandido = signal<string | null>(null);
  pedidos = signal<Pedido[]>([]);
  cargando = signal(false);
  descargando = signal<string | null>(null);

  // Filtros de fecha — se aplican en cliente porque getPedidos() no acepta params
  private filtroFechaInicio: Date | null = null;
  private filtroFechaFin: Date | null = null;

  opcionesEstado = [
    { value: 'todos', label: 'Todos los estados' },
    { value: 'Completo', label: 'Completo' },
    { value: 'Parcial', label: 'Parcial' },
    { value: 'Sin Def.', label: 'Sin definir' },
  ];

  opcionesCondicion = [
    { value: 'todas', label: 'Todas las condiciones' },
    { value: 'Credito', label: 'Crédito' },
    { value: 'Sin definir', label: 'Sin definir' },
  ];

  pedidosFiltrados = computed(() => {
    const texto = this.searchSignal().toLowerCase();
    const estado = this.estadoSignal();
    const condicion = this.condicionSignal();
    const inicio = this.filtroFechaInicio;
    const fin = this.filtroFechaFin;

    return this.pedidos().filter((p) => {
      const coincideTexto =
        !texto ||
        p.cve_ped.toLowerCase().includes(texto) ||
        (p.referencia ?? '').toLowerCase().includes(texto) ||
        (p.nombre ?? '').toLowerCase().includes(texto) ||
        (p.observaciones ?? '').toLowerCase().includes(texto);

      const coincideEstado = estado === 'todos' || p.status === estado;
      const coincideCondicion = condicion === 'todas' || p.condicion === condicion;

      let coincideFecha = true;
      if (inicio && p.fecha_elab) {
        const fechaPed = new Date(p.fecha_elab);
        coincideFecha = fechaPed >= inicio && (!fin || fechaPed <= fin);
      } else if (inicio && !p.fecha_elab) {
        coincideFecha = false;
      }

      return coincideTexto && coincideEstado && coincideCondicion && coincideFecha;
    });
  });

  resumen = computed(() => {
    const todos = this.pedidosFiltrados();
    return {
      total: todos.length,
      completos: todos.filter((p) => p.status === 'Completo').length,
      parciales: todos.filter((p) => p.status === 'Parcial').length,
      sinDef: todos.filter((p) => p.status?.startsWith('Sin')).length,
    };
  });

  constructor(
    private _cd: ChangeDetectorRef,
    private _pedidosService: PedidosService,
    private _snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.cargarPedidos();

    this.estadoControl.valueChanges
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this._cd.markForCheck());
    this.condicionControl.valueChanges
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this._cd.markForCheck());

    this.searchControl.valueChanges
      .pipe(debounceTime(300), takeUntil(this._destroy$))
      .subscribe((val) => {
        this.searchSignal.set(val ?? '');
      });

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
  }

  // ══════════════ Panel toggles ══════════════

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
    if (this.mostrarPanelFiltros || this.mostrarPanelFiltrosPc) {
      this.mostrarPanelFiltros = false;
      this.mostrarPanelFiltrosPc = false;
      this._cd.markForCheck();
    }
  }

  // ══════════════ Filtros de fecha ══════════════

  seleccionarRangoFecha(
    rango:
      | 'todos'
      | 'hoy'
      | 'ayer'
      | 'mes_actual'
      | 'mes_anterior'
      | 'fecha_especifica'
      | 'periodo',
  ): void {


    if (rango === 'fecha_especifica' || rango === 'periodo') return;

    const hoy = new Date();
    this.filtroFechaInicio = null;
    this.filtroFechaFin = null;

    switch (rango) {
      case 'hoy':
        this.filtroFechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        this.filtroFechaFin = new Date(
          hoy.getFullYear(),
          hoy.getMonth(),
          hoy.getDate(),
          23,
          59,
          59,
        );
        break;
      case 'ayer': {
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 1);
        this.filtroFechaInicio = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate());
        this.filtroFechaFin = new Date(
          ayer.getFullYear(),
          ayer.getMonth(),
          ayer.getDate(),
          23,
          59,
          59,
        );
        break;
      }
      case 'mes_actual':
        this.filtroFechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        this.filtroFechaFin = hoy;
        break;
      case 'mes_anterior':
        this.filtroFechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        this.filtroFechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        break;
      case 'todos':
      default:
        break;
    }

    this._cd.markForCheck();
  }

  aplicarFiltroFechas(): void {
    const inicio = this.fechaInicioControl.value;
    // const fin = this.rangoFechaSeleccionado === 'periodo' ? this.fechaFinControl.value : inicio;

    if (!inicio) {
      this._snackBar.open('Selecciona una fecha válida', 'Cerrar', { duration: 3000 });
      return;
    }
    // if (this.rangoFechaSeleccionado === 'periodo' && !fin) {
    //   this._snackBar.open('Selecciona una fecha fin válida', 'Cerrar', { duration: 3000 });
    //   return;
    // }
    // if (this.rangoFechaSeleccionado === 'periodo' && inicio > fin!) {
    //   this._snackBar.open('La fecha inicio no puede ser mayor a la fecha fin', 'Cerrar', {
    //     duration: 3000,
    //   });
    //   return;
    // }

    this.filtroFechaInicio = inicio;
    // this.filtroFechaFin =
      // this.rangoFechaSeleccionado === 'periodo'
      //   ? fin
      //   : new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 23, 59, 59);

    this._cd.markForCheck();
  }

  aplicarFiltrosPc(): void {
    // if (
    //   this.rangoFechaSeleccionado === 'fecha_especifica' ||
    //   this.rangoFechaSeleccionado === 'periodo'
    // ) {
    //   this.aplicarFiltroFechas();
    // }
    this.mostrarPanelFiltrosPc = false;
    this._cd.markForCheck();
  }

  aplicarFiltrosMovil(): void {
    // if (
    //   this.rangoFechaSeleccionado === 'fecha_especifica' ||
    //   this.rangoFechaSeleccionado === 'periodo'
    // ) {
    //   this.aplicarFiltroFechas();
    // }
    this.mostrarPanelFiltros = false;
    this._cd.markForCheck();
  }

  filtrosActivosCount(): number {
    let count = 0;
    // if (this.rangoFechaSeleccionado !== 'todos') count++;
    if (this.estadoControl.value !== 'todos') count++;
    if (this.condicionControl.value !== 'todas') count++;
    return count;
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('');
    this.estadoControl.setValue('todos');
    this.condicionControl.setValue('todas');
    this.fechaInicioControl.setValue(null);
    this.fechaFinControl.setValue(null);
    // this.rangoFechaSeleccionado = 'todos';
    this.filtroFechaInicio = null;
    this.filtroFechaFin = null;

    this.searchSignal.set('');
    this.estadoSignal.set('todos');
    this.condicionSignal.set('todas');
    this._cd.markForCheck();
  }

  // ══════════════ Pedidos ══════════════

  cargarPedidos(): void {
    this.cargando.set(true);
    // getPedidos() no acepta parámetros — el filtrado de fecha se hace en cliente
    this._pedidosService
      .getPedidos()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.pedidos.set(res.data ?? []);
          this.cargando.set(false);
        },
        error: (err) => {
          console.error('Error al cargar pedidos', err);
          this._snackBar.open('Error al cargar pedidos', 'Cerrar', { duration: 4000 });
          this.cargando.set(false);
        },
      });
  }

  toggleExpand(cvePed: string): void {
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
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `pedido-${cvePed}.pdf`;
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

  trackByCve(_i: number, pedido: Pedido): string {
    return pedido.cve_ped;
  }

  esCompleto(p: Pedido) {
    return p.status === 'Completo';
  }
  esParcial(p: Pedido) {
    return p.status === 'Parcial';
  }
  esSinDef(p: Pedido) {
    return p.status?.startsWith('Sin');
  }
}
