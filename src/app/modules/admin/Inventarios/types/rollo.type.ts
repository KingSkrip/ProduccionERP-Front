export interface RolloItem {
    id: string;
    cve_art: string;
    articulo: string;
    cliente: string;
    agente: string;
    pedido: string;
    op: string;
    estatus_op: string;
    cod_color: string;
    color: string;
    fecha: string;
    tipo: string;
    peso_neto: number;
    pieza: string;
    estatus: number;
    isdeliv: number;
    fecha_ing: string | null;
    fecha_sal: string | null;
    fecha_dev: string | null;
    pl: string | null;
}