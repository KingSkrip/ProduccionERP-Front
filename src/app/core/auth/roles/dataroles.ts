// app/core/auth/roles/dataroles.ts

// Roles principales
export const Roles = {
  1: 'COLABORADOR',
  2: 'RH',
  3: 'SUADMIN',
  4: 'ADMIN',
  5: 'JEFE',
  6: 'CLIENTE',
  7: 'AGENTE',
};

export enum RoleEnum {
  COLABORADOR = 1,
  RH = 2,
  SUADMIN = 3,
  ADMIN = 4,
  JEFE = 5,
  CLIENTE = 6,
  AGENTE = 7,
}

// Subroles
export const SubRoles = {
  1: 'OPERARIO',
  2: 'SUPERVISOR',
  3: 'GERENTE',
  4: 'CONTADOR',
  5: 'AUXILIAR ADMINISTRATIVO',
  6: 'JEFE',
  7: 'JACOBO',
};

export enum SubRoleEnum {
  OPERARIO = 1,
  SUPERVISOR = 2,
  GERENTE = 3,
  CONTADOR = 4,
  AUXILIAR_ADMINISTRATIVO = 5,
  JEFE = 6,
  JACOBO = 7,
}

// Navegación por rol principal
export const NavigationByRole = {
  [RoleEnum.COLABORADOR]: ['Inicio', 'Perfil', 'Viajes', 'Historial'],
  [RoleEnum.RH]: ['Inicio', 'Usuarios', 'Pagos', 'Rutas', 'Reportes'],
  [RoleEnum.SUADMIN]: ['Inicio', 'Usuarios', 'Pagos', 'Rutas', 'Reportes', 'Configuración'],
  [RoleEnum.ADMIN]: ['Inicio', 'Usuarios', 'Pagos', 'Rutas', 'Reportes', 'Configuración'],
};

// (Opcional) Navegación por subrol si deseas controlar accesos más finos
export const NavigationBySubRole = {
  [SubRoleEnum.OPERARIO]: ['Inicio', 'Tareas'],
  [SubRoleEnum.SUPERVISOR]: ['Inicio', 'Usuarios', 'Reportes'],
  [SubRoleEnum.GERENTE]: ['Inicio', 'Usuarios', 'Pagos', 'Reportes'],
  [SubRoleEnum.CONTADOR]: ['Inicio', 'Pagos', 'Reportes'],
  [SubRoleEnum.AUXILIAR_ADMINISTRATIVO]: ['Inicio', 'Pagos'],
  [SubRoleEnum.JEFE]: ['Inicio', 'Usuarios', 'Rutas', 'Reportes', 'Configuración'],
};
