// app/core/auth/roles/dataroles-navigation.ts

import { RoleEnum } from "./dataroles";

// Definimos la navegación por rol
export const NavigationByRole: Record<RoleEnum, string[]> = {
    [RoleEnum.COLABORADOR]: [
        'Inicio',
        'Perfil',
        'Viajes',
        'Historial'
    ],
    [RoleEnum.RH]: [
        'Inicio',
        'Usuarios',
        'Pagos',
        'Rutas',
        'Reportes'
    ],
    [RoleEnum.SUADMIN]: [
        'Inicio',
        'Usuarios',
        'Pagos',
        'Rutas',
        'Reportes',
        'Configuración'
    ],
    [RoleEnum.ADMIN]: [
        'Inicio',
        'Usuarios',
        'Pagos',
        'Rutas',
        'Reportes',
        'Configuración'
    ]
};
