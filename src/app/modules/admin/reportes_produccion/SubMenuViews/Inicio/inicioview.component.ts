import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { ReportProdService } from '../../reportprod.service';
import { SharedDataService } from '../../list/shared-data.service';

interface MetricCard {
    title: string;
    value: number;
    icon: string;
    color: string;
    loading: boolean;
}

@Component({
    selector: 'inicio-view',
    templateUrl: './inicioview.component.html',
    styleUrls: ['./inicioview.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatProgressSpinnerModule
    ]
})
export class InicioViewComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    metrics: MetricCard[] = [
        { title: 'Producción tejido', value: 0, icon: 'inventory_2', color: 'bg-blue-500', loading: true },
        { title: 'Revisado', value: 0, icon: 'check_circle', color: 'bg-green-500', loading: true },
        { title: 'Por revisar', value: 0, icon: 'pending', color: 'bg-yellow-500', loading: true },
        { title: 'Saldos', value: 0, icon: 'account_balance', color: 'bg-purple-500', loading: true },
        { title: 'Entregado a embarques', value: 0, icon: 'local_shipping', color: 'bg-indigo-500', loading: true },
        { title: 'Facturado', value: 0, icon: 'receipt_long', color: 'bg-pink-500', loading: true }
    ];

    tejidoResumen: any[] = [];
    acabadoResumen: any[] = [];
    estampadosResumen: any[] = [];
    tintoreriaResumen: any[] = [];

    constructor(
        private reportService: ReportProdService,
        private sharedData: SharedDataService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        // Cargar datos iniciales
        this.cargarDatosIniciales();

        // Escuchar cambios en los filtros globales
        this.sharedData.recargarDatos$
            .pipe(takeUntil(this.destroy$))
            .subscribe(recargar => {
                if (recargar) {
                    this.recargarDatos();
                    this.sharedData.confirmarRecargaConsumida();
                }
            });

        // Suscribirse a los datos compartidos
        this.suscribirseADatosCompartidos();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private cargarDatosIniciales(): void {
        const filtros = this.sharedData.obtenerFiltros();
        const { fechaInicio, fechaFin } = this.obtenerFechasDeRango(filtros.rangoFecha);
        this.loadAllMetrics(fechaInicio, fechaFin);
    }

    private recargarDatos(): void {
        const filtros = this.sharedData.obtenerFiltros();
        const { fechaInicio, fechaFin } = this.obtenerFechasDeRango(filtros.rangoFecha, filtros.fechaInicio, filtros.fechaFin);
        
        // Reiniciar loading
        this.metrics.forEach(m => m.loading = true);
        this.cdr.markForCheck();

        this.loadAllMetrics(fechaInicio, fechaFin);
    }

    private obtenerFechasDeRango(
        rango: string, 
        fechaInicioCustom?: Date | null, 
        fechaFinCustom?: Date | null
    ): { fechaInicio: Date; fechaFin: Date } {
        const hoy = new Date();
        let fechaInicio: Date;
        let fechaFin: Date = new Date(hoy);

        switch (rango) {
            case 'hoy':
                fechaInicio = new Date(hoy);
                break;
            case 'ayer':
                const ayer = new Date(hoy);
                ayer.setDate(ayer.getDate() - 1);
                fechaInicio = ayer;
                fechaFin = ayer;
                break;
            case 'mes_actual':
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                break;
            case 'mes_anterior':
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
                break;
            case 'fecha_especifica':
            case 'periodo':
                fechaInicio = fechaInicioCustom || new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                fechaFin = fechaFinCustom || hoy;
                break;
            default:
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        }

        return { fechaInicio, fechaFin };
    }

    private suscribirseADatosCompartidos(): void {
        // Tejido
        this.sharedData.datosTejido$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.metrics[0].value = data.reduce((sum, item) => sum + parseFloat(String(item.TOTAL_TJ || 0)), 0);
                this.metrics[0].loading = false;
                this.cdr.markForCheck();
            });

        // Revisado
        this.sharedData.datosRevisado$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.metrics[1].value = data.reduce((sum, item) => sum + parseFloat(String(item.TOTAL_RV || 0)), 0);
                this.metrics[1].loading = false;
                this.cdr.markForCheck();
            });

        // Por Revisar
        this.sharedData.datosPorRevisar$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.metrics[2].value = data.reduce((sum, item) => sum + parseFloat(String(item.TOTAL_POR_REVISAR || 0)), 0);
                this.metrics[2].loading = false;
                this.cdr.markForCheck();
            });

        // Saldos
        this.sharedData.datosSaldos$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.metrics[3].value = data.reduce((sum, item) => sum + parseFloat(String(item.TOTAL_SALDO || 0)), 0);
                this.metrics[3].loading = false;
                this.cdr.markForCheck();
            });

        // Embarques
        this.sharedData.datosEmbarques$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.metrics[4].value = data.reduce((sum, item) => sum + parseFloat(String(item.CANTIDAD || 0)), 0);
                this.metrics[4].loading = false;
                this.cdr.markForCheck();
            });

        // Facturado
        this.sharedData.datosFacturado$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.metrics[5].value = data?.total?.pneto || 0;
                this.metrics[5].loading = false;
                this.cdr.markForCheck();
            });

        // Tejido Resumen
        this.sharedData.datosTejidoResumen$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.tejidoResumen = data;
                this.cdr.markForCheck();
            });

        // Acabado
        this.sharedData.datosAcabado$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.acabadoResumen = data;
                this.cdr.markForCheck();
            });

        // Estampados
        this.sharedData.datosEstampados$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.estampadosResumen = data;
                this.cdr.markForCheck();
            });

        // Tintorería
        this.sharedData.datosTintoreria$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.tintoreriaResumen = data;
                this.cdr.markForCheck();
            });
    }

    private loadAllMetrics(fechaInicio: Date, fechaFin: Date): void {
        // Producción Tejido
        this.reportService.getProduccionTejido(fechaInicio, fechaFin).subscribe({
            next: (data) => {
                this.sharedData.actualizarTejido(data, data);
            },
            error: () => {
                this.metrics[0].loading = false;
                this.cdr.markForCheck();
            }
        });

        // Revisado
        this.reportService.getRevisadoTejido(fechaInicio, fechaFin).subscribe({
            next: (data) => {
                this.sharedData.actualizarRevisado(data, data);
            },
            error: () => {
                this.metrics[1].loading = false;
                this.cdr.markForCheck();
            }
        });

        // Por Revisar
        this.reportService.getPorRevisarTejido(fechaInicio, fechaFin).subscribe({
            next: (data) => {
                this.sharedData.actualizarPorRevisar(data, data);
            },
            error: () => {
                this.metrics[2].loading = false;
                this.cdr.markForCheck();
            }
        });

        // Saldos
        this.reportService.getSaldosTejido(fechaInicio, fechaFin).subscribe({
            next: (data) => {
                this.sharedData.actualizarSaldos(data, data);
            },
            error: () => {
                this.metrics[3].loading = false;
                this.cdr.markForCheck();
            }
        });

        // Entregado a Embarques
        this.reportService.getEntregadoaEmbarques(fechaInicio, fechaFin).subscribe({
            next: (data) => {
                this.sharedData.actualizarEmbarques(data, data);
            },
            error: () => {
                this.metrics[4].loading = false;
                this.cdr.markForCheck();
            }
        });

        // Facturado
        this.reportService.getFacturado(fechaInicio, fechaFin, false).subscribe({
            next: (data) => {
                this.sharedData.actualizarFacturado(data);
            },
            error: () => {
                this.metrics[5].loading = false;
                this.cdr.markForCheck();
            }
        });

        // Resúmenes adicionales
        this.reportService.getTejidoResumen(fechaInicio, fechaFin).subscribe({
            next: (data) => {
                this.sharedData.actualizarTejidoResumen(data, data);
            },
            error: (err) => console.error('Error tejido resumen:', err)
        });

        this.reportService.getAcabado(fechaInicio, fechaFin).subscribe({
            next: (data) => {
                this.sharedData.actualizarAcabado(data, data);
            },
            error: (err) => console.error('Error acabado:', err)
        });

        this.reportService.getEstampados(fechaInicio, fechaFin).subscribe({
            next: (data) => {
                this.sharedData.actualizarEstampados(data);
            },
            error: (err) => console.error('Error estampados:', err)
        });

        this.reportService.getTintoreria(fechaInicio, fechaFin).subscribe({
            next: (data) => {
                this.sharedData.actualizarTintoreria(data);
            },
            error: (err) => console.error('Error tintorería:', err)
        });
    }

    formatNumber(value: number): string {
        return new Intl.NumberFormat('es-MX').format(value);
    }
}