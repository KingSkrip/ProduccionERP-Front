// app/core/auth/roles/dataroles-dashboard.ts
import { RoleEnum } from './dataroles';

export const DashboardByRole = {
    [RoleEnum.SUADMIN]: '/dashboards/project',
    [RoleEnum.RH]: '/dashboards/project',
    [RoleEnum.COLABORADOR]: '/dashboards/project'
};
