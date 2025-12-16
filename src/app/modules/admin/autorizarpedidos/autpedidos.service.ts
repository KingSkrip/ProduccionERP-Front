import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, switchMap, take, tap, throwError } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { Usuarios } from '../cruds/usuarios/usuarios.types';

export interface PedidoFirebird {
    ID: number;
    FECHAELAB: string;
    CLIENTE: string;
    TOTAL: number;
    AUTORIZACRED: number;
}


@Injectable({ providedIn: 'root' })
export class AutorizarPedidosService {

    private _pedidos = new BehaviorSubject<PedidoFirebird[] | null>(null);
    private apiUrl = APP_CONFIG.apiUrl;

    constructor(private _httpClient: HttpClient) { }

    // ----------------------------------------
    // OBSERVABLE
    // ----------------------------------------
    get pedidos$(): Observable<PedidoFirebird[]> {
        return this._pedidos.asObservable();
    }

    // ----------------------------------------
    // GET → LISTAR PEDIDOS (Firebird)
    // ----------------------------------------
    getPedidosPorAutorizar(): Observable<PedidoFirebird[]> {
        return this._httpClient
            .get<{ success: boolean; data: PedidoFirebird[] }>(
                `${this.apiUrl}firebird/pedidos`
            )
            .pipe(
                tap(resp => this._pedidos.next(resp.data)),
                map(resp => resp.data),
                catchError(err => {
                    console.error('Error al obtener pedidos Firebird', err);
                    return throwError(() => err);
                })
            );
    }

    // ----------------------------------------
    // PUT → AUTORIZAR CRÉDITO
    // ----------------------------------------
    autorizarCredito(pedidoId: number): Observable<any> {
        return this._httpClient
            .put(
                `${this.apiUrl}firebird/pedidos/${pedidoId}/autorizar-credito`,
                {}
            )
            .pipe(
                tap(() => {
                    // quitar de la lista local
                    const actuales = this._pedidos.getValue();
                    if (actuales) {
                        this._pedidos.next(
                            actuales.filter(p => p.ID !== pedidoId)
                        );
                    }
                }),
                catchError(err => {
                    console.error('Error al autorizar crédito', err);
                    return throwError(() => err);
                })
            );
    }
}
