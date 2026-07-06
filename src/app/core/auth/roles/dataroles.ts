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
  8: 'PROVEDORES',
  9: 'REGISTRO_ACCESOS',
};

export enum RoleEnum {
  COLABORADOR = 1,
  RH = 2,
  SUADMIN = 3,
  ADMIN = 4,
  JEFE = 5,
  CLIENTE = 6,
  AGENTE = 7,
  PROVEDORES = 8,
  REGISTRO_ACCESOS = 9,
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
  8: 'ADMIN',
  9: 'JAIME',
  10: 'SABU',
  11: 'VENTAS',
  12: 'DIRECCION',
  13: 'CONTRALORIA',
  14: 'COORDINADOR',
  15: 'COMPRAS',
  16: 'ALMACEN',
};

export enum SubRoleEnum {
  OPERARIO = 1,
  SUPERVISOR = 2,
  GERENTE = 3,
  CONTADOR = 4,
  AUXILIAR_ADMINISTRATIVO = 5,
  JEFE = 6,
  JACOBO = 7,
  ADMIN = 8,
  JAIME = 9,
  SABU = 10,
  VENTAS = 11,
  DIRECCION = 12,
  CONTRALORIA = 13,
  COORDINADOR = 14,
  COMPRAS = 15,
  ALMACEN = 16,
}

//acceso para submenu de produccion
export const SubRolesWithChildMenuAccess = new Set([
  SubRoleEnum.JEFE,
  SubRoleEnum.VENTAS,
  SubRoleEnum.JACOBO,
  SubRoleEnum.JAIME,
  SubRoleEnum.SABU,
  SubRoleEnum.ADMIN,
  SubRoleEnum.DIRECCION,
  SubRoleEnum.GERENTE,
  SubRoleEnum.CONTRALORIA,
  SubRoleEnum.COORDINADOR,
  SubRoleEnum.COMPRAS,
  SubRoleEnum.ALMACEN,
]);

export const RolesWithChildMenuAccess = new Set([RoleEnum.SUADMIN, RoleEnum.COLABORADOR]);
