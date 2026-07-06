import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
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
  }

  get photoUrl(): string {
    const user = this._user.value;
    if (!user?.photo) return '';

    const base = this.apiBase.endsWith('/') ? this.apiBase : this.apiBase + '/';
    const photo = user.photo.startsWith('/') ? user.photo.substring(1) : user.photo;

    return `${base}${photo}?v=${this._photoVersion}`;
  }

  /**
   * APARIENCIA POR ROL
   */
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
}
