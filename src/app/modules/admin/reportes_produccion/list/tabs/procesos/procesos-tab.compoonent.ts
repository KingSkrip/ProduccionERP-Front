import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { fuseAnimations } from '@fuse/animations';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SharedDataService } from '../../shared-data.service';

interface DatoAgrupado {
    departamento: string;
    procesos: { proceso: string; cantidad: number }[];
    cantidadTotal: number;
    expandido?: boolean;
}

@Component({
    selector: 'tabs-procesos-tab',
    templateUrl: './procesos-tab.component.html',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations
})
export class ProcesosTabComponent implements OnInit, OnDestroy {

    datosFiltrados: any[] = [];
    datosAgrupados: DatoAgrupado[] = [];
    
    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _cd: ChangeDetectorRef,
        private _sharedDataService: SharedDataService
    ) { }

    ngOnInit(): void {
        this._sharedDataService.datosFiltrados$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(datosFiltrados => {
                this.datosFiltrados = datosFiltrados ?? [];
                const filtros = this._sharedDataService.obtenerFiltros();
                
                if (filtros.proceso) {
                    this.datosAgrupados = [];
                } else {
                    this.agruparDatosPorDepartamento();
                }

                this._cd.markForCheck();
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    agruparDatosPorDepartamento(): void {
        const map = new Map<string, DatoAgrupado>();

        this.datosFiltrados.forEach(item => {
            const depto = item.departamento;
            const cantidad = Number(item.CANTIDAD) || 0;

            if (!map.has(depto)) {
                map.set(depto, {
                    departamento: depto,
                    procesos: [],
                    cantidadTotal: 0,
                    expandido: false
                });
            }

            const grupo = map.get(depto)!;
            grupo.procesos.push({
                proceso: item.proceso,
                cantidad
            });
            grupo.cantidadTotal += cantidad;
        });

        this.datosAgrupados = Array.from(map.values());
    }

    toggleDepartamento(index: number): void {
        this.datosAgrupados[index].expandido = !this.datosAgrupados[index].expandido;
        this._cd.markForCheck();
    }

    calcularCantidadTotal(): number {
        return this.datosAgrupados.reduce((total, grupo) => 
            total + grupo.cantidadTotal, 0
        );
    }

    contarDepartamentos(): number {
        return this.datosAgrupados.length;
    }

    trackByFn(index: number, item: any): string {
        return item.departamento ?? index.toString();
    }
}