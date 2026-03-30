import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { CitasListComponent } from './list/citasList.component';
import { CitasComponent } from './citas.component';




export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: CitasComponent,
        children: [
            {
                path: '',
                component: CitasListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
