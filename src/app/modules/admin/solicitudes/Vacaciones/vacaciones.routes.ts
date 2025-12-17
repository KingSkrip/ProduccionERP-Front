import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { VacacionesListComponent } from './list/vacacionesList.component';
import { VacacionesComponent } from './vacaciones.component';




export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: VacacionesComponent,
        children: [
            {
                path: '',
                component: VacacionesListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
