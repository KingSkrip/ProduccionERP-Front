import { AsyncPipe, CommonModule, NgClass } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { UserService } from 'app/core/user/user.service';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';

import { AsistenciasService } from './asistencias.service';
import { ProjectService } from '../../../project.service';

@Component({
  selector: 'asistencias-tab-project',
  templateUrl: './asistencias.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    MatButtonToggleModule,
    MatTabsModule,
    NgApexchartsModule,
    AsyncPipe,
    CommonModule,
    NgClass,
  ],
})
export class AsistenciasComponent implements OnInit, AfterViewInit, OnDestroy {
  chartAsistencias: ApexOptions = {};
  chartAsistenciasSeries: { [key: string]: ApexAxisChartSeries } = {};
  data: any;
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  private _user = new BehaviorSubject<any>(null);
  user$ = this._user.asObservable();
  añoActual = new Date().getFullYear();
  private _chartsReady = false;

  constructor(
    private _projectService: ProjectService,
    private _router: Router,
    private _userService: UserService,
    private _asistenciasService: AsistenciasService,
    private _cdr: ChangeDetectorRef,
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

  // ==== CARDS DE RESUMEN ====

  get totalAsistencias() {
    return this._asistenciasService.totalAsistencias(this._user.value, this.añoActual);
  }

  get totalRetardos() {
    return this._asistenciasService.totalRetardos(this._user.value, this.añoActual);
  }

  get horasTrabajadas() {
    return this._asistenciasService.horasTrabajadas(this._user.value, this.añoActual);
  }

  get totalFaltas(): number {
    const user = this._user.value;
    if (!user?.asistencias || !user?.empleos) return 0;

    const empleoActual = user.empleos.find((e) => {
      if (!e.fecha_inicio || e.fecha_fin) return false;
      const [, , y] = e.fecha_inicio.split('/').map(Number);
      return y === this.añoActual;
    });

    if (!empleoActual) return 0;

    const [d, m, y] = empleoActual.fecha_inicio.split('/').map(Number);
    const fechaInicio = new Date(y, m - 1, d);
    const hoy = new Date();

    let diasLaborales = 0;
    for (let d = new Date(fechaInicio); d <= hoy; d.setDate(d.getDate() + 1)) {
      const diaSemana = d.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) diasLaborales++;
    }

    const asistenciasDelAnio = user.asistencias.filter((a) => {
      if (!a.fecha) return false;
      const [, , y2] = a.fecha.split('/').map(Number);
      const fecha = new Date(y2, m - 1, d);
      return fecha >= fechaInicio && fecha <= hoy && fecha.getDay() !== 0 && fecha.getDay() !== 6;
    }).length;

    return Math.max(0, diasLaborales - asistenciasDelAnio);
  }

  // ==== LISTADO DE REGISTROS RECIENTES ====

  get asistenciasOrdenadas() {
    return this._asistenciasService.asistenciasOrdenadas(this._user.value);
  }

  isRetardoUI(asistencia: any): boolean {
    return this._asistenciasService.isRetardo(asistencia);
  }

  // ==== GRÁFICA ====

  hasChartData(periodo: string): boolean {
    if (!this._chartsReady) return false;
    if (!this.chartAsistenciasSeries || !this.chartAsistenciasSeries[periodo]) {
      return false;
    }

    const series = this.chartAsistenciasSeries[periodo];
    if (!series || series.length === 0) return false;

    return series.some((s) => s.data && Array.isArray(s.data) && s.data.length > 0);
  }

  getXaxisForPeriod(periodo: string): any {
    let categories: string[] = [];

    if (periodo === 'semana') {
      const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
      categories = dias.slice(0, this.chartAsistenciasSeries.semana?.[0]?.data?.length || 0);
    } else if (periodo === 'mes') {
      const numSemanas = this.chartAsistenciasSeries.mes?.[0]?.data?.length || 0;
      categories = Array.from({ length: numSemanas }, (_, i) => `Sem ${i + 1}`);
    } else if (periodo === 'anio') {
      categories = [
        'Ene',
        'Feb',
        'Mar',
        'Abr',
        'May',
        'Jun',
        'Jul',
        'Ago',
        'Sep',
        'Oct',
        'Nov',
        'Dic',
      ];
    }

    return {
      categories,
      labels: {
        style: { colors: 'var(--fuse-text-secondary)' },
      },
    };
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
    if (!user || !user.empleos || !user.asistencias) {
      this.chartAsistenciasSeries = { semana: [], mes: [], anio: [] };
      this._initializeAsistenciasChart();
      return;
    }

    const empleoActivo = user.empleos
      ?.filter((e) => !e.fecha_fin && e.fecha_inicio)
      .sort(
        (a, b) =>
          new Date(a.fecha_inicio.split('/').reverse().join('-')).getTime() -
          new Date(b.fecha_inicio.split('/').reverse().join('-')).getTime(),
      )
      .at(-1);

    if (!empleoActivo) {
      this.chartAsistenciasSeries = { semana: [], mes: [], anio: [] };
      this._initializeAsistenciasChart();
      return;
    }

    const [d, m, y] = empleoActivo.fecha_inicio.split('/').map(Number);
    const fechaInicioEmpleo = new Date(y, m - 1, d);
    fechaInicioEmpleo.setHours(0, 0, 0, 0);

    const asistencias = (user.asistencias || []).filter((a) => {
      if (!a.fecha) return false;
      const [, , y2] = a.fecha.split('/').map(Number);
      return y2 === this.añoActual;
    });

    if (asistencias.length < 2) {
      this.chartAsistenciasSeries = { semana: [], mes: [], anio: [] };
      this._initializeAsistenciasChart();
      this._cdr.markForCheck();
      return;
    }

    const semanaAsistenciasArr: number[] = [];
    const semanaRetardosArr: number[] = [];
    const semanaFaltasArr: number[] = [];

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const day = hoy.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diffToMonday);

    const asistenciaMap = new Map(asistencias.map((a) => [a.fecha, a]));

    for (let i = 0; i < 5; i++) {
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + i);
      fecha.setHours(0, 0, 0, 0);

      if (fecha < fechaInicioEmpleo) continue;
      if (fecha > hoy) break;
      if (fecha.getDay() === 0 || fecha.getDay() === 6) continue;

      const fechaStr =
        `${String(fecha.getDate()).padStart(2, '0')}/` +
        `${String(fecha.getMonth() + 1).padStart(2, '0')}/` +
        `${fecha.getFullYear()}`;

      const asistencia = asistenciaMap.get(fechaStr);

      if (!asistencia) {
        semanaAsistenciasArr.push(0);
        semanaRetardosArr.push(0);
        semanaFaltasArr.push(1);
      } else if (this._asistenciasService.isRetardo(asistencia)) {
        semanaAsistenciasArr.push(0);
        semanaRetardosArr.push(1);
        semanaFaltasArr.push(0);
      } else {
        semanaAsistenciasArr.push(1);
        semanaRetardosArr.push(0);
        semanaFaltasArr.push(0);
      }
    }

    const anioData = this._asistenciasService.agruparPorMeses(asistencias, fechaInicioEmpleo);
    const mesActualData = this._asistenciasService.agruparPorSemanasDelMes(
      asistencias,
      fechaInicioEmpleo,
      user.vacaciones,
    );

    this.chartAsistenciasSeries = {
      semana: [
        { name: 'Asistencias', data: semanaAsistenciasArr },
        { name: 'Retardos', data: semanaRetardosArr },
        { name: 'Faltas', data: semanaFaltasArr },
      ],
      mes: [
        { name: 'Asistencias', data: mesActualData.asistencias },
        { name: 'Retardos', data: mesActualData.retardos },
        { name: 'Faltas', data: mesActualData.faltas },
      ],
      anio: [
        { name: 'Asistencias', data: anioData.asistencias },
        { name: 'Retardos', data: anioData.retardos },
        { name: 'Faltas', data: anioData.faltas },
      ],
    };

    this._initializeAsistenciasChart();
    this._cdr.markForCheck();
  }

  private _initializeAsistenciasChart(): void {
    this.chartAsistencias = {
      chart: {
        fontFamily: 'inherit',
        foreColor: 'inherit',
        height: '100%',
        type: 'bar',
        toolbar: { show: false },
      },
      colors: ['#10B981', '#F59E0B', '#EF4444'],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '50%',
          borderRadius: 8,
        },
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      legend: { position: 'top' },
      tooltip: {
        theme: 'dark',
        y: {
          formatter: (val): string => `${val} día${val !== 1 ? 's' : ''}`,
        },
      },
      yaxis: {
        labels: {
          style: { colors: 'var(--fuse-text-secondary)' },
        },
      },
    };
  }
}
