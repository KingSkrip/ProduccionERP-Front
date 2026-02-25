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
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { fuseAnimations } from '@fuse/animations';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import { ReportProdService } from '../reportprod.service';
import { SharedDataService } from './shared-data.service';

import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

export const slideDown = trigger('slideDown', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-8px) scale(0.98)' }),
    animate('150ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
  ]),
  transition(':leave', [
    animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(-8px) scale(0.98)' })),
  ]),
]);

@Component({
  selector: 'reportprod-list',
  templateUrl: './reportprodList.component.html',
  styleUrls: ['./reportprodList.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatBadgeModule,
    MatTabsModule,
    // ProcesosTabComponent,
    // ProduccionTabComponent,
    // TejidoRevisadoTabComponent,
    // PorRevisarTabComponent,
    // SaldosTabComponent,
    // EmbarquesTabComponent,
    // EstampadosTabComponent,
    // TintoreriaTabComponent,
    // FacturadoTabComponent,
    // TejidoTabComponent,
    RouterOutlet,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [...fuseAnimations, slideDown],
})
export class ReportProdListComponent implements OnInit, OnDestroy {
  // Datos del tab de procesos (único que maneja el padre)
  datos: any[] = [];
  datosFiltrados: any[] = [];
  isLoading = false;

  // UI States
  mostrarPanelFiltros = false;
  mostrarPanelFiltrosPc = false;
  selectedTabIndex = 0;

  // Controles de filtros
  searchControl = new FormControl('');
  deptoControl = new FormControl('');
  procesoControl = new FormControl('');
  fechaInicioControl = new FormControl(null);
  fechaFinControl = new FormControl(null);

  rangoFechaSeleccionado:
    | 'todos'
    | 'hoy'
    | 'ayer'
    | 'mes_actual'
    | 'mes_anterior'
    | 'fecha_especifica'
    | 'periodo' = 'mes_actual';

  departamentosUnicos: string[] = [];
  procesosUnicos: string[] = [];

  private _unsubscribeAll = new Subject<void>();

  mostrarPanelFechas = false;

  constructor(
    private _cd: ChangeDetectorRef,
    private _reportService: ReportProdService,
    private _snackBar: MatSnackBar,
    private _sharedDataService: SharedDataService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      //   console.log('URL:', this.router.url);
      //   console.log('CONFIG ROUTES:', this.router.config);
    });

    const fechaInicio = new Date();
    fechaInicio.setDate(1);
    const fechaFin = new Date();

    this._sharedDataService.actualizarFiltros({
      rangoFecha: 'mes_actual',
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
    });

    this.cargarDatosProcesos();
    this.configurarFiltros();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next();
    this._unsubscribeAll.complete();
  }

  toggleDatePanel(): void {
    this.mostrarPanelFechas = !this.mostrarPanelFechas;
    this._cd.markForCheck();
  }

  private cargarDatosProcesos(): void {
    const filtros = this._sharedDataService.obtenerFiltros();
    const fechaInicio = filtros.fechaInicio || this.calcularFechaInicio('mes_actual');
    const fechaFin = filtros.fechaFin || new Date();

    this.isLoading = true;
    this._cd.markForCheck();

    this._reportService
      .getReportesProduccion(fechaInicio, fechaFin)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.datos = response;
          this.extraerDatosUnicos();
          this.aplicarFiltrosProcesos();
          this.isLoading = false;
          this._cd.markForCheck();
        },
        error: (err) => {
          console.error('Error al cargar datos:', err);
          this._snackBar.open('Error al cargar datos de producción', 'Cerrar', { duration: 5000 });
          this.isLoading = false;
          this._cd.markForCheck();
        },
      });
  }

  private calcularFechaInicio(rango: string): Date {
    const fecha = new Date();
    switch (rango) {
      case 'hoy':
      case 'ayer':
        return fecha;
      case 'mes_actual':
        fecha.setDate(1);
        return fecha;
      case 'mes_anterior':
        fecha.setMonth(fecha.getMonth() - 1);
        fecha.setDate(1);
        return fecha;
      default:
        return fecha;
    }
  }

  private aplicarFiltrosProcesos(): void {
    const filtros = this._sharedDataService.obtenerFiltros();
    const busqueda = filtros.busqueda.toLowerCase();
    const deptoSeleccionado = filtros.departamento;
    const procesoSeleccionado = filtros.proceso;

    this.datosFiltrados = this.datos.filter((item) => {
      const coincideBusqueda =
        !busqueda ||
        item.departamento?.toLowerCase().includes(busqueda) ||
        item.proceso?.toLowerCase().includes(busqueda) ||
        item.ARTICULO?.toString().toLowerCase().includes(busqueda) ||
        item.CVE_ART?.toString().toLowerCase().includes(busqueda);

      const coincideDepto = !deptoSeleccionado || item.departamento === deptoSeleccionado;
      const coincideProceso = !procesoSeleccionado || item.proceso === procesoSeleccionado;
      return coincideBusqueda && coincideDepto && coincideProceso;
    });

    this._sharedDataService.actualizarDatos(this.datos, this.datosFiltrados);
  }

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
    this.rangoFechaSeleccionado = rango;

    if (rango === 'fecha_especifica' || rango === 'periodo') {
      return;
    }

    let fechaInicio: Date | undefined;
    let fechaFin: Date | undefined;

    if (rango !== 'todos') {
      fechaFin = new Date();
      switch (rango) {
        case 'hoy':
          fechaInicio = new Date();
          break;
        case 'ayer':
          fechaInicio = new Date();
          fechaInicio.setDate(fechaInicio.getDate() - 1);
          fechaFin = new Date(fechaInicio);
          break;
        case 'mes_actual':
          fechaInicio = new Date();
          fechaInicio.setDate(1);
          break;
        case 'mes_anterior':
          fechaInicio = new Date();
          fechaInicio.setMonth(fechaInicio.getMonth() - 1);
          fechaInicio.setDate(1);
          fechaFin = new Date();
          fechaFin.setDate(0);
          break;
      }
    }

    this._sharedDataService.actualizarFiltros({
      rangoFecha: rango,
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
    });

    this.cargarDatosProcesos();
    this.mostrarPanelFiltros = false;
    this.mostrarPanelFiltrosPc = false;
  }

  aplicarFiltroFechas(): void {
    const fechaInicio = this.fechaInicioControl.value;
    const fechaFin =
      this.rangoFechaSeleccionado === 'periodo'
        ? this.fechaFinControl.value
        : this.fechaInicioControl.value;

    if (!fechaInicio) {
      this._snackBar.open('Selecciona una fecha válida', 'Cerrar', { duration: 3000 });
      return;
    }

    if (this.rangoFechaSeleccionado === 'periodo' && !fechaFin) {
      this._snackBar.open('Selecciona una fecha fin válida', 'Cerrar', { duration: 3000 });
      return;
    }

    if (this.rangoFechaSeleccionado === 'periodo' && fechaInicio > fechaFin) {
      this._snackBar.open('La fecha de inicio no puede ser mayor a la fecha fin', 'Cerrar', {
        duration: 3000,
      });
      return;
    }

    this._sharedDataService.actualizarFiltros({
      rangoFecha: this.rangoFechaSeleccionado,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
    });

    this.mostrarPanelFiltros = false;
    this.mostrarPanelFiltrosPc = false;
  }

  limpiarFiltroFechas(): void {
    this.rangoFechaSeleccionado = 'mes_actual';
    this.fechaInicioControl.setValue(null);
    this.fechaFinControl.setValue(null);
    this.seleccionarRangoFecha('mes_actual');
  }

  obtenerTextoFechaSeleccionada(): string {
    const opciones: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };
    const hoy = new Date();

    switch (this.rangoFechaSeleccionado) {
      case 'todos':
        return 'Todos los registros';
      case 'hoy':
        return `Hoy - ${hoy.toLocaleDateString('es-MX', opciones)}`;
      case 'ayer':
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        return `Ayer - ${ayer.toLocaleDateString('es-MX', opciones)}`;
      case 'mes_actual':
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        return `${inicioMes.toLocaleDateString('es-MX', opciones)} - ${hoy.toLocaleDateString('es-MX', opciones)}`;
      case 'mes_anterior':
        const inicioMesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const finMesAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        return `${inicioMesAnt.toLocaleDateString('es-MX', opciones)} - ${finMesAnt.toLocaleDateString('es-MX', opciones)}`;
      case 'fecha_especifica':
        const fecha = this.fechaInicioControl.value;
        return fecha
          ? `Fecha: ${fecha.toLocaleDateString('es-MX', opciones)}`
          : 'Seleccionar fecha';
      case 'periodo':
        const inicio = this.fechaInicioControl.value;
        const fin = this.fechaFinControl.value;
        if (inicio && fin) {
          return `${inicio.toLocaleDateString('es-MX', opciones)} - ${fin.toLocaleDateString('es-MX', opciones)}`;
        }
        return 'Periodo de fechas';
      default:
        return 'Mes actual';
    }
  }

  extraerDatosUnicos(): void {
    const deptosSet = new Set<string>();
    const procesosSet = new Set<string>();

    this.datos.forEach((item) => {
      if (item.departamento) deptosSet.add(item.departamento);
      if (item.proceso) procesosSet.add(item.proceso);
    });

    this.departamentosUnicos = Array.from(deptosSet).sort();
    this.procesosUnicos = Array.from(procesosSet).sort();
  }

  configurarFiltros(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this._unsubscribeAll))
      .subscribe((valor) => {
        this._sharedDataService.actualizarFiltros({ busqueda: valor || '' });
        this.aplicarFiltrosProcesos();
      });

    this.deptoControl.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe((valor) => {
      this._sharedDataService.actualizarFiltros({ departamento: valor || '' });
      this.aplicarFiltrosProcesos();
    });

    this.procesoControl.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe((valor) => {
      this._sharedDataService.actualizarFiltros({ proceso: valor || '' });
      this.aplicarFiltrosProcesos();
    });

    this._sharedDataService.filtrosGlobales$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((filtros) => {
        if (this.searchControl.value !== filtros.busqueda) {
          this.searchControl.setValue(filtros.busqueda, { emitEvent: false });
        }
        this._cd.markForCheck();
      });
  }

  togglePanelFiltros(): void {
    this.mostrarPanelFiltros = !this.mostrarPanelFiltros;
    this._cd.markForCheck();
  }

  togglePanelFiltrosPc(): void {
    this.mostrarPanelFiltrosPc = !this.mostrarPanelFiltrosPc;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mostrarPanelFiltros || this.mostrarPanelFiltrosPc) {
      this.mostrarPanelFiltros = false;
      this.mostrarPanelFiltrosPc = false;
      this._cd.markForCheck();
    }
  }

  filtrosActivosCount(): number {
    let count = 0;
    if (this.rangoFechaSeleccionado !== 'mes_actual') count++;
    if (this.deptoControl.value) count++;
    if (this.procesoControl.value) count++;
    return count;
  }

  limpiarTodosFiltros(): void {
    this.searchControl.setValue('');
    this.deptoControl.setValue('');
    this.procesoControl.setValue('');
    this.limpiarFiltroFechas();
    this._sharedDataService.actualizarFiltros({
      busqueda: '',
      departamento: '',
      proceso: '',
    });
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    this._cd.markForCheck();
  }

  aplicarFiltrosPc(): void {
    if (
      this.rangoFechaSeleccionado === 'fecha_especifica' ||
      this.rangoFechaSeleccionado === 'periodo'
    ) {
      this.aplicarFiltroFechas(); // esto también cierra ambos paneles
      this.cargarDatosProcesos(); // para que sí recargue con el rango
    } else {
      // si NO es fecha específica/periodo, normalmente ya se aplicó al seleccionar rango
      // solo cerramos el panel PC
      this.mostrarPanelFiltrosPc = false;
      this._cd.markForCheck();
    }
  }

  aplicarFiltrosMovil(): void {
    if (
      this.rangoFechaSeleccionado === 'fecha_especifica' ||
      this.rangoFechaSeleccionado === 'periodo'
    ) {
      this.aplicarFiltroFechas();
      this.cargarDatosProcesos();
    }
    this.mostrarPanelFiltros = false;
    this._cd.markForCheck();
  }
}
