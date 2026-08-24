export interface InventarioItem {
    ID: string;
    ID_QR?: string;
    ORIGEN?: 'PESADO' | 'REVISADO' | 'ACABADO' | 'FACTURACION';
    SUBTIPO?: 'PROCESO' | 'SURTIDO' | 'VENTA_DIRECTA' | 'SIN_ORDEN' | 'CONTROL_CALIDAD';

    // Campos que SIEMPRE trae el listado general (/inventario) — obligatorios
    'CVE ART': string;
    ARTICULO: string;
    CLIENTE: string;
    AGENTE: string;
    PEDIDO: string;
    OP: string;
    PEDIDOPART: string;
    'COD. COLOR': string;
    COLOR: string;
    FECHA: string;
    TIPO: 'PRIMERA' | 'PREFERIDA' | 'ORILLAS' | 'RETAZO' | 'SEGUNDA' | 'MUESTRA' | 'OTRAS';
    'PESO NETO': number;
    PIEZA: number;
    ESTATUS: number;
    ISDELIV: number;
    'FECHA ING': string | null;
    'FECHA SAL': string | null;
    'FECHA DEV': string | null;
    PL: string | number | null;
    PROCESO: string | number | null;
    PRODUCTO: 'ROLLO' | 'TELA' | '' | null;
    ORDEN?: string | number;
    OE_ESTATUS?: string | number;

    // Solo REVISADO / SUBTIPO SURTIDO o CONTROL_CALIDAD
    ORDEN_SURTE?: string | number;

    // Solo REVISADO — orden con la que se mandó a tejer (todos los subtipos de REVISADO)
    ORDEN_TEJIDO?: string | number;
    PESO_REVISADO?: number;
    CVE_ORDEN?: string | number;

    // Solo REVISADO / SUBTIPO VENTA_DIRECTA (vienen de PSDTABPZASTJ)
    CVE_ART?: string | number;
    PESO_TJ?: number;
    PESO_SL?: number;
    ALMACEN?: string | number;
    FOLIO_INVENTARIO?: string | number | null;
    FOLIO_VENTA?: string | number;
    ENTREGADO?: boolean;
    FECHA_ENTREGA?: string | null;
    USUARIO_ENTREGA?: string | null;

    // Solo REVISADO / SUBTIPO VENTA_DIRECTA — vienen de PTPLISTCDO
    FECHA_ENTREGA_CDO?: string | null;
    USELAB?: string | number | null;
}

export interface InventarioFiltros {
    cve_art?: string;
    cve_alm?: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}