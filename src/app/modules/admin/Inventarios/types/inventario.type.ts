export interface InventarioItem {
    ID: string;
    ID_QR?: string;
    ORIGEN?: 'PESADO' | 'REVISADO' | 'ACABADO';
    SUBTIPO?: 'PROCESO' | 'SURTIDO' | 'VENTA_DIRECTA';

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

    // Solo REVISADO / SUBTIPO SURTIDO
    ORDEN_SURTE?: string | number;

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