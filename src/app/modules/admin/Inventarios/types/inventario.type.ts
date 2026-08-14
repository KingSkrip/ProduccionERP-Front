export interface InventarioItem {
    ID: string;
    'CVE ART': string;
    ARTICULO: string;
    CLIENTE: string;
    AGENTE: string;
    PEDIDO: string;
    OP: string;
    'ESTATUS OP': string;
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
}


export interface InventarioFiltros {
    cve_art?: string;
    cve_alm?: string;
}

interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}