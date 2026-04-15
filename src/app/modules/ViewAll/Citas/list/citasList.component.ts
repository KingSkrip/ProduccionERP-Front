import { animate, style, transition, trigger } from '@angular/animations';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, MatOptionModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fuseAnimations } from '@fuse/animations';
import { AuthService } from 'app/core/auth/auth.service';
import { NuevaCitaModalComponent } from 'app/modules/modals/Citas/Nueva-cita/nueva-cita-modal.component';
import { DayCitasModalComponent } from 'app/modules/modals/Citas/Ver-citas/day-citas-modal.component';
import { DetallesAccesoModalComponent } from 'app/modules/modals/Citas/Ver-citas/detalles/detalles.component';
import { Subject, takeUntil } from 'rxjs';
import { CitaAPI, CitasService } from '../citas.service';
import { Cita } from '../Types/citas.types';

export const slideDown = trigger('slideDown', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(8px) scale(0.98)' }),
    animate('150ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
  ]),
  transition(':leave', [
    animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(8px) scale(0.98)' })),
  ]),
]);

@Component({
  selector: 'citas-list',
  templateUrl: './citasList.component.html',
  styleUrls: ['./citasList.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-MX' }],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [...fuseAnimations, slideDown],
})
export class CitasListComponent implements OnInit, OnDestroy {
  private _unsubscribeAll = new Subject<void>();

  // ─── Estado del calendario ──────────────────────────────────────
  hoy = new Date();
  diaHoy = this.hoy.getDate();
  mesHoy = this.hoy.getMonth();
  anioHoy = this.hoy.getFullYear();
  mesVistaActual = this.hoy.getMonth();
  anioVistaActual = this.hoy.getFullYear();
  diaSeleccionado: number | null = this.diaHoy;
  semanaOffset = 0; // semanas hacia adelante/atrás desde hoy
  diasSemana = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
  horasDelDia = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  vistaActual: 'semana' | 'dia' | 'lista' = 'semana';
  tiposVista = [
    { value: 'semana', label: 'Semana', icon: 'view_week' },
    { value: 'dia', label: 'Día', icon: 'view_day' },
    { value: 'lista', label: 'Lista', icon: 'view_list' },
  ] as const;

  filtroEstado = 'todos';
  citas: Cita[] = [];
  menuAbiertoCita: Cita | null = null;
  isProveedor = false;
  constructor(
    private _citasService: CitasService,
    private _snackBar: MatSnackBar,
    private _cdr: ChangeDetectorRef,
    private _breakpointObserver: BreakpointObserver,
    private _dialog: MatDialog,
    private _authService: AuthService,
  ) {}

  // ─── ngOnInit — mapeo corregido ───────────────────────────────────
  ngOnInit(): void {
    this._citasService
      .getCitas()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((citas: CitaAPI[]) => {
        this.citas = citas.map((c) => ({
          id: c.id,
          id_visitante: c.id_visitante,
          paciente: c.es_externa
            ? (c.nombre_proveedor ?? c.usuario?.nombre ?? 'Proveedor')
            : (c.nombre_visitante ?? c.visitante?.nombre ?? 'Sin nombre'),
          motivo: c.motivo ?? '',
          fecha: c.fecha,
          horaInicio: c.hora_inicio,
          horaFin: c.hora_fin,
          estado: c.estado,
          notas: c.notas,
          con_vehiculo: (c as any).con_vehiculo ?? false,
          dia: String(new Date(c.fecha).getDate()),
          mes: this._mesCorto(new Date(c.fecha).getMonth()),
          esExterna: c.es_externa ?? false,
        }));

        this._cdr.markForCheck();
      });
  }

  // ─── Agrupar citas por fecha + hora_inicio ───────────────────────

  get citasAgrupadas(): Cita[] {
    const mapa = new Map<string, Cita>();

    for (const cita of this.citas) {
      const key = `${cita.fecha}_${cita.horaInicio}_${cita.horaFin}`;
      if (mapa.has(key)) {
        const existente = mapa.get(key)!;
        existente.paciente = `${existente.paciente}, ${cita.paciente}`;
        existente.ids = [...(existente.ids ?? [existente.id!]), ...(cita.id ? [cita.id] : [])];
        existente.visitantes = [
          ...(existente.visitantes ?? []),
          { id: cita.id_visitante!, nombre: cita.paciente },
        ];
      } else {
        mapa.set(key, {
          ...cita,
          ids: [cita.id!],
          visitantes: [{ id: cita.id_visitante!, nombre: cita.paciente }],
        });
      }
    }

    return Array.from(mapa.values());
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next();
    this._unsubscribeAll.complete();
  }

  // ─── Mini calendario ────────────────────────────────────────────

  get mesActualLabel(): string {
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    return `${meses[this.mesVistaActual]} ${this.anioVistaActual}`;
  }

  get diasDelMes(): (number | null)[] {
    const primerDia = new Date(this.anioVistaActual, this.mesVistaActual, 1).getDay();
    const totalDias = new Date(this.anioVistaActual, this.mesVistaActual + 1, 0).getDate();
    const blancos: null[] = Array(primerDia).fill(null);
    const dias = Array.from({ length: totalDias }, (_, i) => i + 1);
    return [...blancos, ...dias];
  }

  mesAnterior(): void {
    if (this.mesVistaActual === 0) {
      this.mesVistaActual = 11;
      this.anioVistaActual--;
    } else {
      this.mesVistaActual--;
    }
    const primerDelMes = new Date(this.anioVistaActual, this.mesVistaActual, 1);
    const hoy = new Date();
    const diffMs = primerDelMes.getTime() - hoy.getTime();
    const diffSemanas = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    this.semanaOffset = diffSemanas;
    this._cdr.markForCheck();
  }

  mesSiguiente(): void {
    if (this.mesVistaActual === 11) {
      this.mesVistaActual = 0;
      this.anioVistaActual++;
    } else {
      this.mesVistaActual++;
    }
    const primerDelMes = new Date(this.anioVistaActual, this.mesVistaActual, 1);
    const hoy = new Date();
    const diffMs = primerDelMes.getTime() - hoy.getTime();
    const diffSemanas = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    this.semanaOffset = diffSemanas;
    this._cdr.markForCheck();
  }

  seleccionarDia(dia: number | null): void {
    if (!dia) return;
    this.diaSeleccionado = dia;
    const fechaSeleccionada = new Date(this.anioVistaActual, this.mesVistaActual, dia);
    const hoy = new Date();
    const diaSemanaHoy = hoy.getDay();
    const lunesDeHoy = new Date(hoy);
    lunesDeHoy.setDate(hoy.getDate() - diaSemanaHoy + 1);
    const diaSemanasel = fechaSeleccionada.getDay();
    const lunesDeSel = new Date(fechaSeleccionada);
    lunesDeSel.setDate(fechaSeleccionada.getDate() - diaSemanasel + 1);
    const diffMs = lunesDeSel.getTime() - lunesDeHoy.getTime();
    this.semanaOffset = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    this._cdr.markForCheck();
  }

  tieneCitas(dia: number): boolean {
    const fecha = this.fechaDelMiniCal(dia);
    return this.citasAgrupadas.some((c) => c.fecha === fecha);
  }

  tieneCitasExternas(dia: number): boolean {
    const fecha = this.fechaDelMiniCal(dia);
    return this.citasAgrupadas.some((c) => c.fecha === fecha && c.esExterna === true);
  }

  irAHoy(): void {
    this.semanaOffset = 0;
    this.diaSeleccionado = this.hoy.getDate();
    this.mesVistaActual = this.hoy.getMonth();
    this.anioVistaActual = this.hoy.getFullYear();
    this._cdr.markForCheck();
  }

  // ─── Semana ─────────────────────────────────────────────────────

  get semanaActual(): { fecha: string; nombre: string; numero: string }[] {
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diaSemana + 1 + this.semanaOffset * 7);

    const nombres = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return {
        fecha: this._fechaStr(d),
        nombre: nombres[i],
        numero: String(d.getDate()),
      };
    });
  }

  get rangoSemanaLabel(): string {
    const sem = this.semanaActual;
    return `${sem[0].numero} – ${sem[6].numero} ${this._mesCorto(new Date(sem[0].fecha).getMonth())} ${new Date(sem[0].fecha).getFullYear()}`;
  }

  semanaAnterior(): void {
    this.semanaOffset--;
    const primerDiaSemana = new Date(this.semanaActual[0].fecha);
    this.mesVistaActual = primerDiaSemana.getMonth();
    this.anioVistaActual = primerDiaSemana.getFullYear();
    this._cdr.markForCheck();
  }

  semanaSiguiente(): void {
    this.semanaOffset++;
    const primerDiaSemana = new Date(this.semanaActual[0].fecha);
    this.mesVistaActual = primerDiaSemana.getMonth();
    this.anioVistaActual = primerDiaSemana.getFullYear();
    this._cdr.markForCheck();
  }

  esHoy(fecha: string): boolean {
    return fecha === this._fechaStr(this.hoy);
  }

  getCitasEnSlot(fecha: string, hora: number): Cita[] {
    return this.citasAgrupadas.filter((c) => {
      if (c.fecha !== fecha) return false;
      const h = parseInt(c.horaInicio.split(':')[0], 10);
      return h === hora;
    });
  }

  // ─── Vista día ──────────────────────────────────────────────────

  get fechaDiaSeleccionado(): string {
    const d = this.diaSeleccionado ?? this.diaHoy;
    return `${this.anioVistaActual}-${String(this.mesVistaActual + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  get diaSeleccionadoObj() {
    return {
      fecha: this.fechaDiaSeleccionado,
      nombre: '',
      numero: String(this.diaSeleccionado),
    };
  }

  // ─── Resumen ─────────────────────────────────────────────────────

  get citasHoy(): Cita[] {
    return this.citasAgrupadas.filter((c) => c.fecha === this.fechaDiaSeleccionado);
  }

  get citasPendientes(): number {
    return this.citasHoy.filter((c) => c.estado === 'pendiente').length;
  }

  get citasConfirmadas(): number {
    return this.citasHoy.filter((c) => c.estado === 'confirmada').length;
  }

  // ─── Acciones de vista ───────────────────────────────────────────

  cambiarVista(v: 'semana' | 'dia' | 'lista'): void {
    this.vistaActual = v;
    this._cdr.markForCheck();
  }

  // ─── CRUD (simulado, listo para conectar al servicio) ────────────

  abrirModalNuevaCita(): void {
    this.abrirModalCita({
      fecha: this._fechaStr(this.hoy),
    });
  }

  crearCitaEnSlot(dia: { fecha: string }, hora: number): void {
    if (this.esFechaPasada(dia.fecha)) return;

    const ocupado = this.getCitasEnSlot(dia.fecha, hora).length > 0;
    if (ocupado) return;

    this.abrirModalCita({
      fecha: dia.fecha,
      horaInicio: `${String(hora).padStart(2, '0')}:00`,
      horaFin: `${String(hora + 1).padStart(2, '0')}:00`,
    });
  }

  editarCita(cita: Cita): void {
    if (this.esFechaPasada(cita.fecha)) return;
    this.abrirModalCita({ cita });
  }

  confirmarCita(cita: Cita): void {
    this._citasService
      .updateEstado(cita.id!, 'confirmada')
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(() => {
        cita.estado = 'confirmada';
        this._snackBar.open('Cita confirmada ✓', 'OK', { duration: 3000 });
        this._cdr.markForCheck();
      });
  }

  cancelarCita(cita: Cita): void {
    this._citasService
      .updateEstado(cita.id!, 'cancelada')
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(() => {
        cita.estado = 'cancelada';
        this._snackBar.open('Cita cancelada', 'OK', { duration: 3000 });
        this._cdr.markForCheck();
      });
  }

  verDetalleCita(cita: Cita): void {
    if (cita.esExterna) {
      this._dialog
        .open(DetallesAccesoModalComponent, {
          width: '480px',
          maxWidth: '100vw',
          panelClass: 'modal-cita-panel',
          data: { cita },
        })
        .afterClosed()
        .subscribe((result) => {
          if (result?.estadoActualizado) {
            const citaEnLista = this.citas.find((c) => c.id === cita.id);
            if (citaEnLista) {
              citaEnLista.estado = result.estadoActualizado;
            }
            cita.estado = result.estadoActualizado;
            this._cdr.markForCheck();
          }
        });
      return;
    }
    this.editarCita(cita);
  }

  // ─── Utilidades ──────────────────────────────────────────────────

  private _fechaStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private _mesCorto(m: number): string {
    return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][m];
  }

  toggleMenuCitaDia(cita: Cita): void {
    this.menuAbiertoCita = this.menuAbiertoCita === cita ? null : cita;
    this._cdr.markForCheck();
  }

  get diasDeSemanaActual(): Set<string> {
    return new Set(this.semanaActual.map((d) => d.fecha));
  }

  fechaDelMiniCal(dia: number): string {
    return `${this.anioVistaActual}-${String(this.mesVistaActual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  get diasDelMesConSemanas(): { fecha: string; dia: number; esOtroMes: boolean }[][] {
    const semanas: { fecha: string; dia: number; esOtroMes: boolean }[][] = [];
    const primerDia = new Date(this.anioVistaActual, this.mesVistaActual, 1);
    const diaSemana = primerDia.getDay();
    const diasHastaLunes = diaSemana === 0 ? 6 : diaSemana - 1;

    const inicio = new Date(primerDia);
    inicio.setDate(primerDia.getDate() - diasHastaLunes);

    for (let s = 0; s < 6; s++) {
      const semana: { fecha: string; dia: number; esOtroMes: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const fecha = new Date(inicio);
        fecha.setDate(inicio.getDate() + s * 7 + d);
        semana.push({
          fecha: this._fechaStr(fecha),
          dia: fecha.getDate(),
          esOtroMes: fecha.getMonth() !== this.mesVistaActual,
        });
      }
      // omitir la última semana si todos son de otro mes
      if (semana.some((d) => !d.esOtroMes)) {
        semanas.push(semana);
      }
    }
    return semanas;
  }

  getCitasDelDia(fecha: string): Cita[] {
    return this.citasAgrupadas.filter((c) => c.fecha === fecha);
  }

  seleccionarDiaYAccion(fecha: string): void {
    const partes = fecha.split('-');
    this.anioVistaActual = +partes[0];
    this.mesVistaActual = +partes[1] - 1;
    this.diaSeleccionado = +partes[2];
    const citasDelDia = this.getCitasDelDia(fecha);
    const esPasado = this.esFechaPasada(fecha);
    if (esPasado && citasDelDia.length === 0) return;
    if (citasDelDia.length > 0) {
      const dialogRef = this._dialog.open(DayCitasModalComponent, {
        width: '92%',
        maxWidth: '480px',
        panelClass: 'day-citas-modal-panel',
        data: { fecha: fecha, citas: citasDelDia },
      });

      dialogRef.afterClosed().subscribe((result: any) => {
        if (result && !esPasado) {
          if (result.action === 'edit' && result.cita && !result.cita.esExterna) {
            this.editarCita(result.cita);
          } else if (result.action === 'add') {
            this.abrirModalCita({
              fecha: result.fecha,
              horaInicio: this._horaActualRedondeada(),
              horaFin: this._horaActualRedondeadaMas1(),
            });
          }
        }
      });
    } else {
      // Día futuro sin citas → abre modal de nueva cita
      this.abrirModalCita({
        fecha,
        horaInicio: this._horaActualRedondeada(),
        horaFin: this._horaActualRedondeadaMas1(),
      });
    }
    this._cdr.markForCheck();
  }

  esFechaPasada(fecha: string): boolean {
    const partes = fecha.split('-');
    const f = new Date(+partes[0], +partes[1] - 1, +partes[2]);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return f < hoy;
  }

  private abrirModalCita(data: any): void {
    const isMobile = this._breakpointObserver.isMatched(Breakpoints.Handset);
    this._dialog
      .open(NuevaCitaModalComponent, {
        width: isMobile ? '100vw' : '520px',
        height: 'auto',
        maxWidth: '100vw',
        panelClass: isMobile ? 'modal-top-sheet' : 'modal-cita-panel',
        position: isMobile ? { bottom: '0' } : undefined,
        data,
      })
      .afterClosed()
      .subscribe((res) => {
        if (res?.success) this.ngOnInit();
      });
  }

  navegarAnterior(): void {
    // Si la vista es 'dia', movemos un día
    if (this.vistaActual === 'dia') {
      this.cambiarDia(-1);
    }
    // Si la vista es 'semana' (tu calendario Samsung de móvil), movemos el mes
    else if (this.vistaActual === 'semana') {
      this.semanaAnterior();
    }
    // Para la vista lista, mantenemos el movimiento por semana
    else {
      this.semanaAnterior();
    }
  }

  navegarSiguiente(): void {
    if (this.vistaActual === 'dia') {
      this.cambiarDia(1);
    } else if (this.vistaActual === 'semana') {
      this.semanaSiguiente();
    } else {
      this.semanaSiguiente();
    }
  }
  cambiarDia(dias: number): void {
    const partes = this.fechaDiaSeleccionado.split('-');
    const fecha = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    fecha.setDate(fecha.getDate() + dias);
    this.diaSeleccionado = fecha.getDate();
    this.mesVistaActual = fecha.getMonth();
    this.anioVistaActual = fecha.getFullYear();
    this._cdr.markForCheck();
  }

  get citasSemana(): Cita[] {
    const fechasSemana = this.semanaActual.map((d) => d.fecha);
    return this.citasAgrupadas
      .filter((c) => {
        const enSemana = fechasSemana.includes(c.fecha);
        const porEstado = this.filtroEstado === 'todos' || c.estado === this.filtroEstado;
        return enSemana && porEstado;
      })
      .sort((a, b) => {
        const fechaA = new Date(`${a.fecha} ${a.horaInicio}`);
        const fechaB = new Date(`${b.fecha} ${b.horaInicio}`);
        return fechaA.getTime() - fechaB.getTime();
      });
  }

  private _horaActualRedondeada(): string {
    const ahora = new Date();
    const h = String(ahora.getHours()).padStart(2, '0');
    return `${h}:00`;
  }

  private _horaActualRedondeadaMas1(): string {
    const ahora = new Date();
    const h = String(Math.min(ahora.getHours() + 1, 23)).padStart(2, '0');
    return `${h}:00`;
  }
}
