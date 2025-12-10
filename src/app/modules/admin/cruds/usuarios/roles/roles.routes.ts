import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { RolesListComponent } from './list/rolesList.component';
import { RolesComponent } from './roles.component';

export default [
    // ---------- SUADMIN ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: RolesComponent,
        children: [
            {
                path: '',
                component: RolesListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
