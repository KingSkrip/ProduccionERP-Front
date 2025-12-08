import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { ConfirmpasswordComponent } from './confirm-password.component';


export default [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'inventory',
    },
    {
        path: 'inventory',
        component: ConfirmpasswordComponent,
       
    },
] as Routes;
