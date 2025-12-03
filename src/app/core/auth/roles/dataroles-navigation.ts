// app/core/auth/roles/dataroles-navigation.ts

import { RoleEnum } from "./dataroles";

export const NavigationByRole = {
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
    ]
};
