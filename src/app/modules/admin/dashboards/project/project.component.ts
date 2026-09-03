import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { QRCodeComponent } from 'angularx-qrcode';
import { RoleEnum, SubRoleEnum } from 'app/core/auth/roles/dataroles';
import { APP_CONFIG } from 'app/core/config/app-config';
import { UserService } from 'app/core/user/user.service';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { AsistenciasComponent } from './Allusers/Tabs/asistencias/asistencias.component';
import { InicioComponent } from './Allusers/Tabs/Inicio/inicio.component';
import { VacacionesComponent } from './Allusers/Tabs/vacaciones/vacaciones.component';

@Component({
  selector: 'project',
  templateUrl: './project.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatTooltipModule,
    QRCodeComponent,
    AsistenciasComponent,
    VacacionesComponent,
    InicioComponent,
  ],
})
export class ProjectComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  private _user = new BehaviorSubject<any>(null);
  user$ = this._user.asObservable();
  apiBase = APP_CONFIG.apiBase;
  private _photoVersion = Date.now();
  userRole: number | null = null;
  userSubRole: number | null = null;
  saldoActual = 0;
  saldoAnterior = 0;
  cargosMes = 0;
  pagosRealizados = 0;
  creditoDisponible = 0;
  limiteCredito = 0;
  pedidosMes = 0;
  incrementoPedidos = 0;
  ordenesPendientes = 0;
  fechaCorte = '';
  showQrModal = false;
  private _qrRefreshInterval: any = null;
  liveQrToken = '';
  // 🔒 Solo control de visibilidad, el token sigue siendo el mismo (qr.token del backend)
  qrVisible = true;

  constructor(
    private _userService: UserService,
    private _cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this._userService.user$.pipe(takeUntil(this._unsubscribeAll)).subscribe((user) => {
      if (user) {
        this._user.next(user);
        this.userRole = user.permissions?.[0] ?? null;
        this.userSubRole = user.sub_permissions?.[0] ?? null;
        this._cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
    this._stopQrRefresh();
  }

  // -----------------------------------------------------------------------------------------------------
  // 🔒 Ocultar QR ante posible captura/grabación (pérdida de foco de la app)
  // -----------------------------------------------------------------------------------------------------

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.hidden) {
      this._hideQr();
    } else {
      setTimeout(() => this._showQr(), 300);
    }
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    this._hideQr();
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    setTimeout(() => this._showQr(), 300);
  }

  // Solo aplica en desktop, en móvil no hay evento de teclado para captura
  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'PrintScreen') {
      this._hideQr();
      setTimeout(() => this._showQr(), 1500);
    }
  }

  private _hideQr(): void {
    this.qrVisible = false;
    this._cdr.markForCheck();
  }

  private _showQr(): void {
    if (!this.showQrModal) return;
    this.qrVisible = true;
    this._cdr.markForCheck();
  }

  get photoUrl(): string {
    const user = this._user.value;
    if (!user?.photo) return '';

    const base = this.apiBase.endsWith('/') ? this.apiBase : this.apiBase + '/';
    const photo = user.photo.startsWith('/') ? user.photo.substring(1) : user.photo;

    return `${base}${photo}?v=${this._photoVersion}`;
  }

  get isJefeOrSuadmin(): boolean {
    return (
      this.userRole === RoleEnum.SUADMIN &&
      (this.userSubRole === SubRoleEnum.JEFE ||
        this.userSubRole === SubRoleEnum.JAIME ||
        this.userSubRole === SubRoleEnum.SABU ||
        this.userSubRole === SubRoleEnum.JACOBO)
    );
  }

  get isCliente(): boolean {
    return this.userRole === RoleEnum.CLIENTE;
  }

  get isAllUsers(): boolean {
    return !this.isJefeOrSuadmin && !this.isCliente;
  }
  openQrModal(): void {
    this.showQrModal = true;
    this.qrVisible = true;
    this._startQrRefresh();
    this._cdr.markForCheck();
  }

  closeQrModal(): void {
    this.showQrModal = false;
    this._stopQrRefresh();
    this._cdr.markForCheck();
  }

  private _startQrRefresh(): void {
    this._stopQrRefresh();

    this._fetchFreshQr();

    this._qrRefreshInterval = setInterval(() => this._fetchFreshQr(), 20000);
  }

  private _stopQrRefresh(): void {
    if (this._qrRefreshInterval) {
      clearInterval(this._qrRefreshInterval);
      this._qrRefreshInterval = null;
    }
  }

  private _fetchFreshQr(): void {
    this._userService.refreshQr().subscribe({
      next: (resp) => {
        this.liveQrToken = resp.token;
        this._cdr.markForCheck();
      },
      error: (err) => {
        console.error('[QR] Error al refrescar:', err);
      },
    });
  }
}
