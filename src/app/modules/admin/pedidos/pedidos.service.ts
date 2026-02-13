import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Usuarios } from 'app/modules/admin/cruds/usuarios/usuarios.types';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';



@Injectable({ providedIn: 'root' })
export class PedidosService {
  private _usuarios: BehaviorSubject<Usuarios[] | null> = new BehaviorSubject<Usuarios[] | null>(
    null,
  );
  private _solicitudes: BehaviorSubject<any[] | null> = new BehaviorSubject<any[] | null>(null);
  private apiUrl = APP_CONFIG.apiUrl;

  constructor(private _httpClient: HttpClient) {}

  // -----------------------------------------------------------------------------------------------------
  // @ Accessors
  // -----------------------------------------------------------------------------------------------------

  get usuarios$(): Observable<Usuarios[]> {
    return this._usuarios.asObservable();
  }

  get solicitudes$(): Observable<any[]> {
    return this._solicitudes.asObservable();
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Public methods - Usuarios
  // -----------------------------------------------------------------------------------------------------

  getUsuarios(): Observable<Usuarios[]> {
    return this._httpClient
      .get<{ message: string; data: Usuarios[] }>(`${this.apiUrl}colaborador/data`)
      .pipe(
        tap((response) => this._usuarios.next(response.data)),
        map((response) => response.data),
        catchError((error) => {
          console.error('Error al obtener usuarios', error);
          return throwError(() => error);
        }),
      );
  }

  getUsuarioById(id: string): Observable<Usuarios> {
    return this._httpClient
      .get<{ message: string; user: Usuarios }>(`${this.apiUrl}colaborador/suadmin/${id}`)
      .pipe(
        map((response) => response.user),
        catchError((error) => {
          console.error('Error al obtener usuario', error);
          return throwError(() => error);
        }),
      );
  }

}
