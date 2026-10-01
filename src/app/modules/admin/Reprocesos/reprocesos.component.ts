import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription, debounceTime } from 'rxjs';
import { Reproceso, ReprocesosFiltros } from './types/reproceso.type';
import { ReprocesosService } from './reprocesos.component.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'aut_reprocesos',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, MatIconModule],
  templateUrl: './reprocesos.component.html',
})
export class ReprocesosComponent implements OnInit {
  private readonly service = inject(ReprocesosService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
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

  readonly desde = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.perPage() + 1));
  readonly hasta = computed(() => Math.min(this.page() * this.perPage(), this.total()));

  readonly perPageOpciones = [10, 25, 50, 100];

  readonly form = this.fb.nonNullable.group({
    buscar: '',
  });

  /** Campos que se muestran en el detalle */
  readonly camposDetalle: {
    label: string;
    key: keyof Reproceso;
    tipo?: 'fecha' | 'fechahora' | 'num';
  }[] = [
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

  abrirDetalle(r: Reproceso): void {
    this.seleccionado.set(r);
  }

  cerrarDetalle(): void {
    this.seleccionado.set(null);
  }

  valorDetalle(r: Reproceso, key: keyof Reproceso): unknown {
    return r[key];
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
}