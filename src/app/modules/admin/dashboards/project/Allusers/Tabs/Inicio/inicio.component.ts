import { CommonModule } from '@angular/common';
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
import { MatIconModule } from '@angular/material/icon';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { Subject, takeUntil } from 'rxjs';
import { ProjectService } from '../../../project.service';


@Component({
  selector: 'inicio-tab-project',
  templateUrl: './inicio.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    NgApexchartsModule,
    CommonModule,
  ],
})
export class InicioComponent implements OnInit, AfterViewInit, OnDestroy {
  chartGithubIssues: ApexOptions = {};
  chartTaskDistribution: ApexOptions = {};

  data: any;

  private _unsubscribeAll: Subject<any> = new Subject<any>();

  constructor(
    private _projectService: ProjectService,
    private _cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this._projectService.data$.pipe(takeUntil(this._unsubscribeAll)).subscribe((data) => {
      // TODO: cuando tu ProjectService entregue githubIssues/taskDistribution/schedule reales,
      // quita el fallback a _mockData() y usa `data` directo.
      this.data = data ?? this._mockData();
      this._prepareChartData();
      this._cdr.markForCheck();
    });

    // Si tu ProjectService todavía no emite nada (data$ vacío al inicio), fuerza el mock
    // para poder maquetar mientras conectas el backend real:
    if (!this.data) {
      this.data = this._mockData();
      this._prepareChartData();
    }
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  trackByFn(index: number, item: any): any {
    return item.id || index;
  }

  // ==== PREPARACIÓN DE DATOS ====

  private _prepareChartData(): void {
    this._initializeGithubIssuesChart();
    this._initializeTaskDistributionChart();
  }

  private _initializeGithubIssuesChart(): void {
    this.chartGithubIssues = {
      chart: {
        fontFamily: 'inherit',
        foreColor: 'inherit',
        height: '100%',
        type: 'area',
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      colors: ['#818CF8', '#38BDF8'],
      dataLabels: { enabled: false },
      grid: {
        borderColor: 'var(--fuse-border)',
        strokeDashArray: 4,
      },
      labels: this.data?.githubIssues?.labels ?? [],
      legend: { show: true, position: 'top' },
      plotOptions: {},
      series: this.data?.githubIssues?.series ?? { 'last-week': [], 'this-week': [] },
      states: {
        hover: {
          filter: {
            type: 'darken',
          },
        },
      },
      stroke: { curve: 'smooth', width: 2 },
      tooltip: { theme: 'dark' },
      xaxis: {
        type: 'category',
        labels: { style: { colors: 'var(--fuse-text-secondary)' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: { style: { colors: 'var(--fuse-text-secondary)' } },
      },
    };
  }

  private _initializeTaskDistributionChart(): void {
    this.chartTaskDistribution = {
      chart: {
        fontFamily: 'inherit',
        foreColor: 'inherit',
        height: '100%',
        type: 'radialBar',
      },
      colors: ['#10B981', '#F59E0B', '#EF4444'],
      labels: this.data?.taskDistribution?.labels ?? ['Bajo', 'Medio', 'Alto'],
      legend: { position: 'bottom' },
      plotOptions: {
        radialBar: {
          hollow: { size: '30%' },
          dataLabels: {
            name: { show: true },
            value: { show: true },
          },
        },
      },
      series: this.data?.taskDistribution?.series ?? { 'last-week': [], 'this-week': [] },
      states: {
        hover: {
          filter: {
            type: 'darken',
          },
        },
      },
      stroke: { width: 2 },
      theme: { monochrome: { enabled: false } },
      tooltip: { theme: 'dark' },
      yaxis: {
        labels: { style: { colors: 'var(--fuse-text-secondary)' } },
      },
    };
  }

  // ==== MOCK DATA (Fuse demo) — reemplazar por ProjectService real ====

  private _mockData(): any {
    return {
      githubIssues: {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
        series: {
          'last-week': [
            { name: 'Nuevos', data: [12, 15, 10, 18, 14, 9, 11] },
            { name: 'Cerrados', data: [8, 10, 12, 9, 11, 13, 10] },
          ],
          'this-week': [
            { name: 'Nuevos', data: [14, 16, 13, 20, 15, 12, 13] },
            { name: 'Cerrados', data: [10, 12, 14, 11, 13, 15, 12] },
          ],
        },
        overview: {
          'last-week': {
            'new-issues': 45,
            'closed-issues': 38,
            fixed: 22,
            'wont-fix': 5,
            're-opened': 3,
            'needs-triage': 7,
          },
          'this-week': {
            'new-issues': 52,
            'closed-issues': 41,
            fixed: 25,
            'wont-fix': 4,
            're-opened': 2,
            'needs-triage': 9,
          },
        },
      },
      taskDistribution: {
        labels: ['Bajo', 'Medio', 'Alto'],
        series: {
          'last-week': [44, 55, 41],
          'this-week': [38, 62, 35],
        },
        overview: {
          'last-week': { new: 24, completed: 18 },
          'this-week': { new: 31, completed: 22 },
        },
      },
      schedule: {
        today: [
          { id: '1', title: 'Reunión diaria', time: '09:00', location: 'Sala A' },
          { id: '2', title: 'Revisión de sprint', time: '11:30', location: 'Sala B' },
          { id: '3', title: 'Entrevista candidato', time: '14:00', location: 'Zoom' },
        ],
        tomorrow: [
          { id: '4', title: 'Planeación de sprint', time: '10:00', location: 'Sala A' },
          { id: '5', title: 'Demo con cliente', time: '16:00', location: 'Zoom' },
        ],
      },
    };
  }
}
