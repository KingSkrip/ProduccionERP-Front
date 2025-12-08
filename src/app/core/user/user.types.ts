export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    status?: string;

    usuario?: string;
    perfil?: number;
    permissions?: number[];
}
