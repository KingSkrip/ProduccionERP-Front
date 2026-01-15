export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    status?: string;
    photo: string;
    usuario?: string;
    perfil?: number;
    permissions?: number[];
    sub_permissions?: number[];
}
