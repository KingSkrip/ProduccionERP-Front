import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { SuadminComponent } from './suadmin.component';
import { SuadminListComponent } from './list/SuadminList.component';



export default [
    // ---------- SUADMIN ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: SuadminComponent,
        children: [
            {
                path: '',
                component: SuadminListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
