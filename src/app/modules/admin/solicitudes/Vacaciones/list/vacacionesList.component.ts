import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, UntypedFormBuilder } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule, MatOptionModule, MatRippleModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { fuseAnimations } from '@fuse/animations';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { CatalogosService } from 'app/modules/modals/modals.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VacacionesService } from '../vacaciones.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { AppConfig } from 'app/core/config/app-config.model';


@Component({
    selector: 'vacaciones-list',
    templateUrl: './vacacionesList.component.html',
    standalone: true,
    imports: [
        CommonModule,
        MatProgressBarModule,
        MatIconModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatSortModule,
        MatPaginatorModule,
        MatSlideToggleModule,
        MatSelectModule,
        MatOptionModule,
        MatCheckboxModule,
        MatRippleModule,
        MatNativeDateModule,
        MatFormFieldModule,
        MatInputModule,
        MatTooltipModule,
    ],
    providers: [
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' }
    ],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: fuseAnimations
})
export class VacacionesListComponent implements OnInit, OnDestroy {
    @ViewChild('searchInput') searchInput: any;

    solicitudes: any[] = [];
    solicitudesFiltradas: any[] = [];
    isLoading: boolean = false;
    tabActiva: 'pendientes' | 'aprobadas' | 'rechazadas' = 'pendientes';

    // Contadores
    contadores = {
        pendientes: 0,
        aprobadas: 0,
        rechazadas: 0
    };

    // Controles de filtros
    searchControl: FormControl = new FormControl('');
    filtroFechaControl: FormControl = new FormControl('todos');
    
    // Opciones de filtro por fecha
    opcionesFecha = [
        { value: 'todos', label: 'Todas las fechas' },
        { value: 'hoy', label: 'Hoy' },
        { value: 'semana', label: 'Esta semana' },
        { value: 'mes', label: 'Este mes' },
        { value: 'trimestre', label: 'Este trimestre' }
    ];

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseConfirmationService: FuseConfirmationService,
        private _formBuilder: UntypedFormBuilder,
        private _vacacionesService: VacacionesService,
        private _matDialog: MatDialog,
        private _modals: CatalogosService,
        private _snackBar: MatSnackBar,
    ) { }

    ngOnInit(): void {
        this.cargarSolicitudes();
        this.configurarBuscador();
        this.configurarFiltroFecha();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    /**
     * Cargar solicitudes desde el servicio
     */
    cargarSolicitudes(): void {
        this.isLoading = true;

        this._vacacionesService.getSolicitudesVacaciones()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (solicitudes) => {
                    this.solicitudes = solicitudes;
                    this.aplicarFiltros();
                    this.actualizarContadores();
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                },
                error: (error) => {
                    console.error('Error al cargar solicitudes:', error);
                    this._snackBar.open('Error al cargar solicitudes', 'Cerrar', {
                        duration: 3000,
                        panelClass: 'error-snackbar'
                    });
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    /**
     * Configurar el buscador con debounce
     */
    configurarBuscador(): void {
        this.searchControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(() => {
                this.aplicarFiltros();
                this._changeDetectorRef.markForCheck();
            });
    }

    /**
     * Configurar el filtro de fecha
     */
    configurarFiltroFecha(): void {
        this.filtroFechaControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.aplicarFiltros();
                this._changeDetectorRef.markForCheck();
            });
    }

    /**
     * Aplicar filtros según tab activa, búsqueda y fecha
     */
    aplicarFiltros(): void {
        let solicitudesFiltradas = [...this.solicitudes];

        // Filtrar por tab
        switch (this.tabActiva) {
            case 'pendientes':
                solicitudesFiltradas = solicitudesFiltradas.filter(s => s.workorder?.status_id === 5);
                break;
            case 'aprobadas':
                solicitudesFiltradas = solicitudesFiltradas.filter(s => s.workorder?.status_id === 3);
                break;
            case 'rechazadas':
                solicitudesFiltradas = solicitudesFiltradas.filter(s => s.workorder?.status_id === 4);
                break;
        }

        // Filtrar por búsqueda
        const searchTerm = this.searchControl.value?.toLowerCase().trim();
        if (searchTerm) {
            solicitudesFiltradas = solicitudesFiltradas.filter(s => {
                const nombreCompleto = `${s.usuario?.nombre || ''} ${s.usuario?.apellido_paterno || ''} ${s.usuario?.apellido_materno || ''}`.toLowerCase();
                const id = s.usuario?.id?.toString() || '';
                return nombreCompleto.includes(searchTerm) || id.includes(searchTerm);
            });
        }

        // Filtrar por fecha (solo para aprobadas y rechazadas)
        if (this.tabActiva !== 'pendientes' && this.filtroFechaControl.value !== 'todos') {
            solicitudesFiltradas = this.filtrarPorRangoFecha(solicitudesFiltradas, this.filtroFechaControl.value);
        }

        this.solicitudesFiltradas = solicitudesFiltradas;
    }

    /**
     * Filtrar solicitudes por rango de fecha
     */
    filtrarPorRangoFecha(solicitudes: any[], rango: string): any[] {
        const ahora = new Date();
        const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        
        return solicitudes.filter(s => {
            const fechaSolicitud = this.parsearFecha(s.workorder?.fecha_solicitud);
            if (!fechaSolicitud) return false;

            switch (rango) {
                case 'hoy':
                    return fechaSolicitud >= inicioDia;
                
                case 'semana':
                    const inicioSemana = new Date(inicioDia);
                    inicioSemana.setDate(inicioDia.getDate() - inicioDia.getDay());
                    return fechaSolicitud >= inicioSemana;
                
                case 'mes':
                    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
                    return fechaSolicitud >= inicioMes;
                
                case 'trimestre':
                    const mesActual = ahora.getMonth();
                    const inicioTrimestre = new Date(ahora.getFullYear(), Math.floor(mesActual / 3) * 3, 1);
                    return fechaSolicitud >= inicioTrimestre;
                
                default:
                    return true;
            }
        });
    }

    /**
     * Parsear fecha desde string
     */
    parsearFecha(fecha: any): Date | null {
        if (!fecha) return null;

        if (fecha instanceof Date) {
            return fecha;
        }
        
        if (typeof fecha === 'string') {
            const [fechaParte, horaParte = '00:00:00'] = fecha.split(' ');
            const [dia, mes, anio] = fechaParte.split('/');
            const iso = `${anio}-${mes}-${dia}T${horaParte}`;
            const parsedDate = new Date(iso);
            return isNaN(parsedDate.getTime()) ? null : parsedDate;
        }
        
        if (fecha?.date) {
            const limpia = fecha.date.split('.')[0];
            return this.parsearFecha(limpia);
        }

        return null;
    }

    /**
     * Actualizar contadores de tabs
     */
    actualizarContadores(): void {
        this.contadores = {
            pendientes: this.solicitudes.filter(s => s.workorder?.status_id === 5).length,
            aprobadas: this.solicitudes.filter(s => s.workorder?.status_id === 3).length,
            rechazadas: this.solicitudes.filter(s => s.workorder?.status_id === 4).length
        };
    }

    /**
     * Cambiar tab activa
     */
    cambiarTab(tab: 'pendientes' | 'aprobadas' | 'rechazadas'): void {
        this.tabActiva = tab;
        this.filtroFechaControl.setValue('todos', { emitEvent: false });
        this.aplicarFiltros();
        this._changeDetectorRef.markForCheck();
    }

    /**
     * Aprobar solicitud
     */
    aprobarSolicitud(solicitud: any): void {
        const historialId = solicitud.usuario.vacaciones?.[0]?.historial?.[0].id;

        if (!historialId) {
            this._snackBar.open('No se encontró el historial', 'Cerrar', { duration: 3000 });
            return;
        }

        this._fuseConfirmationService.open({
            title: 'Aprobar solicitud',
            message: `¿Aprobar vacaciones de ${solicitud.usuario?.name}?`,
            icon: { name: 'heroicons_outline:check-circle', color: 'success' },
            actions: {
                confirm: { label: 'Aprobar', color: 'primary' },
                cancel: { label: 'Cancelar' }
            }
        }).afterClosed().subscribe(result => {
            if (result !== 'confirmed') return;

            this.isLoading = true;

            this._vacacionesService.aprobarSolicitud(historialId)
                .pipe(takeUntil(this._unsubscribeAll))
                .subscribe({
                    next: () => {
                        this._snackBar.open('Solicitud aprobada', 'Cerrar', { duration: 3000 });
                        this.cargarSolicitudes();
                    },
                    error: () => {
                        this._snackBar.open('Error al aprobar', 'Cerrar', { duration: 3000 });
                        this.isLoading = false;
                    }
                });
        });
    }

    /**
     * Rechazar solicitud
     */
    rechazarSolicitud(solicitud: any): void {
        const historialId = solicitud.usuario.vacaciones?.[0]?.historial?.[0].id;

        if (!historialId) {
            this._snackBar.open('No se encontró el historial', 'Cerrar', { duration: 3000 });
            return;
        }

        this._fuseConfirmationService.open({
            title: 'Rechazar solicitud',
            message: `¿Rechazar vacaciones de ${solicitud.usuario?.name}?`,
            icon: { name: 'heroicons_outline:x-circle', color: 'warn' },
            actions: {
                confirm: { label: 'Rechazar', color: 'warn' },
                cancel: { label: 'Cancelar' }
            }
        }).afterClosed().subscribe(result => {
            if (result !== 'confirmed') return;

            this.isLoading = true;

            this._vacacionesService.rechazarSolicitud(historialId)
                .pipe(takeUntil(this._unsubscribeAll))
                .subscribe({
                    next: () => {
                        this._snackBar.open('Solicitud rechazada', 'Cerrar', { duration: 3000 });
                        this.cargarSolicitudes();
                    },
                    error: () => {
                        this._snackBar.open('Error al rechazar', 'Cerrar', { duration: 3000 });
                        this.isLoading = false;
                    }
                });
        });
    }

    /**
     * Obtener nombre completo del usuario
     */
    getNombreCompleto(usuario: any): string {
        if (!usuario) return 'Usuario desconocido';
        const nombre = usuario.nombre || '';
        const paterno = usuario.apellido_paterno || '';
        const materno = usuario.apellido_materno || '';
        return `${nombre} ${paterno} ${materno}`.trim();
    }

    /**
     * Obtener puesto del usuario
     */
    getPuesto(usuario: any): string {
        return usuario?.empleos?.[0]?.puesto || 'Sin puesto asignado';
    }

    /**
     * Formatear fecha
     */
    formatearFecha(fecha: string): string {
        if (!fecha) return '';
        const date = new Date(fecha);
        return date.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    /**
     * Calcular tiempo desde la solicitud
     */
    getTiempoDesde(fecha: any): string {
        if (!fecha) return '—';

        let fechaSolicitud: Date;

        if (fecha instanceof Date) {
            fechaSolicitud = fecha;
        }
        else if (typeof fecha === 'string') {
            const [fechaParte, horaParte = '00:00:00'] = fecha.split(' ');
            const [dia, mes, anio] = fechaParte.split('/');
            const iso = `${anio}-${mes}-${dia}T${horaParte}`;
            fechaSolicitud = new Date(iso);
        }
        else if (fecha?.date) {
            const limpia = fecha.date.split('.')[0];
            return this.getTiempoDesde(limpia);
        }
        else {
            return '—';
        }

        if (isNaN(fechaSolicitud.getTime())) return '—';

        const ahora = new Date();
        let diffMs = ahora.getTime() - fechaSolicitud.getTime();
        if (diffMs < 0) diffMs = 0;

        const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHoras < 1) return 'Hace menos de 1 hora';
        if (diffHoras < 24) return `Hace ${diffHoras} hora${diffHoras !== 1 ? 's' : ''}`;
        return `Hace ${diffDias} día${diffDias !== 1 ? 's' : ''}`;
    }

    /**
     * Verificar si tiene pocos días disponibles
     */
    tienePocosDias(solicitud: any): boolean {
        if (!solicitud.historial) return false;
        const disponibles = solicitud.historial.dias_disponibles || 0;
        const solicitados = solicitud.historial.dias || 0;
        return disponibles - solicitados < 5;
    }

    /**
     * Obtener avatar por defecto según índice
     */
    getAvatar(index: number): string {
        const avatares = [
            'assets/images/avatars/male-01.jpg',
            'assets/images/avatars/female-01.jpg',
            'assets/images/avatars/male-02.jpg',
            'assets/images/avatars/female-02.jpg',
            'assets/images/avatars/male-03.jpg',
            'assets/images/avatars/female-03.jpg',
        ];
        return avatares[index % avatares.length];
    }

    /**
     * Track by function para ngFor
     */
    trackByFn(index: number, item: any): any {
        return item.historial?.id || index;
    }

    getFotoUsuario(usuario: any): string {
        if (usuario?.photo) {
            return `${APP_CONFIG.apiBase}/${usuario.photo}`;
        }
        return 'assets/images/avatars/default-avatar.jpg';
    }

    getHistorial(solicitud: any): any | null {
        return solicitud?.usuario?.vacaciones?.[0]?.historial?.[0] ?? null;
    }
}