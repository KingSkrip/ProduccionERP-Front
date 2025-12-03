import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { ProjectService } from './project.service';
import { ProjectComponent } from './project.component';

export default [
    {
        path: '',
        component: ProjectComponent,
        resolve: {
            data: () => inject(ProjectService).getData(),
        },
    },
] as Routes;
