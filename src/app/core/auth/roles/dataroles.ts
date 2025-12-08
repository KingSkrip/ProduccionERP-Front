// app/core/auth/roles/dataroles.ts

export const Roles = {
    1: 'COLABORADOR',
    2: 'RH',
    3: 'SUADMIN'
};

// También puedes crear un enum si quieres usarlo de forma más tipada
export enum RoleEnum {
    COLABORADOR = 1,
    RH = 2,
    SUADMIN = 3
}


export const NavigationByRole = {
    [RoleEnum.COLABORADOR]: ['Inicio', 'Perfil', 'Viajes', 'Historial'],
    [RoleEnum.RH]: ['Inicio', 'Usuarios', 'Pagos', 'Rutas', 'Reportes'],
    [RoleEnum.SUADMIN]: ['Inicio', 'Usuarios', 'Pagos', 'Rutas', 'Reportes', 'Configuración']
};