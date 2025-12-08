import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { SuadminComponent } from 'app/modules/admin/cruds/usuarios/suadmin/suadmin.component';


export default [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'inventory',
    },
    {
        path: 'inventory',
        component: SuadminComponent,
       
    },
] as Routes;
