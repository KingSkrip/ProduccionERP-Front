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
import { MatSelectModule } from '@angular/material/select';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';


import { LectorQrComponent } from 'app/shared/components/lector-qr/lector-qr.component';


type Seccion = 'general' | 'rollos';

export interface InventarioGrupo {
    cliente: string;
    articulos: string[];
    agentes: string[];
    colores: string[];
    tipos: string[];
    pesoNetoTotal: number;
    piezasTotal: number;
    rollosCount: number;
    fechaUltima: string;
    items: InventarioItem[];
}

export interface OpGrupo {
    op: string;
    pedido: string;
    partida: string;
    agente: string;
    items: InventarioItem[];
    piezasTotal: number;
    pesoNetoTotal: number;
    rollosCount: number;
}

export interface PedidoGrupo {
    pedido: string;
    agente: string;
    ops: OpGrupo[];
    opsCount: number;
    piezasTotal: number;
    pesoNetoTotal: number;
    rollosCount: number;
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
        MatSelectModule,
        ZXingScannerModule,
        LectorQrComponent,
    ],
    templateUrl: './inventarios.component.html',
})
export class InventariosComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(MatPaginator) paginator?: MatPaginator;

    private readonly _unsubscribeAll = new Subject<void>();

    seccion: Seccion = 'general';
    clienteSeleccionado: string | null = null;
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
    // Drag to close (modal detalle OP - móvil)
    private touchStartYOp = 0;
    private touchCurrentYOp = 0;
    isDraggingOp = false;
    dragTransformOp = 'translateY(0)';
    dragTransitionOp = 'transform 0.3s ease';

    // Control de qué pedido está expandido (acordeón)
    pedidoExpandidoKey: string | null = null;

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



    // Búsqueda / filtros (vista rollos)
    busquedaRollos = '';
    filtroTipo: string | null = null;
    filtroColor: string | null = null;
    filtroAgente: string | null = null;

    rollosFiltrados: InventarioItem[] = [];

    tiposDisponibles: string[] = [];
    coloresDisponibles: string[] = [];
    agentesDisponibles: string[] = [];
    mostrarFiltrosRollos = false;



    // Vista rollos agrupada por Pedido -> OP
    pedidosFiltrados: PedidoGrupo[] = [];
    pedidosPaginados: PedidoGrupo[] = [];

    pedidosPageIndex = 0;
    pedidosPageSize = 10;
    pedidosPageSizeOptions = [10, 25, 50, 100];

    // Modal de detalle de OP
    opSeleccionada: OpGrupo | null = null;
    mostrarModalOp = false;



    // ============================================================
    // 🆕 ESCÁNER QR
    // ============================================================

    formatosPermitidos = [BarcodeFormat.QR_CODE];
    camarasDisponibles: MediaDeviceInfo[] = [];
    private ultimoCodigoEscaneado: string | null = null;
    private bloqueadoHastaTs = 0;




    mostrarEscaner = false;
    escaneando = false;
    errorEscaner: string | null = null;
    rolloEscaneado: InventarioItem | null = null;
    mostrarModalRollo = false;


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
    private agruparPorCliente(items: InventarioItem[]): InventarioGrupo[] {
        const mapa = new Map<string, InventarioGrupo>();

        for (const item of items) {
            const cliente = item.CLIENTE || 'SIN CLIENTE';
            let grupo = mapa.get(cliente);

            if (!grupo) {
                grupo = {
                    cliente,
                    articulos: [],
                    agentes: [],
                    colores: [],
                    tipos: [],
                    pesoNetoTotal: 0,
                    piezasTotal: 0,
                    rollosCount: 0,
                    fechaUltima: item.FECHA,
                    items: [],
                };
                mapa.set(cliente, grupo);
            }

            if (item.ARTICULO && !grupo.articulos.includes(item.ARTICULO)) {
                grupo.articulos.push(item.ARTICULO);
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

        this.gruposFiltrados = this.agruparPorCliente(itemsFiltrados);

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
        this.clienteSeleccionado = grupo.cliente;
        this.rollosDelGrupo = grupo.items;
        this.grupoExpandido = grupo.cliente;
        this.seccion = 'rollos';

        // Reset filtros
        this.busquedaRollos = '';
        this.filtroTipo = null;
        this.filtroColor = null;
        this.filtroAgente = null;
        this.pedidoExpandidoKey = null;
        this.mostrarFiltrosRollos = false;


        // Opciones para los selects, derivadas de los rollos del grupo
        this.tiposDisponibles = Array.from(
            new Set(grupo.items.map((i) => i.TIPO).filter(Boolean))
        ).sort();
        this.coloresDisponibles = Array.from(
            new Set(grupo.items.map((i) => i.COLOR).filter(Boolean))
        ).sort();
        this.agentesDisponibles = Array.from(
            new Set(grupo.items.map((i) => i.AGENTE).filter(Boolean))
        ).sort();

        this.rollosPageIndex = 0;
        this.aplicarFiltroRollos();
    }

    volverAGeneral(): void {
        this.seccion = 'general';
        this.clienteSeleccionado = null;
        this.rollosDelGrupo = [];
        this.rollosFiltrados = [];
        this.rollosPaginados = [];
        this.grupoExpandido = null;
        this.pedidoExpandidoKey = null;
        this.mostrarFiltrosRollos = false;

        this.busquedaRollos = '';
        this.filtroTipo = null;
        this.filtroColor = null;
        this.filtroAgente = null;
    }

    private aplicarFiltroRollos(): void {
        const term = this.busquedaRollos.trim().toLowerCase();

        this.rollosFiltrados = this.rollosDelGrupo.filter((item) => {
            const matchTerm =
                !term ||
                [
                    item.PEDIDO,
                    item.OP,
                    item['CVE ART'],
                    item.ARTICULO,
                    item.CLIENTE,
                    item.AGENTE,
                    item.COLOR,
                ]
                    .filter(Boolean)
                    .some((val) => String(val).toLowerCase().includes(term));

            const matchTipo = !this.filtroTipo || item.TIPO === this.filtroTipo;
            const matchColor = !this.filtroColor || item.COLOR === this.filtroColor;
            const matchAgente = !this.filtroAgente || item.AGENTE === this.filtroAgente;

            return matchTerm && matchTipo && matchColor && matchAgente;
        });

        // 👇 nuevo: agrupar por pedido/OP
        this.pedidosFiltrados = this.agruparPorPedido(this.rollosFiltrados);
        this.pedidosPageIndex = 0;
        this.actualizarPaginaPedidos();

        this.rollosPageIndex = 0;
        this.actualizarPaginaRollos();
    }

    onBuscarRollos(): void {
        this.aplicarFiltroRollos();
    }

    onFiltroRollosChange(): void {
        this.aplicarFiltroRollos();
    }

    limpiarFiltrosRollos(): void {
        this.busquedaRollos = '';
        this.filtroTipo = null;
        this.filtroColor = null;
        this.filtroAgente = null;
        this.aplicarFiltroRollos();
    }

    get hayFiltrosRollosActivos(): boolean {
        return !!(
            this.busquedaRollos ||
            this.filtroTipo ||
            this.filtroColor ||
            this.filtroAgente
        );
    }

    onRollosPageChange(event: PageEvent): void {
        this.rollosPageIndex = event.pageIndex;
        this.rollosPageSize = event.pageSize;
        this.actualizarPaginaRollos();
    }

    private actualizarPaginaRollos(): void {
        const start = this.rollosPageIndex * this.rollosPageSize;
        this.rollosPaginados = this.rollosFiltrados.slice(start, start + this.rollosPageSize);
    }

    trackByGrupo(_index: number, grupo: InventarioGrupo): string {
        return grupo.cliente;
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

    get cantidadFiltrosRollosActivos(): number {
        let count = 0;
        if (this.filtroTipo) count++;
        if (this.filtroColor) count++;
        if (this.filtroAgente) count++;
        return count;
    }

    toggleFiltrosRollos(): void {
        this.mostrarFiltrosRollos = !this.mostrarFiltrosRollos;
    }


    private agruparPorPedido(items: InventarioItem[]): PedidoGrupo[] {
        const mapaPedidos = new Map<string, PedidoGrupo>();

        for (const item of items) {
            const pedidoKey = item.PEDIDO || 'SIN PEDIDO';
            let pedidoGrupo = mapaPedidos.get(pedidoKey);

            if (!pedidoGrupo) {
                pedidoGrupo = {
                    pedido: pedidoKey,
                    agente: item.AGENTE,
                    ops: [],
                    opsCount: 0,
                    piezasTotal: 0,
                    pesoNetoTotal: 0,
                    rollosCount: 0,
                };
                mapaPedidos.set(pedidoKey, pedidoGrupo);
            }

            const opKey = item.OP || 'SIN OP';
            let opGrupo = pedidoGrupo.ops.find((o) => o.op === opKey);

            if (!opGrupo) {
                opGrupo = {
                    op: opKey,
                    pedido: pedidoKey,
                    partida: item.PEDIDOPART || '—',
                    agente: item.AGENTE,
                    items: [],
                    piezasTotal: 0,
                    pesoNetoTotal: 0,
                    rollosCount: 0,
                };
                pedidoGrupo.ops.push(opGrupo);
                pedidoGrupo.opsCount += 1;
            }

            opGrupo.items.push(item);
            opGrupo.piezasTotal += Number(item.PIEZA) || 0;
            opGrupo.pesoNetoTotal += Number(item['PESO NETO']) || 0;
            opGrupo.rollosCount += 1;

            pedidoGrupo.piezasTotal += Number(item.PIEZA) || 0;
            pedidoGrupo.pesoNetoTotal += Number(item['PESO NETO']) || 0;
            pedidoGrupo.rollosCount += 1;
        }

        return Array.from(mapaPedidos.values());
    }

    private actualizarPaginaPedidos(): void {
        const start = this.pedidosPageIndex * this.pedidosPageSize;
        this.pedidosPaginados = this.pedidosFiltrados.slice(start, start + this.pedidosPageSize);
    }

    onPedidosPageChange(event: PageEvent): void {
        this.pedidosPageIndex = event.pageIndex;
        this.pedidosPageSize = event.pageSize;
        this.pedidoExpandidoKey = null;
        this.actualizarPaginaPedidos();
    }
    trackByPedido(_index: number, grupo: PedidoGrupo): string {
        return grupo.pedido;
    }

    trackByOp(_index: number, op: OpGrupo): string {
        return op.pedido + '-' + op.op;
    }

    verDetalleOp(op: OpGrupo): void {
        this.opSeleccionada = op;
        this.mostrarModalOp = true;
    }

    cerrarModalOp(): void {
        this.mostrarModalOp = false;
        this.opSeleccionada = null;
    }



    togglePedido(pedido: PedidoGrupo): void {
        this.pedidoExpandidoKey = this.pedidoExpandidoKey === pedido.pedido ? null : pedido.pedido;
    }

    isPedidoExpandido(pedido: PedidoGrupo): boolean {
        return this.pedidoExpandidoKey === pedido.pedido;
    }

    onTouchStartOp(event: TouchEvent): void {
        this.touchStartYOp = event.touches[0].clientY;
        this.touchCurrentYOp = this.touchStartYOp;
        this.isDraggingOp = true;
        this.dragTransitionOp = 'none';
    }

    onTouchMoveOp(event: TouchEvent): void {
        if (!this.isDraggingOp) return;
        this.touchCurrentYOp = event.touches[0].clientY;
        const delta = this.touchCurrentYOp - this.touchStartYOp;
        if (delta > 0) {
            this.dragTransformOp = `translateY(${delta}px)`;
        }
    }

    onTouchEndOp(): void {
        const delta = this.touchCurrentYOp - this.touchStartYOp;
        this.isDraggingOp = false;
        this.dragTransitionOp = 'transform 0.3s ease';

        if (delta > 120) {
            // Se deslizó lo suficiente → cerrar
            this.dragTransformOp = 'translateY(100%)';
            setTimeout(() => {
                this.cerrarModalOp();
                this.dragTransformOp = 'translateY(0)';
            }, 200);
        } else {
            // No fue suficiente → regresa a su lugar
            this.dragTransformOp = 'translateY(0)';
        }
    }


    // ============================================================
    // 🆕 MÉTODOS DEL ESCÁNER
    // ============================================================

    abrirEscaner(): void {
        this.errorEscaner = null;
        this.rolloEscaneado = null;
        this.mostrarModalRollo = false;
        this.mostrarEscaner = true;
    }

    cerrarEscaner(): void {
        this.mostrarEscaner = false;
        this.escaneando = false;
    }

    onCamarasEncontradas(devices: MediaDeviceInfo[]): void {
        this.camarasDisponibles = devices;
        if (!devices?.length) {
            this.errorEscaner = 'No se encontró ninguna cámara disponible en este dispositivo.';
        }
    }

    onPermisoCamara(permitido: boolean): void {
        if (!permitido) {
            this.errorEscaner = 'Necesitamos permiso de cámara para poder escanear el QR.';
            this.mostrarEscaner = false;
        }
    }

    onScanSuccess(codigo: string): void {
        this.buscarRolloPorCodigo(codigo);
    }


    private buscarRolloPorCodigo(codigo: string): void {
        this.escaneando = true;
        this.errorEscaner = null;

        this.inventariosService
            .escanearQr(codigo)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (data) => {
                    this.escaneando = false;
                    this.rolloEscaneado = data;
                    this.mostrarEscaner = false;
                    this.mostrarModalRollo = true;
                    this.cdr.markForCheck();
                },
                error: (err) => {
                    this.escaneando = false;
                    this.errorEscaner =
                        err?.error?.message ?? 'No se encontró ningún rollo con ese código.';
                    this.cdr.markForCheck();
                },
            });
    }

    cerrarModalRollo(): void {
        this.mostrarModalRollo = false;
        this.rolloEscaneado = null;
    }

    /** Campos a mostrar en el modal de detalle del rollo escaneado, en orden. */
    get camposRollo(): { label: string; key: string }[] {
        return [
            { label: 'Clave (QR)', key: 'ID_QR' },
            { label: 'Cve. artículo', key: 'CVE ART' },
            { label: 'Artículo', key: 'ARTICULO' },
            { label: 'Cliente', key: 'CLIENTE' },
            { label: 'Agente', key: 'AGENTE' },
            { label: 'Pedido', key: 'PEDIDO' },
            { label: 'OP', key: 'OP' },
            { label: 'Pedido/Partida', key: 'PEDIDOPART' },
            { label: 'Color', key: 'COLOR' },
            { label: 'Cód. color', key: 'COD. COLOR' },
            { label: 'Tipo', key: 'TIPO' },
            { label: 'Peso neto', key: 'PESO NETO' },
            { label: 'Piezas', key: 'PIEZA' },
            { label: 'Producto', key: 'PRODUCTO' },
            { label: 'Proceso', key: 'PROCESO' },
            { label: 'Fecha', key: 'FECHA' },
            { label: 'Fecha ingreso', key: 'FECHA ING' },
            { label: 'Fecha salida', key: 'FECHA SAL' },
            { label: 'Fecha devolución', key: 'FECHA DEV' },
            { label: 'Folio PL', key: 'PL' },
            { label: 'Orden', key: 'ORDEN' },
        ];
    }

    valorCampo(item: any, key: string): string {
        const val = item?.[key];
        if (val === null || val === undefined || val === '') return '—';
        return String(val);
    }
}