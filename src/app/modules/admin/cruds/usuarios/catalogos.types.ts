export interface Departamento {
    id: number;
    nombre: string;
    cuenta_coi: string | null;
    clasificacion: string | null;
    costo: number | null;
}

export interface Rol {
    id: number;
    nombre: string;
    guard_name: string;
}

export interface Subrole {
    id: number;
    nombre: string;
    guard_name: string;
}

export interface Status {
    id: number;
    nombre: string;
    descripcion: string;
}
