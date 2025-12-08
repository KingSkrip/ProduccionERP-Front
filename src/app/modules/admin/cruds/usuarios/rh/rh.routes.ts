import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { RHComponent } from './rh.component';
import { RHListComponent } from './list/rhList.component';




export default [
    // ---------- SUADMIN ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: RHComponent,
        children: [
            {
                path: '',
                component: RHListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
