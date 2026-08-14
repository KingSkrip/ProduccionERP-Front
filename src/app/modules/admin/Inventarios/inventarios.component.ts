import { CommonModule } from '@angular/common';
import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { InventariosService } from './inventarios.service';
import { InventarioFiltros, InventarioItem } from './types/inventario.type';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

type Seccion = 'general' | 'rollos';

export interface InventarioGrupo {
    cveArt: string;
    articulo: string;
    clientes: string[];
    agentes: string[];
    colores: string[];
    tipos: string[];
    pesoNetoTotal: number;
    piezasTotal: number;
    rollosCount: number;
    fechaUltima: string;
    items: InventarioItem[];
}

@Component({
    selector: 'app-inventario',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
    ],
    templateUrl: './inventarios.component.html',
})
export class InventariosComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(MatPaginator) paginator?: MatPaginator;

    private readonly _unsubscribeAll = new Subject<void>();

    seccion: Seccion = 'general';
    cveArtSeleccionado: string | null = null;
    grupoExpandido: string | null = null;

    // Data cruda
    items: InventarioItem[] = [];

    // Agrupado por CVE ART (vista general)
    gruposFiltrados: InventarioGrupo[] = [];
    gruposPaginados: InventarioGrupo[] = [];

    // Estado
    cargando = false;
    error: string | null = null;

    // Búsqueda / filtros
    busqueda = '';


    // Detalle de rollos para el grupo seleccionado (vista rollos)
    rollosDelGrupo: InventarioItem[] = [];
    rollosPaginados: InventarioItem[] = [];

    // Paginación (vista general)
    pageIndex = 0;
    pageSize = 10;
    pageSizeOptions = [10, 25, 50, 100];

    // Paginación (vista rollos)
    rollosPageIndex = 0;
    rollosPageSize = 5;
    rollosPageSizeOptions = [5, 10, 25, 50, 100];

    constructor(
        private inventariosService: InventariosService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.cargarInventario();
    }

    ngAfterViewInit(): void { }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    cargarInventario(filtros?: InventarioFiltros): void {
        this.cargando = true;
        this.error = null;

        this.inventariosService
            .getInventario(filtros)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (data) => {
                    this.items = data ?? [];
                    this.aplicarFiltro();
                    this.cargando = false;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.error = 'No se pudo cargar el inventario. Intenta de nuevo.';
                    this.cargando = false;
                    this.cdr.markForCheck();
                },
            });
    }

    /** Agrupa un arreglo plano de items por CVE ART, acumulando totales. */
    private agruparPorCveArt(items: InventarioItem[]): InventarioGrupo[] {
        const mapa = new Map<string, InventarioGrupo>();

        for (const item of items) {
            const cveArt = item['CVE ART'];
            let grupo = mapa.get(cveArt);

            if (!grupo) {
                grupo = {
                    cveArt,
                    articulo: item.ARTICULO,
                    clientes: [],
                    agentes: [],
                    colores: [],
                    tipos: [],
                    pesoNetoTotal: 0,
                    piezasTotal: 0,
                    rollosCount: 0,
                    fechaUltima: item.FECHA,
                    items: [],
                };
                mapa.set(cveArt, grupo);
            }

            if (item.CLIENTE && !grupo.clientes.includes(item.CLIENTE)) {
                grupo.clientes.push(item.CLIENTE);
            }
            if (item.AGENTE && !grupo.agentes.includes(item.AGENTE)) {
                grupo.agentes.push(item.AGENTE);
            }
            if (item.COLOR && !grupo.colores.includes(item.COLOR)) {
                grupo.colores.push(item.COLOR);
            }
            if (item.TIPO && !grupo.tipos.includes(item.TIPO)) {
                grupo.tipos.push(item.TIPO);
            }

            grupo.pesoNetoTotal += Number(item['PESO NETO']) || 0;
            grupo.piezasTotal += Number(item.PIEZA) || 0;
            grupo.rollosCount += 1;
            grupo.items.push(item);

            if (new Date(item.FECHA) > new Date(grupo.fechaUltima)) {
                grupo.fechaUltima = item.FECHA;
            }
        }

        return Array.from(mapa.values());
    }

    aplicarFiltro(): void {
        const term = this.busqueda.trim().toLowerCase();

        const itemsFiltrados = !term
            ? this.items
            : this.items.filter((item) =>
                [
                    item['CVE ART'],
                    item.ARTICULO,
                    item.CLIENTE,
                    item.AGENTE,
                    item.PEDIDO,
                    item.OP,
                ]
                    .filter(Boolean)
                    .some((val) => String(val).toLowerCase().includes(term))
            );

        this.gruposFiltrados = this.agruparPorCveArt(itemsFiltrados);

        this.pageIndex = 0;
        this.actualizarPagina();
    }

    onBuscar(): void {
        this.aplicarFiltro();
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.actualizarPagina();
    }

    private actualizarPagina(): void {
        const start = this.pageIndex * this.pageSize;
        this.gruposPaginados = this.gruposFiltrados.slice(start, start + this.pageSize);
    }

    verRollos(grupo: InventarioGrupo): void {
        this.cveArtSeleccionado = grupo.cveArt;
        this.rollosDelGrupo = grupo.items;
        this.grupoExpandido = grupo.cveArt;
        this.seccion = 'rollos';

        this.rollosPageIndex = 0;
        this.actualizarPaginaRollos();
    }

    volverAGeneral(): void {
        this.seccion = 'general';
        this.cveArtSeleccionado = null;
        this.rollosDelGrupo = [];
        this.rollosPaginados = [];
        this.grupoExpandido = null;
    }

    onRollosPageChange(event: PageEvent): void {
        this.rollosPageIndex = event.pageIndex;
        this.rollosPageSize = event.pageSize;
        this.actualizarPaginaRollos();
    }

    private actualizarPaginaRollos(): void {
        const start = this.rollosPageIndex * this.rollosPageSize;
        this.rollosPaginados = this.rollosDelGrupo.slice(start, start + this.rollosPageSize);
    }

    trackByGrupo(_index: number, grupo: InventarioGrupo): string {
        return grupo.cveArt;
    }

    trackByItem(_index: number, item: InventarioItem): string {
        return item.ID;
    }

    // === Agregar dentro de la clase InventariosComponent, junto a los demás campos/métodos ===

    get totalPiezas(): number {
        return this.gruposFiltrados.reduce((s, g) => s + g.piezasTotal, 0);
    }

    get totalPeso(): number {
        return this.gruposFiltrados.reduce((s, g) => s + g.pesoNetoTotal, 0);
    }

    get totalRollos(): number {
        return this.gruposFiltrados.reduce((s, g) => s + g.rollosCount, 0);
    }
}