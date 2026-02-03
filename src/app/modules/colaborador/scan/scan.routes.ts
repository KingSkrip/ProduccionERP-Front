import { inject } from '@angular/core';
import { Routes } from '@angular/router';


import { ScanComponent } from './scan.component';
import { ScanListComponent } from './list/scanList.component';





export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: ScanComponent,
        children: [
            {
                path: '',
                component: ScanListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
