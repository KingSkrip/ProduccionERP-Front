import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { SuadminComponent } from './suadmin/suadmin.component';
import { SuadminService } from './suadmin/suadmin.service';
import { SuadminListComponent } from './suadmin/list/SuadminList.component';

export default [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'inventory',
    },
    {
        path: 'inventory',
        component: SuadminComponent,
        children: [
            {
                path: '',
                component: SuadminListComponent,
                resolve: {
                    brands: () => inject(SuadminService).getBrands(),
                    categories: () => inject(SuadminService).getCategories(),
                    products: () => inject(SuadminService).getProducts(),
                    tags: () => inject(SuadminService).getTags(),
                    vendors: () => inject(SuadminService).getVendors(),
                },
            },
        ],
    },
] as Routes;
