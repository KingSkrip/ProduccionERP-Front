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
}
