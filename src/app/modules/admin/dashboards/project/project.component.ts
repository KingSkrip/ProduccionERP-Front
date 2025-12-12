import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleGroup, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { APP_CONFIG } from 'app/core/config/app-config';
import { UserService } from 'app/core/user/user.service';
import { ProjectService } from 'app/modules/admin/dashboards/project/project.service';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { BehaviorSubject, map, Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'project',
    templateUrl: './project.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TranslocoModule,
        MatIconModule,
        MatButtonModule,
        MatRippleModule,
        MatMenuModule,
        MatTabsModule,
        MatButtonToggleModule,
        NgApexchartsModule,
        MatTableModule,
        AsyncPipe,
        NgClass,
    ],
})
export class ProjectComponent implements OnInit, OnDestroy {
    chartGithubIssues: ApexOptions = {};
    chartTaskDistribution: ApexOptions = {};
    chartBudgetDistribution: ApexOptions = {};
    chartWeeklyExpenses: ApexOptions = {};
    chartMonthlyExpenses: ApexOptions = {};
    chartYearlyExpenses: ApexOptions = {};
    chartAsistencias: ApexOptions = {};
    chartAsistenciasSeries: { [key: string]: ApexAxisChartSeries } = {};

    data: any;
    selectedProject: string = 'ACME Corp. Backend App';
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    private _user = new BehaviorSubject<any>(null);
    user$ = this._user.asObservable();
    apiBase = APP_CONFIG.apiBase;
    private _photoVersion = Date.now();
    añoActual = new Date().getFullYear();
    faltasCount = 0;
    retardosCount = 0;
    vacacionesCount = 0;

    @ViewChild('periodoSelector') periodoSelector!: MatButtonToggleGroup;

    constructor(
        private _projectService: ProjectService,
        private _router: Router,
        private _userService: UserService,
    ) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        this._projectService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data) => {
                this.data = data;
                this._prepareChartData();
            });

        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user) => {
                this._user.next(user);
                if (user && user.name) {
                    const nombre = user.name.split(" ")[0];
                    this.speak(`Bienvenido ${nombre}`);
                }
                this._prepareChartData();
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

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------


    /**
     * Fix the SVG fill references. This fix must be applied to all ApexCharts
     * charts in order to fix 'black color on gradient fills on certain browsers'
     * issue caused by the '<base>' tag.
     *
     * Fix based on https://gist.github.com/Kamshak/c84cdc175209d1a30f711abd6a81d472
     *
     * @param element
     * @private
     */
    private _fixSvgFill(element: Element): void {
        const currentURL = this._router.url;
        Array.from(element.querySelectorAll('*[fill]'))
            .filter((el) => el.getAttribute('fill').indexOf('url(') !== -1)
            .forEach((el) => {
                const attrVal = el.getAttribute('fill');
                el.setAttribute(
                    'fill',
                    `url(${currentURL}${attrVal.slice(attrVal.indexOf('#'))}`
                );
            });
    }

    hasChartData(periodo: string): boolean {
        const series = this.chartAsistenciasSeries[periodo];
        if (!series || series.length === 0) return false;
        return series.some(s => s.data && s.data.length > 0);
    }

    /**
     * Prepare the chart data from the data
     *
     * @private
     */
    private _prepareChartData(): void {
        // Github issues
        this.chartGithubIssues = {
            chart: {
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'line',
                toolbar: { show: false },
                zoom: { enabled: false },
            },
            colors: ['#64748B', '#94A3B8'],
            dataLabels: {
                enabled: true,
                enabledOnSeries: [0],
                background: { borderWidth: 0 },
            },
            grid: { borderColor: 'var(--fuse-border)' },
            labels: this.data.githubIssues.labels,
            legend: { show: false },
            plotOptions: { bar: { columnWidth: '50%' } },
            series: this.data.githubIssues.series,
            states: { hover: { filter: { type: 'darken' } } },
            stroke: { width: [3, 0] },
            tooltip: { followCursor: true, theme: 'dark' },
            xaxis: {
                axisBorder: { show: false },
                axisTicks: { color: 'var(--fuse-border)' },
                labels: { style: { colors: 'var(--fuse-text-secondary)' } },
                tooltip: { enabled: false },
            },
            yaxis: {
                labels: {
                    offsetX: -16,
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
            },
        };

        // Task distribution
        this.chartTaskDistribution = {
            chart: {
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'polarArea',
                toolbar: { show: false },
                zoom: { enabled: false },
            },
            labels: this.data.taskDistribution.labels,
            legend: { position: 'bottom' },
            plotOptions: {
                polarArea: {
                    spokes: { connectorColors: 'var(--fuse-border)' },
                    rings: { strokeColor: 'var(--fuse-border)' },
                },
            },
            series: this.data.taskDistribution.series,
            states: { hover: { filter: { type: 'darken' } } },
            stroke: { width: 2 },
            theme: {
                monochrome: {
                    enabled: true,
                    color: '#93C5FD',
                    shadeIntensity: 0.75,
                    shadeTo: 'dark',
                },
            },
            tooltip: { followCursor: true, theme: 'dark' },
            yaxis: {
                labels: { style: { colors: 'var(--fuse-text-secondary)' } },
            },
        };

        // Budget distribution
        this.chartBudgetDistribution = {
            chart: {
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'radar',
                sparkline: { enabled: true },
            },
            colors: ['#818CF8'],
            dataLabels: {
                enabled: true,
                formatter: (val: number): string | number => `${val}%`,
                textAnchor: 'start',
                style: { fontSize: '13px', fontWeight: 500 },
                background: { borderWidth: 0, padding: 4 },
                offsetY: -15,
            },
            markers: { strokeColors: '#818CF8', strokeWidth: 4 },
            plotOptions: {
                radar: {
                    polygons: {
                        strokeColors: 'var(--fuse-border)',
                        connectorColors: 'var(--fuse-border)',
                    },
                },
            },
            series: this.data.budgetDistribution.series,
            stroke: { width: 2 },
            tooltip: {
                theme: 'dark',
                y: { formatter: (val: number): string => `${val}%` },
            },
            xaxis: {
                labels: {
                    show: true,
                    style: { fontSize: '12px', fontWeight: '500' },
                },
                categories: this.data.budgetDistribution.categories,
            },
            yaxis: {
                max: (max: number): number => parseInt((max + 10).toFixed(0), 10),
                tickAmount: 7,
            },
        };

        // Weekly expenses
        this.chartWeeklyExpenses = {
            chart: {
                animations: { enabled: false },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'line',
                sparkline: { enabled: true },
            },
            colors: ['#22D3EE'],
            series: this.data.weeklyExpenses.series,
            stroke: { curve: 'smooth' },
            tooltip: { theme: 'dark' },
            xaxis: {
                type: 'category',
                categories: this.data.weeklyExpenses.labels,
            },
            yaxis: {
                labels: { formatter: (val): string => `$${val}` },
            },
        };

        // Monthly expenses
        this.chartMonthlyExpenses = {
            chart: {
                animations: { enabled: false },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'line',
                sparkline: { enabled: true },
            },
            colors: ['#4ADE80'],
            series: this.data.monthlyExpenses.series,
            stroke: { curve: 'smooth' },
            tooltip: { theme: 'dark' },
            xaxis: {
                type: 'category',
                categories: this.data.monthlyExpenses.labels,
            },
            yaxis: {
                labels: { formatter: (val): string => `$${val}` },
            },
        };

        // Yearly expenses
        this.chartYearlyExpenses = {
            chart: {
                animations: { enabled: false },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'line',
                sparkline: { enabled: true },
            },
            colors: ['#FB7185'],
            series: this.data.yearlyExpenses.series,
            stroke: { curve: 'smooth' },
            tooltip: { theme: 'dark' },
            xaxis: {
                type: 'category',
                categories: this.data.yearlyExpenses.labels,
            },
            yaxis: {
                labels: { formatter: (val): string => `$${val}` },
            },
        };

        // === ASISTENCIAS ===
        const user = this._user.value;
        const asistencias = (user?.asistencias || []).filter(a => {
            const [d, m, y] = a.fecha.split('/').map(Number);
            return y === this.añoActual;
        });


        if (asistencias.length < 2) {
            this.chartAsistenciasSeries = {
                semana: [],
                mes: [],
                anio: []
            };
        } else {
            const semanaData = asistencias.slice(-7);
            const semanaAsistencias = semanaData.map(a => 1);
            const semanaRetardos = semanaData.map(a => this.isRetardo(a) ? 1 : 0);
            const semanaFaltas = Array(semanaData.length).fill(0);

            const mesData = asistencias.slice(-30);
            const semanas = this.agruparPorSemanas(mesData);

            const empleoActual = user.empleos
                .filter(e => !e.fecha_fin)
                .sort((a, b) => new Date(b.fecha_inicio.split('/').reverse().join('-')).getTime() -
                    new Date(a.fecha_inicio.split('/').reverse().join('-')).getTime())[0];
            const fechaInicio = empleoActual ? new Date(empleoActual.fecha_inicio.split('/').reverse().join('-')) : new Date(this.añoActual, 0, 1);


            const anioData = this.agruparPorMeses(asistencias, fechaInicio);

            this.chartAsistenciasSeries = {
                semana: [
                    { name: 'Asistencias', data: semanaAsistencias },
                    { name: 'Retardos', data: semanaRetardos },
                    { name: 'Faltas', data: semanaFaltas }
                ],
                mes: [
                    { name: 'Asistencias', data: semanas.asistencias },
                    { name: 'Retardos', data: semanas.retardos },
                    { name: 'Faltas', data: semanas.faltas }
                ],
                anio: [
                    { name: 'Asistencias', data: anioData.asistencias },
                    { name: 'Retardos', data: anioData.retardos },
                    { name: 'Faltas', data: anioData.faltas }
                ]
            };
        }


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
                    formatter: (val): string => `${val} día${val !== 1 ? 's' : ''}`
                },
            },
            yaxis: {
                labels: {
                    style: { colors: 'var(--fuse-text-secondary)' },
                },
            },
        };
    }

    getXaxisForPeriod(periodo: string): any {
        let categories: string[] = [];

        if (periodo === 'semana') {
            const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
            categories = dias.slice(0, this.chartAsistenciasSeries.semana?.[0]?.data.length || 0);
        } else if (periodo === 'mes') {
            const numSemanas = this.chartAsistenciasSeries.mes?.[0]?.data.length || 0;
            categories = Array.from({ length: numSemanas }, (_, i) => `Sem ${i + 1}`);
        } else if (periodo === 'anio') {
            categories = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        }

        return {
            categories,
            labels: {
                style: { colors: 'var(--fuse-text-secondary)' },
            },
        };
    }

    private agruparPorSemanas(asistencias: any[]): any {
        if (!asistencias.length) {
            return { asistencias: [], retardos: [], faltas: [] };
        }

        // Ordenar asistencias
        asistencias.sort((a, b) => {
            const [d1, m1, y1] = a.fecha.split('/').map(Number);
            const [d2, m2, y2] = b.fecha.split('/').map(Number);
            return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
        });

        const result = { asistencias: [], retardos: [], faltas: [] };

        // Crear un mapa por fecha string para buscar rápido
        const asistenciaMap = new Map(asistencias.map(a => [a.fecha, a]));

        // Tomamos la fecha mínima y máxima de asistencia
        const fechaInicio = new Date(asistencias[0].fecha.split('/').reverse().join('-'));
        const fechaFin = new Date(asistencias[asistencias.length - 1].fecha.split('/').reverse().join('-'));

        let semanaActual = [];
        let fechaSemana = new Date(fechaInicio);
        fechaSemana.setDate(fechaSemana.getDate() - fechaSemana.getDay() + 1); // ajustar al lunes

        while (fechaSemana <= fechaFin) {
            let asistenciasSemana = 0;
            let retardosSemana = 0;
            let diasLaborablesSemana = 0;

            for (let i = 0; i < 7; i++) {
                const dia = new Date(fechaSemana);
                dia.setDate(dia.getDate() + i);
                const diaStr = `${('0' + dia.getDate()).slice(-2)}/${('0' + (dia.getMonth() + 1)).slice(-2)}/${dia.getFullYear()}`;

                if (dia.getDay() !== 0 && dia.getDay() !== 6) {
                    diasLaborablesSemana++;
                    const asistencia = asistenciaMap.get(diaStr);
                    if (asistencia) {
                        asistenciasSemana++;
                        if (this.isRetardo(asistencia)) retardosSemana++;
                    }
                }
            }

            result.asistencias.push(asistenciasSemana);
            result.retardos.push(retardosSemana);
            result.faltas.push(Math.max(0, diasLaborablesSemana - asistenciasSemana));

            // Pasar a la siguiente semana
            fechaSemana.setDate(fechaSemana.getDate() + 7);
        }

        return result;
    }


    private agruparPorMeses(asistencias: any[], fechaInicioEmpleo: Date): any {
        const meses = Array(12).fill(0).map(() => ({
            asistencias: 0,
            retardos: 0,
            faltas: 0
        }));

        if (!asistencias.length) {
            return {
                asistencias: meses.map(m => m.asistencias),
                retardos: meses.map(m => m.retardos),
                faltas: meses.map(m => m.faltas)
            };
        }

        const asistenciaMap = new Map(asistencias.map(a => [a.fecha, a]));
        const hoy = new Date();

        for (let mes = fechaInicioEmpleo.getMonth(); mes <= hoy.getMonth(); mes++) {
            const ultimoDia = new Date(this.añoActual, mes + 1, 0).getDate();
            let diasLaborables = 0;
            let asistenciasMes = 0;
            let retardosMes = 0;

            for (let dia = 1; dia <= ultimoDia; dia++) {
                const fecha = new Date(this.añoActual, mes, dia);
                if (fecha < fechaInicioEmpleo || fecha > hoy) continue; // solo fechas válidas

                if (fecha.getDay() !== 0 && fecha.getDay() !== 6) {
                    diasLaborables++;
                    const diaStr = `${('0' + fecha.getDate()).slice(-2)}/${('0' + (fecha.getMonth() + 1)).slice(-2)}/${fecha.getFullYear()}`;
                    const asistencia = asistenciaMap.get(diaStr);
                    if (asistencia) {
                        asistenciasMes++;
                        if (this.isRetardo(asistencia)) retardosMes++;
                    }
                }
            }

            meses[mes].asistencias = asistenciasMes;
            meses[mes].retardos = retardosMes;
            meses[mes].faltas = Math.max(0, diasLaborables - asistenciasMes);
        }

        return {
            asistencias: meses.map(m => m.asistencias),
            retardos: meses.map(m => m.retardos),
            faltas: meses.map(m => m.faltas)
        };
    }




    get photoUrl(): string {
        const user = this._user.value;
        if (!user?.photo) return;

        const base = this.apiBase.endsWith('/') ? this.apiBase : this.apiBase + '/';
        const photo = user.photo.startsWith('/') ? user.photo.substring(1) : user.photo;

        return `${base + photo}?v=${this._photoVersion}`;
    }

    private speak(text: string): void {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-MX';
        utterance.rate = 1;
        speechSynthesis.speak(utterance);
    }

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
            wo => wo.status_id === 5 && wo.titulo === 'Vacaciones'
        ).length;
    }

    get totalAsistencias(): number {
        const user = this._user.value;
        if (!user?.asistencias) return 0;
        return user.asistencias.filter(a => {
            const [d, m, y] = a.fecha.split('/').map(Number);
            if (y !== this.añoActual) return false;
            const fecha = new Date(y, m - 1, d);
            const diaSemana = fecha.getDay();
            return diaSemana !== 0 && diaSemana !== 6;
        }).length;
    }

    get totalRetardos(): number {
        const user = this._user.value;
        if (!user?.asistencias) return 0;
        return user.asistencias.filter(a => {
            const [d, m, y] = a.fecha.split('/').map(Number);
            if (y !== this.añoActual) return false;
            const fecha = new Date(y, m - 1, d);
            const diaSemana = fecha.getDay();
            if (diaSemana === 0 || diaSemana === 6) return false;
            return this.isRetardo(a);
        }).length;
    }

    get totalFaltas(): number {
        const user = this._user.value;
        if (!user?.asistencias) return 0;
        const empleoActual = user.empleos?.find(e => {
            const [d, m, y] = e.fecha_inicio.split('/').map(Number);
            return y === this.añoActual && !e.fecha_fin;
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
        const asistenciasDelAnio = user.asistencias
            .filter(a => {
                const [d, m, y] = a.fecha.split('/').map(Number);
                const fecha = new Date(y, m - 1, d);
                return fecha >= fechaInicio && fecha <= hoy && fecha.getDay() !== 0 && fecha.getDay() !== 6;
            }).length;
        return Math.max(0, diasLaborales - asistenciasDelAnio);



    }

    get horasTrabajadas(): number {
        const user = this._user.value;
        if (!user?.asistencias) return 0;
        const total = user.asistencias.reduce((acc, a) => {
            const [d, m, y] = a.fecha.split('/').map(Number);
            if (y !== this.añoActual) return acc;
            const fecha = new Date(y, m - 1, d);
            const diaSemana = fecha.getDay();
            if (diaSemana === 0 || diaSemana === 6) return acc;
            const [hE, mE, sE] = a.hora_entrada.split(':').map(Number);
            const [hS, mS, sS] = a.hora_salida.split(':').map(Number);
            const entrada = new Date(2000, 0, 1, hE, mE, sE);
            const salida = new Date(2000, 0, 1, hS, mS, sS);
            const horas = (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);
            return acc + horas;
        }, 0);
        return Math.round(total * 100) / 100;
    }

    isRetardo(asistencia: any): boolean {
        if (!asistencia.turno) return false;
        const [h, min, s] = asistencia.turno.hora_inicio.split(':').map(Number);
        const [hA, mA, sA] = asistencia.hora_entrada.split(':').map(Number);
        const limite = new Date(2000, 0, 1, h, min + 15, s);
        const entrada = new Date(2000, 0, 1, hA, mA, sA);
        return entrada > limite;
    }


}
