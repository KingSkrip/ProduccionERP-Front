export interface InventoryProduct {
    id: string;
    category?: string;
    name: string;
    description?: string;
    tags?: string[];
    sku?: string | null;
    barcode?: string | null;
    brand?: string | null;
    vendor: string | null;
    stock: number;
    reserved: number;
    cost: number;
    basePrice: number;
    taxPercent: number;
    price: number;
    weight: number;
    thumbnail: string;
    images: string[];
    active: boolean;
}

export interface InventoryPagination {
    length: number;
    size: number;
    page: number;
    lastPage: number;
    startIndex: number;
    endIndex: number;
}

export interface InventoryCategory {
    id: string;
    parentId: string;
    name: string;
    slug: string;
}

export interface InventoryBrand {
    id: string;
    name: string;
    slug: string;
}

export interface InventoryTag {
    id?: string;
    title?: string;
}

export interface InventoryVendor {
    id: string;
    name: string;
    slug: string;
}



// suadmin.types.ts

export interface SuAdmin {
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
