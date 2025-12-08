// suadmin.types.ts

export interface Usuarios {
    id: string;         // CLAVE del usuario
    name: string;       // NOMBRE
    email: string;      // CORREO
    usuario?: string;   // USUARIO
    perfil?: number;    // PERFIL
    status?: number;    // STATUS
    photo?: string;     // PHOTO
    scale?: number;     // SCALE
    desktop?: string;   // DESKTOP
    ctrlses?: string;   // CTRLSES
    printrep?: string;  // PRINTREP
    printlbl?: string;  // PRINTLBL
    reimprpt?: string;  // REIMPRPT
    av?: number;        // AV
    ac?: number;        // AC
    ad?: number;        // AD
    ae?: number;        // AE
    cve_agt?: number;   // CVE_AGT
    version?: number;   // VERSION
    fechaact?: string;  // FECHAACT
    versionrh?: number; // VERSIONRH
    fechactrh?: string; // FECHAACTRH
    deporth?: number;   // DEPORTH
    departamentorh?: string; // DEPARTAMENTORH
    cve_alm?: string;   // CVE_ALM
    almacen?: string;   // ALMACEN
    // puedes agregar otros campos que tu API envíe
}
