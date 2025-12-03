import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { RHComponent } from './RH.component';
import { RHService } from './RH.service';

export default [
    {
        path: '',
        component: RHComponent,
        resolve: {
            data: () => inject(RHService).getData(),
        },
    },
] as Routes;
