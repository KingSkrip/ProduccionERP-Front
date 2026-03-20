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
  8: 'ADMIN',
  9: 'JAIME',
  10: 'SABU',
  11: 'VENTAS',
  12: 'DIRECCION',
  13: 'CONTRALORIA',
  14: 'COORDINADOR',
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
}

// dataroles.ts — agrega un set de subroles con acceso
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
]);

export const RolesWithChildMenuAccess = new Set([RoleEnum.SUADMIN, RoleEnum.COLABORADOR]);
