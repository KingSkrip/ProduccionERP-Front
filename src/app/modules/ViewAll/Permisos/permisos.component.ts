import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from 'app/core/auth/auth.service';
import { PermisosModalComponent } from 'app/modules/modals/Permisos/PermisosModal.component';
import { CatalogoPermiso, ChecadorPermiso, PermisosService } from './permisos.service';

// TODO: reemplazar por el id real de la identidad autenticada
const CURRENT_IDENTITY_ID = Number(localStorage.getItem('identity_id')) || 0;

// Rol RH según tu catálogo: permission 1, sub_permission 3
const ROL_RH_PERMISSION = 1;
const ROL_RH_SUBPERMISSION = 3;

@Component({
  selector: 'permisos',
  templateUrl: './permisos.component.html',
  styleUrls: ['./permisos.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
})
export class PermisosComponent implements OnInit {
  form: FormGroup;

  catalogo: CatalogoPermiso[] = [];
  historial: ChecadorPermiso[] = [];
  pendientesRh: ChecadorPermiso[] = [];
  comentariosPorPermiso: Record<number, string> = {};

  cargandoCatalogo = false;
  cargandoHistorial = false;
  cargandoPendientes = false;
  enviando = false;
  resolviendoId: number | null = null;

  esRh = false;
  esGerente = false;
  esJefeArea = false;
  checandoRol = true;

  pendientesJefe: ChecadorPermiso[] = [];
  cargandoJefe = false;
  resolviendoJefeId: number | null = null;
  comentariosJefePorPermiso: Record<number, string> = {};

  private identityId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private permisosService: PermisosService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {
    this.form = this.fb.group({
      checador_catalogo_permiso_id: [null, Validators.required],
      tipo: ['normal'],
      fecha_inicio: [this.hoyISO(), Validators.required],
      fecha_fin: [this.hoyISO(), Validators.required],
      hora_inicio: [''],
      hora_fin: [''],
      motivo: ['', [Validators.required, Validators.maxLength(255)]],
    });
  }

  ngOnInit(): void {
    this.authService.getUserFlags().subscribe(({ esRh, esGerente, esJefeArea, identityId }) => {
      this.esRh = esRh;
      this.esGerente = esGerente;
      this.esJefeArea = esJefeArea;
      this.identityId = identityId;
      this.checandoRol = false;

      if (this.esRh) {
        this.cargarPendientesRh();
      } else {
        this.cargarCatalogo();
        this.cargarHistorial();
        // gerentes y jefes de área pueden tener gente reportándoles;
        // el backend regresa [] si no le reporta nadie, así que es
        // seguro llamarlo siempre que no seas RH.
        this.cargarPendientesJefe();
      }
      this.cdr.markForCheck();
    });
  }

  // ---------------------------------------------------------------
  // Vista solicitante (empleado normal)
  // ---------------------------------------------------------------

  cargarCatalogo(): void {
    this.cargandoCatalogo = true;
    this.permisosService
      .getCatalogo()
      .pipe(finalize(() => (this.cargandoCatalogo = false)))
      .subscribe({
        next: (catalogo) => (this.catalogo = catalogo),
        error: () =>
          (this.mensaje = {
            tipo: 'error',
            texto: 'No se pudo cargar el catálogo de permisos.',
          }),
      });
  }

  cargarHistorial(): void {
    if (!this.identityId) {
      return;
    }
    this.cargandoHistorial = true;
    this.permisosService
      .historial(this.identityId)
      .pipe(finalize(() => (this.cargandoHistorial = false)))
      .subscribe({
        next: (historial) => (this.historial = historial),
        error: () =>
          (this.mensaje = {
            tipo: 'error',
            texto: 'No se pudo cargar tu historial de permisos.',
          }),
      });
  }

  enviarSolicitud(): void {
    this.mensaje = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    this.enviando = true;

    this.permisosService
      .solicitar({
        checador_catalogo_permiso_id: v.checador_catalogo_permiso_id,
        tipo: v.tipo || undefined,
        fecha_inicio: v.fecha_inicio,
        fecha_fin: v.fecha_fin,
        hora_inicio: v.hora_inicio || undefined,
        hora_fin: v.hora_fin || undefined,
        motivo: v.motivo,
      })
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: (res) => {
          this.mensaje = { tipo: 'ok', texto: res.message ?? 'Permiso solicitado.' };
          this.form.reset({
            checador_catalogo_permiso_id: null,
            tipo: 'normal',
            fecha_inicio: this.hoyISO(),
            fecha_fin: this.hoyISO(),
            hora_inicio: '',
            hora_fin: '',
            motivo: '',
          });
          this.mostrarFormulario = false;
        },
        error: (err) => {
          this.mensaje = {
            tipo: 'error',
            texto: err?.error?.message ?? 'Ocurrió un error al solicitar el permiso.',
          };
        },
      });
  }

  resumenEstado(p: ChecadorPermiso): string {
    if (p.estado === 'aprobado') {
      return p.hora_fin ? `Aprobado · regreso máximo ${p.hora_fin}` : 'Aprobado';
    }
    if (p.estado === 'rechazado') {
      return p.estado_rh === 'rechazado' ? 'Rechazado por RH' : 'Rechazado por tu jefe';
    }
    if (p.estado_rh !== 'aprobado') {
      return 'Falta aprobación de RH';
    }
    return 'Falta aprobación de tu jefe';
  }

  claseBadge(estado: string): string {
    switch (estado) {
      case 'aprobado':
        return 'bg-green-100 text-black dark:bg-green-500/20 dark:text-green-400';
      case 'rechazado':
        return 'bg-red-100 text-black dark:bg-red-500/20 dark:text-red-400';
      default:
        return 'bg-amber-100 text-black dark:bg-amber-500/20 dark:text-amber-400';
    }
  }

  // ---------------------------------------------------------------
  // Vista RH (bandeja de aprobación)
  // ---------------------------------------------------------------

  cargarPendientesRh(): void {
    this.cargandoPendientes = true;
    this.cdr.markForCheck();
    this.permisosService
      .pendientesRh()
      .pipe(
        finalize(() => {
          this.cargandoPendientes = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (pendientes) => {
          this.pendientesRh = pendientes;
          this.cdr.markForCheck();
        },
        error: () => {
          this.mensaje = {
            tipo: 'error',
            texto: 'No se pudo cargar la bandeja de permisos pendientes.',
          };
          this.cdr.markForCheck();
        },
      });
  }

  onComentarioChange(permisoId: number, event: Event): void {
    this.comentariosPorPermiso[permisoId] = (event.target as HTMLTextAreaElement).value;
  }

  aprobar(p: ChecadorPermiso): void {
    this.resolverPermiso(p, 'aprobado');
  }

  rechazar(p: ChecadorPermiso): void {
    this.resolverPermiso(p, 'rechazado');
  }

  private resolverPermiso(p: ChecadorPermiso, estado: 'aprobado' | 'rechazado'): void {
    this.mensaje = null;
    this.resolviendoId = p.id;

    this.permisosService
      .resolver(p.id, 'rh', {
        estado,
        comentarios_aprobador: this.comentariosPorPermiso[p.id] || undefined,
      })
      .pipe(finalize(() => (this.resolviendoId = null)))
      .subscribe({
        next: () => {
          this.pendientesRh = this.pendientesRh.filter((x) => x.id !== p.id);
          this.mensaje = {
            tipo: 'ok',
            texto: estado === 'aprobado' ? 'Permiso aprobado.' : 'Permiso rechazado.',
          };
        },
        error: (err) => {
          this.mensaje = {
            tipo: 'error',
            texto: err?.error?.message ?? 'No se pudo resolver el permiso.',
          };
        },
      });
  }

  private hoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // ---------------------------------------------------------------
  // Bandeja de jefe directo (independiente de RH)
  // ---------------------------------------------------------------

  cargarPendientesJefe(): void {
    if (!this.identityId) return;

    this.cargandoJefe = true;
    this.cdr.markForCheck();

    this.permisosService
      .pendientesJefe(this.identityId)
      .pipe(
        finalize(() => {
          this.cargandoJefe = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (pendientes) => {
          this.pendientesJefe = pendientes;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pendientesJefe = [];
          this.cdr.markForCheck();
        },
      });
  }

  onComentarioJefeChange(permisoId: number, event: Event): void {
    this.comentariosJefePorPermiso[permisoId] = (event.target as HTMLTextAreaElement).value;
  }

  aprobarComoJefe(p: ChecadorPermiso): void {
    this.resolverComoJefe(p, 'aprobado');
  }

  rechazarComoJefe(p: ChecadorPermiso): void {
    this.resolverComoJefe(p, 'rechazado');
  }

  private resolverComoJefe(p: ChecadorPermiso, estado: 'aprobado' | 'rechazado'): void {
    this.mensaje = null;
    this.resolviendoJefeId = p.id;

    this.permisosService
      .resolver(p.id, 'jefe', {
        estado,
        comentarios_aprobador: this.comentariosJefePorPermiso[p.id] || undefined,
      })
      .pipe(finalize(() => (this.resolviendoJefeId = null)))
      .subscribe({
        next: () => {
          this.pendientesJefe = this.pendientesJefe.filter((x) => x.id !== p.id);
          this.mensaje = {
            tipo: 'ok',
            texto: estado === 'aprobado' ? 'Permiso aprobado.' : 'Permiso rechazado.',
          };
        },
        error: (err) => {
          this.mensaje = {
            tipo: 'error',
            texto: err?.error?.message ?? 'No se pudo resolver el permiso.',
          };
        },
      });
  }

  //   modal crear permiso

  mensaje: { tipo: 'ok' | 'error'; texto: string } | null = null;

  mostrarFormulario = false;
  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    this.cdr.markForCheck();
  }

  abrirModalPermiso(): void {
    const ref = this.dialog.open(PermisosModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      panelClass: 'permisos-modal-panel',
      autoFocus: false,
    });

    ref.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.mensaje = { tipo: 'ok', texto: result.mensaje ?? 'Permiso solicitado.' };
        this.cargarHistorial();
        this.cdr.markForCheck();
      }
    });
  }

  rangoFechas(p: ChecadorPermiso): string {
    const inicio = this.formatFecha(p.fecha_inicio);
    const fin = this.formatFecha(p.fecha_fin);
    return inicio === fin ? inicio : `${inicio} — ${fin}`;
  }

  private formatFecha(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
}
