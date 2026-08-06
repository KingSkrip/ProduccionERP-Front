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
  encrypt?: number;
  identity_id?: number;
  firebird_user_id?: string | number;
  firebird_user_clave?: string | number;
  roleId?: number;
   USER_PUESTO?: UserPuesto | null;
     ES_JEFE_AUXILIAR?: boolean; 
}

export interface UserPuesto {
  FECHA_INICIO: string | null;
  FECHA_FIN: string | null;
  ACTIVO: number;
  PUESTO: {
    NOMBRE: string;
    DESCRIPCION?: string | null;
    ES_GERENTE: boolean;
    ES_JEFE_AREA: boolean;
    ES_RH: boolean;
  } | null;
  AREA: { NOMBRE: string; DESCRIPCION?: string | null } | null;
  JEFE: { NOMBRE: string | null } | null;
}
