import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { AutorizarPedidosListComponent } from './list/autpedidosList.component';
import { AutorizarPedidosComponent } from './autpedidos.component';




export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: AutorizarPedidosComponent,
        children: [
            {
                path: '',
                component: AutorizarPedidosListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
