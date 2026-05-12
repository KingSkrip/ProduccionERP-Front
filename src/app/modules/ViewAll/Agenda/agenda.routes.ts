import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AgendaListComponent } from './list/agendaList.component';
import { AgendaComponent } from './agenda.component';




export default [
    // ---------- COLABORADOR ----------
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: 'list',
        component: AgendaComponent,
        children: [
            {
                path: '',
                component: AgendaListComponent,
                resolve: {
                    // brands: () => inject(SuadminService).getBrands(),
                    // categories: () => inject(SuadminService).getCategories(),
                },
            },
        ],
    },
] as Routes;
