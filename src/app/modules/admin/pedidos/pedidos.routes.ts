import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { PedidosListComponent } from './list/pedidosList.component';
import { PedidosComponent } from './pedidos.component';


export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: PedidosComponent,
        children: [
            {
                path: '',
                component: PedidosListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
