import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { ColaboradorComponent } from './colaborador.component';
import { ColaboradorListComponent } from './list/colaboradorList.component';





export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: ColaboradorComponent,
        children: [
            {
                path: '',
                component: ColaboradorListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
