// usuarios.types.ts

export interface Usuarios {
    id: number;
    nombre: string;           // de Users Laravel   
    correo: string;           // de Users Laravel
    usuario: string;          // de Users Laravel
    telefono?: string;        // de Users Laravel
    curp?: string;            // de Users Laravel
    photo?: string;           // de Users Laravel
    status_id?: number;       // de Users Laravel
    departamento_id?: number; // de Users Laravel
    direccion_id?: number;    // de Users Laravel
    
    // Campos legacy (si los usas)
    name?: string;            // Alias para nombre
    email?: string;           // Alias para correo
    
    // Relaciones
    status?: Status;
    departamento?: Departamento;
    direccion?: Direccion;
    roles?: ModelHasRole[];
    nomina?: UserNomina;      // HasMany pero usamos el primero
    empleos?: UserEmpleo[];
    fiscal?: UserFiscal;       // HasMany pero usamos el primero
    seguridad_social?: UserSeguridadSocial; // HasMany pero usamos el primero
    
    // Timestamps
    created_at?: string;
    updated_at?: string;
}

export interface Status {
    id: number;
    nombre: string;
    descripcion?: string;
}

export interface Departamento {
    id: number;
    nombre: string;
    cuenta_coi?: string;
    clasificacion?: string;
    costo?: number;
}

export interface Direccion {
    id: number;
    calle: string;
    no_ext?: string;
    no_int?: string;
    colonia: string;
    cp: string;
    municipio: string;
    estado: string;
    entidad_federativa?: string;
    pais?: string;
}

export interface ModelHasRole {
    id: number;
    role_clave: number;
    subrol_id?: number;
    model_clave: number;
    model_type: string;
}

export interface UserEmpleo {
    id: number;
    user_id: number;
    puesto: string;
    fecha_inicio: string;
    fecha_fin?: string;
    comentarios?: string;
}

export interface UserFiscal {
    id: number;
    user_id: number;
    rfc: string;
    curp: string;
    regimen_fiscal: string;
}

export interface UserSeguridadSocial {
    id: number;
    user_id: number;
    numero_imss: string;
    fecha_alta: string;
    tipo_seguro: string;
}

export interface UserNomina {
    id: number;
    user_id: number;
    numero_tarjeta: string;
    banco: string;
    clabe_interbancaria: string;
    salario_base: number;
    frecuencia_pago: string;
    salarios?: Salario[];
}

export interface Salario {
    id: number;
    user_nomina_id: number;
    monto: number;
    fecha_pago: string;
    concepto?: string;
}