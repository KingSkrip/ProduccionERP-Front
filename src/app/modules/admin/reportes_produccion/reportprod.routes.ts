import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { ReportProdComponent } from './reportprod.component';
import { ReportProdListComponent } from './list/reportprodList.component';




export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: ReportProdComponent,
        children: [
            {
                path: '',
                component:  ReportProdListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
