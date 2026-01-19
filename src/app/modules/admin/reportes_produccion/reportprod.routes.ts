import { Routes } from '@angular/router';
import { ReportProdListComponent } from './list/reportprodList.component';
import { ReportProdLayoutComponent } from 'app/layout/layouts/vertical/ReportProd/reportprod.component';

// Importa todos los views
import { TejidoViewComponent } from './SubMenuViews/tejido/tejidoview.component';
import { TintoreriaViewComponent } from './SubMenuViews/tintoreria/tintoreriaview.component';
import { EstampadoViewComponent } from './SubMenuViews/estampado/estampadoview.component';
import { InicioViewComponent } from './SubMenuViews/Inicio/inicioview.component';
import { FacturadoViewComponent } from './SubMenuViews/facturado/facturadoview.component';
import { AcabadoRealViewComponent } from './SubMenuViews/acabadoreal/acabadorealview.component';

export default [
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
        children: [
          // Redirección por defecto a Inicio
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'inicio'
          },

          // Rutas de cada vista
          { path: 'inicio', component: InicioViewComponent },
          { path: 'facturado', component: FacturadoViewComponent },
          { path: 'tejido', component: TejidoViewComponent },
          { path: 'tintoreria', component: TintoreriaViewComponent },
          { path: 'estampado', component: EstampadoViewComponent },
          { path: 'acabado-real', component: AcabadoRealViewComponent },
        ],
      },
    ],
  },
] as Routes;