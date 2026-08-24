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
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { ModalDetalleOpComponent } from 'app/modules/modals/inventarios/detalle-op/detalle-op-modal.component';
import { ModalEscanerQrComponent } from 'app/modules/modals/inventarios/scanner/scanner-rollo-modal.component';
import { ModalRolloDetalleComponent } from 'app/modules/modals/inventarios/detalles/detalles-rollo-modal.component';

import { InventariosService } from './inventarios.service';
import { InventarioFiltros, InventarioItem } from './types/inventario.type';

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
        MatTooltipModule,
        MatSelectModule,
        ModalDetalleOpComponent,
        ModalEscanerQrComponent,
        ModalRolloDetalleComponent,
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
    // ESCÁNER QR
    // ============================================================

    camarasDisponibles: MediaDeviceInfo[] = [];

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

    // ============================================================
    // MÉTODOS DEL ESCÁNER
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


    private readonly camposComunes: { label: string; key: string }[] = [
        { label: 'Clave (QR)', key: 'ID_QR' },
        { label: 'Artículo', key: 'ARTICULO' },
        { label: 'Cliente', key: 'CLIENTE' },
        { label: 'Agente', key: 'AGENTE' },
        { label: 'Pedido', key: 'PEDIDO' },
        { label: 'OP', key: 'OP' },
        { label: 'Pedido/Partida', key: 'PEDIDOPART' },
        { label: 'Color', key: 'COLOR' },
        { label: 'Cód. color', key: 'COD. COLOR' },
        { label: 'Fecha', key: 'FECHA' },
        { label: 'Orden', key: 'ORDEN' },
        { label: 'Proceso', key: 'PROCESO' },
    ];



    private readonly camposAcabado: { label: string; key: string }[] = [
        { label: 'Clave (QR)', key: 'ID_QR' },
        { label: 'Cve. artículo', key: 'CVE ART' },
        ...this.camposComunes.slice(1),
        { label: 'Tipo', key: 'TIPO' },
        { label: 'Peso neto', key: 'PESO NETO' },
        { label: 'Piezas', key: 'PIEZA' },
        { label: 'Producto', key: 'PRODUCTO' },
        { label: 'Fecha ingreso', key: 'FECHA ING' },
        { label: 'Fecha salida', key: 'FECHA SAL' },
        { label: 'Fecha devolución', key: 'FECHA DEV' },
        { label: 'Folio PL', key: 'PL' },
    ];

    /** PESADO-TEJIDO: shape común + datos propios de la pieza tejida (Paso 1). */
    private readonly camposPesado: { label: string; key: string }[] = [
        ...this.camposComunes.map((c) =>
            c.key === 'FECHA' ? { ...c, label: 'Fecha de Orden' } : c
        ),
        { label: 'Cve. artículo', key: 'CVE_ART' },
        { label: 'Nombre artículo', key: 'NOMBRE' },
        { label: 'Tejido', key: 'TEJIDO' },
        { label: 'Hilatura', key: 'HILATURA' },
        { label: 'Máquina', key: 'MAQUINA' },
        { label: 'No. de Pieza', key: 'PIEZA' },
        { label: 'Peso tejido', key: 'PESO_TEJIDO' },
        { label: 'Fecha pesado', key: 'FECHA_PESADO' },
        { label: 'Cantidad de Solicitud', key: 'CANT' },
        { label: 'Cantidad entregada', key: 'CANTENT' },
        { label: 'Estatus pesado', key: 'PESADO_ESTATUS' },
        { label: '¿Pesado completo?', key: 'PESADO_COMPLETO' },
    ];

    /** REVISADO — proceso normal (aún no surtido ni vendido). */
    private readonly camposRevisadoProceso: { label: string; key: string }[] = [
        ...this.camposComunes,
        { label: 'Peso revisado', key: 'PESO_REVISADO' },
        { label: 'Fecha revisado', key: 'FECHA_REVISADO' },
        { label: 'Orden tejido', key: 'ORDEN_TEJIDO' },
        { label: 'Clasificación', key: 'CLASIFICACION' },
        { label: 'Máquina', key: 'MAQUINA' },
        { label: 'Tejido', key: 'TEJIDO' },
        { label: 'Composición', key: 'COMPOSICION' },
        { label: 'Tejedor', key: 'TEJEDOR' },
        { label: 'Revisador', key: 'REVISADOR' },
    ];

    /** REVISADO — ya tiene orden de surtido asignada (y no está en ACABADO aún). */
    /** REVISADO — ya tiene orden de surtido asignada (y no está en ACABADO aún). */
    private readonly camposRevisadoSurtido: { label: string; key: string }[] = [
        ...this.camposComunes,
        { label: 'Orden que surte', key: 'ORDEN_SURTE' },
        { label: 'Peso revisado', key: 'PESO_REVISADO' },
        { label: 'Fecha revisado', key: 'FECHA_REVISADO' },
        { label: 'Orden tejido', key: 'ORDEN_TEJIDO' },
        { label: 'Clasificación', key: 'CLASIFICACION' },
        { label: 'Máquina', key: 'MAQUINA' },
        { label: 'Tejido', key: 'TEJIDO' },
        { label: 'Composición', key: 'COMPOSICION' },
        { label: 'Tejedor', key: 'TEJEDOR' },
        { label: 'Revisador', key: 'REVISADOR' },
    ];

    /** REVISADO — la orden que surte está en Control de Calidad (ORDENESEST = 4). */
    private readonly camposRevisadoControlCalidad: { label: string; key: string }[] = [
        ...this.camposComunes,
        { label: 'Orden que surte', key: 'ORDEN_SURTE' },
        { label: 'Peso revisado', key: 'PESO_REVISADO' },
        { label: 'Fecha revisado', key: 'FECHA_REVISADO' },
        { label: 'Orden tejido', key: 'ORDEN_TEJIDO' },
        { label: 'Clasificación', key: 'CLASIFICACION' },
        { label: 'Máquina', key: 'MAQUINA' },
        { label: 'Tejido', key: 'TEJIDO' },
        { label: 'Composición', key: 'COMPOSICION' },
        { label: 'Tejedor', key: 'TEJEDOR' },
        { label: 'Revisador', key: 'REVISADOR' },
    ];

    /** REVISADO — sin orden asociada y sin venta directa. */
    private readonly camposRevisadoSinOrden: { label: string; key: string }[] = [
        { label: 'Clave (QR)', key: 'ID_QR' },
        { label: 'Cve. artículo', key: 'CVE_ART' },
        { label: 'Piezas', key: 'PIEZA' },
        { label: 'Peso tejido', key: 'PESO_TJ' },
        { label: 'Peso salón', key: 'PESO_SL' },
        { label: 'Almacén', key: 'ALMACEN' },
        { label: 'Folio inventario', key: 'FOLIO_INVENTARIO' },
        { label: 'Peso revisado', key: 'PESO_REVISADO' },
        { label: 'Fecha revisado', key: 'FECHA_REVISADO' },
        { label: 'Orden tejido', key: 'ORDEN_TEJIDO' },
        { label: 'Clasificación', key: 'CLASIFICACION' },
        { label: 'Máquina', key: 'MAQUINA' },
        { label: 'Artículo', key: 'ARTICULO' },
        { label: 'Tejido', key: 'TEJIDO' },
        { label: 'Composición', key: 'COMPOSICION' },
        { label: 'Tejedor', key: 'TEJEDOR' },
        { label: 'Revisador', key: 'REVISADOR' },
    ];

    /** REVISADO — ya se vendió (venta directa). Shape totalmente distinto. */
    private readonly camposRevisadoVenta: { label: string; key: string }[] = [
        { label: 'Clave (QR)', key: 'ID_QR' },
        { label: 'Cve. artículo', key: 'CVE_ART' },
        { label: 'Piezas', key: 'PIEZA' },
        { label: 'Peso tejido', key: 'PESO_TJ' },
        { label: 'Peso salón', key: 'PESO_SL' },
        { label: 'Peso revisado', key: 'PESO_REVISADO' },
        { label: 'Orden tejido', key: 'CVE_ORDEN' },
        { label: 'Orden que surte', key: 'ORDEN_SURTE' },
        { label: 'Almacén', key: 'ALMACEN' },
        { label: 'Folio inventario', key: 'FOLIO_INVENTARIO' },
        { label: 'Folio de venta', key: 'FOLIO_VENTA' },
        { label: '¿Entregado?', key: 'ENTREGADO' },
        { label: 'Fecha entrega', key: 'FECHA_ENTREGA' },
        { label: 'Usuario entrega', key: 'USUARIO_ENTREGA' },
        { label: 'Fecha entrega (venta)', key: 'FECHA_ENTREGA_CDO' },
        { label: 'Usuario laboratorio', key: 'USELAB' },
    ];

    /** Elige la lista de campos según en qué proceso/subtipo se encontró el rollo. */
    get camposRollo(): { label: string; key: string }[] {
        const origen = this.rolloEscaneado?.ORIGEN;
        const subtipo = this.rolloEscaneado?.SUBTIPO;

        if (origen === 'PESADO') {
            return this.camposPesado;
        }

        if (origen === 'REVISADO') {
            if (subtipo === 'VENTA_DIRECTA') return this.camposRevisadoVenta;
            if (subtipo === 'SURTIDO') return this.camposRevisadoSurtido;
            if (subtipo === 'CONTROL_CALIDAD') return this.camposRevisadoControlCalidad;
            if (subtipo === 'SIN_ORDEN') return this.camposRevisadoSinOrden;
            return this.camposRevisadoProceso;
        }

        // ACABADO por defecto
        return this.camposAcabado;
    }

    /** Texto y color del badge de origen, para mostrarlo arriba del modal. */
    get origenBadge(): { texto: string; clase: string } {
        const origen = this.rolloEscaneado?.ORIGEN;
        const subtipo = this.rolloEscaneado?.SUBTIPO;

        if (origen === 'PESADO') {
            return {
                texto: 'PESADO-TEJIDO',
                clase: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            };
        }

        if (origen === 'REVISADO') {
           if (subtipo === 'VENTA_DIRECTA') {
    const ordenSurte = this.rolloEscaneado?.ORDEN_SURTE;
    const sinOrdenSurte =
        ordenSurte === null ||
        ordenSurte === undefined ||
        ordenSurte === 0 ||
        ordenSurte === '0' ||
        ordenSurte === '';

    return {
        texto: sinOrdenSurte ? 'VENTA DIRECTA' : 'VENDIDO',
        clase: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    };
}
            if (subtipo === 'SURTIDO') {
                return {
                    texto: 'CRUDO · SURTIDO',
                    clase: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                };
            }
            if (subtipo === 'CONTROL_CALIDAD') {
                return {
                    texto: 'CRUDO · CONTROL DE CALIDAD',
                    clase: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                };
            }
            if (subtipo === 'SIN_ORDEN') {
                return {
                    texto: 'CRUDO · SIN ORDEN',
                    clase: 'bg-gray-200 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
                };
            }
            return {
                texto: 'CRUDO',
                clase: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
            };
        }

        if (origen === 'FACTURACION') {
            return {
                texto: 'FACTURACIÓN',
                clase: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
            };
        }

        // ACABADO por defecto
        return {
            texto: 'ACABADO',
            clase: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        };
    }

    get pedidosCountCliente(): number {
        return this.pedidosFiltrados.length;
    }

    get rollosCountCliente(): number {
        return this.rollosFiltrados.length;
    }

    get pesoNetoClienteTotal(): number {
        return this.rollosFiltrados.reduce(
            (s, item) => s + (Number(item['PESO NETO']) || 0),
            0
        );
    }
}