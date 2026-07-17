import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Injector,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { finalize } from 'rxjs';

import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from 'app/core/auth/auth.service';
import { CatalogoPermiso } from 'app/modules/Checador/types/Catalogopermiso.types';
import { PermisosModalComponent } from 'app/modules/modals/Permisos/PermisosModal.component';
import { EmpleadoComponent } from './Empleado/empleado.component';
import { JefeComponent } from './Jefe/jefe.component';
import { PermisosService } from './permisos.service';
import { RhComponent } from './RH/rh.component';

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;

@Component({
  selector: 'permisos',
  templateUrl: './permisos.component.html',
  styleUrls: ['./permisos.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, EmpleadoComponent, JefeComponent, RhComponent],
})
export class PermisosComponent implements OnInit {
  checandoRol = true;
  esGerente = false;
  esJefeArea = false;
  esRH = false;
  identityId: number | null = null;

  catalogo: CatalogoPermiso[] = [];
  cargandoCatalogo = false;

  mensaje: Mensaje = null;
  refrescarEmpleadoTrigger = 0;

  private overlayRef: OverlayRef | null = null;

  constructor(
    private authService: AuthService,
    private permisosService: PermisosService,
    private overlay: Overlay,
    private injector: Injector,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.authService.getUserFlags().subscribe(({ esGerente, esJefeArea, esRh, identityId }) => {
      this.esGerente = esGerente;
      this.esJefeArea = esJefeArea;
      this.esRH = esRh;
      this.identityId = identityId;
      this.checandoRol = false;
      this.cargarCatalogo();
      this.cdr.markForCheck();
    });
  }

  cargarCatalogo(): void {
    this.cargandoCatalogo = true;
    this.permisosService
      .getCatalogo()
      .pipe(
        finalize(() => {
          this.cargandoCatalogo = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (catalogo) => {
          this.catalogo = catalogo;
          this.cdr.markForCheck();
        },
        error: () =>
          this.mostrarMensaje({
            tipo: 'error',
            texto: 'No se pudo cargar el catálogo de permisos.',
          }),
      });
  }

  abrirModalPermiso(): void {
    // Overlay "pelón": sin backdrop, sin panel, sin estilos de Material.
    // Tu propio componente ya trae su bg-black/60 + tarjeta + animación.
    this.overlayRef = this.overlay.create({
      hasBackdrop: false,
      positionStrategy: this.overlay.position().global(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });

    const portal = new ComponentPortal(PermisosModalComponent, null, this.injector);
    const compRef = this.overlayRef.attach(portal);

    compRef.instance.cerrar = (result?: any) => {
      this.overlayRef?.dispose();
      this.overlayRef = null;

      if (result?.success) {
        this.mostrarMensaje({
          tipo: 'ok',
          texto: result.mensaje ?? 'Permiso solicitado.',
        });
        this.refrescarEmpleadoTrigger++;
        this.cdr.markForCheck();
      }
    };
  }

  mostrarMensaje(msg: Mensaje): void {
    this.mensaje = msg;
    this.cdr.markForCheck();
  }
}
