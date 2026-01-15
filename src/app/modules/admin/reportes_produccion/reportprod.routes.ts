import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { ReportProdComponent } from './reportprod.component';
import { ReportProdListComponent } from './list/reportprodList.component';
import { ReportProdLayoutComponent } from 'app/layout/layouts/vertical/ReportProd/reportprod.component';




export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: ReportProdLayoutComponent,
        children: [
            {
                path: '',
                component: ReportProdListComponent,
                // data: {
                //     layout: 'empty'
                // },
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
