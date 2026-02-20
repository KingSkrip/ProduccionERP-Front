import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { EdosCuentaListComponent } from './list/edos_cuentaList.component';
import { EdosCuentaComponent } from './edos_cuenta.component';



export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: EdosCuentaComponent,
        children: [
            {
                path: '',
                component: EdosCuentaListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
