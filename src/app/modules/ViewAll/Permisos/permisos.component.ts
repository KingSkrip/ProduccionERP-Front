import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { finalize } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from 'app/core/auth/auth.service';
import { PermisosModalComponent } from 'app/modules/modals/Permisos/PermisosModal.component';
import { CatalogoPermiso, PermisosService } from './permisos.service';
import { EmpleadoComponent } from './Empleado/empleado.component';
import { JefeComponent } from './Jefe/jefe.component';


type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;

@Component({
  selector: 'permisos',
  templateUrl: './permisos.component.html',
  styleUrls: ['./permisos.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, EmpleadoComponent, JefeComponent],
})
export class PermisosComponent implements OnInit {
  checandoRol = true;
  esGerente = false;
  esJefeArea = false;
  identityId: number | null = null;

  catalogo: CatalogoPermiso[] = [];
  cargandoCatalogo = false;

  mensaje: Mensaje = null;
  refrescarEmpleadoTrigger = 0;

  constructor(
    private authService: AuthService,
    private permisosService: PermisosService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.authService.getUserFlags().subscribe(({ esGerente, esJefeArea, identityId }) => {
      this.esGerente = esGerente;
      this.esJefeArea = esJefeArea;
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
        error: () => this.mostrarMensaje({ tipo: 'error', texto: 'No se pudo cargar el catálogo de permisos.' }),
      });
  }

abrirModalPermiso(): void {
  const ref = this.dialog.open(PermisosModalComponent, {
    width: '850px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    panelClass: 'permisos-modal-panel',
    autoFocus: false,
  });

  ref.afterClosed().subscribe((result) => {
    if (result?.success) {
      this.mostrarMensaje({
        tipo: 'ok',
        texto: result.mensaje ?? 'Permiso solicitado.',
      });
      this.refrescarEmpleadoTrigger++;
      this.cdr.markForCheck();
    }
  });
}
  mostrarMensaje(msg: Mensaje): void {
    this.mensaje = msg;
    this.cdr.markForCheck();
  }
}