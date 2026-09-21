import { AsyncPipe, CommonModule, NgClass, NgFor, NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { UserService } from 'app/core/user/user.service';
import { SolicitudesVacacionesComponent } from 'app/modules/modals/SolicitudesVacaciones/solicitudes-vacaciones.component';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';

import { VacacionesService } from './vacaciones.service';
import { ProjectService } from '../../../project.service';

@Component({
  selector: 'vacaciones-tab-project',
  templateUrl: './vacaciones.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatTooltipModule,
    NgApexchartsModule,
    AsyncPipe,
    CommonModule,
    NgClass,
    NgIf,
    NgFor,
  ],
})
export class VacacionesComponent implements OnInit, AfterViewInit, OnDestroy {
  chartVacaciones: ApexOptions = {};
  chartVacacionesSeries: { [key: string]: number[] } = {};
  data: any;
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  private _user = new BehaviorSubject<any>(null);
  user$ = this._user.asObservable();
  private _chartsReady = false;

  constructor(
    private _projectService: ProjectService,
    private _router: Router,
    private _userService: UserService,
    private _vacacionesService: VacacionesService,
    private _cdr: ChangeDetectorRef,
    private _dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this._projectService.data$.pipe(takeUntil(this._unsubscribeAll)).subscribe((data) => {
      if (data) {
        this.data = data;
        this._prepareChartData();
        this._cdr.markForCheck();
      }
    });

    this._userService.user$.pipe(takeUntil(this._unsubscribeAll)).subscribe((user) => {
      if (user) {
        this._user.next(user);
        this._prepareChartData();
        this._cdr.markForCheck();
      }
    });

    // Fix para que los gradientes/fills de ApexCharts funcionen con rutas con base href
    window['Apex'] = {
      chart: {
        events: {
          mounted: (chart: any) => this._fixSvgFill(chart.el),
          updated: (chart: any) => this._fixSvgFill(chart.el),
        },
      },
    };
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this._chartsReady = true;
      this._cdr.detectChanges();
    }, 100);
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  trackByFn(index: number, item: any): any {
    return item.id || index;
  }

  // ==== CARDS DE RESUMEN ====

  get vacacionesTotales(): number {
    const user = this._user.value;
    return user?.vacaciones?.[0]?.dias_totales ?? 0;
  }

  get vacacionesDisponibles(): number {
    const user = this._user.value;
    return user?.vacaciones?.[0]?.dias_disponibles ?? 0;
  }

  get vacacionesDisfrutadas(): number {
    const user = this._user.value;
    return user?.vacaciones?.[0]?.dias_disfrutados ?? 0;
  }

  get solicitudesVacaciones(): number {
    const user = this._user.value;
    if (!user?.workorders_solicitadas) return 0;
    return user.workorders_solicitadas.filter(
      (wo) => wo.status_id === 5 && wo.titulo === 'Vacaciones',
    ).length;
  }

  // ==== LISTADO DE SOLICITUDES ====

  get solicitudesOrdenadas() {
    return this._vacacionesService.solicitudesOrdenadas(this._user.value);
  }

  getEstadoIcon(estado: string): string {
    return this._vacacionesService.getEstadoIcon(estado);
  }

  // ==== GRÁFICA ====

  hasVacacionesChartData(periodo: string): boolean {
    if (!this._chartsReady) return false;
    return this._vacacionesService.hasVacacionesChartData(periodo, this.chartVacacionesSeries);
  }

  // ==== ACCIONES ====

  abrirSolicitudVacaciones(): void {
    const dialogRef = this._dialog.open(SolicitudesVacacionesComponent, {
      width: '100%',
      maxWidth: '640px',
      autoFocus: false,
      disableClose: false,
      panelClass: 'fuse-confirmation-dialog-panel', // Opcional: usa estilos de Fuse
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // this._userService.reloadUser(); // Si tienes un método para refrescar
        this._prepareChartData();
      }
    });
  }

  private _fixSvgFill(element: Element): void {
    if (!element) return;

    const currentURL = this._router.url;
    Array.from(element.querySelectorAll('*[fill]'))
      .filter((el) => {
        const fill = el.getAttribute('fill');
        return fill && fill.indexOf('url(') !== -1;
      })
      .forEach((el) => {
        const attrVal = el.getAttribute('fill');
        if (attrVal) {
          el.setAttribute('fill', `url(${currentURL}${attrVal.slice(attrVal.indexOf('#'))}`);
        }
      });
  }

  private _prepareChartData(): void {
    if (!this.data) return;

    const user = this._user.value;

    this._initializeVacacionesChart();

    if (!user || !user.vacaciones || user.vacaciones.length === 0) {
      this.chartVacacionesSeries = {
        actual: [0, 0, 0],
        anterior: [0, 0, 0],
        historico: [0, 0, 0],
      };
    } else {
      this.chartVacacionesSeries = {
        actual: this._vacacionesService.generarDatosGrafica(user, 'actual'),
        anterior: this._vacacionesService.generarDatosGrafica(user, 'anterior'),
        historico: this._vacacionesService.generarDatosGrafica(user, 'historico'),
      };
    }

    this._cdr.markForCheck();
  }

  private _initializeVacacionesChart(): void {
    this.chartVacaciones = {
      chart: {
        fontFamily: 'inherit',
        foreColor: 'inherit',
        height: '100%',
        type: 'donut',
        toolbar: { show: false },
      },
      colors: ['#10B981', '#F59E0B', '#94A3B8'],
      labels: ['Disponibles', 'Disfrutadas', 'Pendientes'],
      legend: {
        position: 'bottom',
        horizontalAlign: 'center',
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number): string => `${Math.round(val)}%`,
      },
      tooltip: {
        theme: 'dark',
        y: {
          formatter: (val): string => `${val} día${val !== 1 ? 's' : ''}`,
        },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total',
                formatter: (): string => {
                  const total = this.vacacionesTotales;
                  return `${total} días`;
                },
              },
            },
          },
        },
      },
    };
  }
}
