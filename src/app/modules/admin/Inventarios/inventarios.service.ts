import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { APP_CONFIG } from 'app/core/config/app-config';
import { InventarioFiltros, InventarioItem } from './types/inventario.type';
import { RolloItem } from './types/rollo.type';
import { ApiResponse } from '../pedidos/pedidos.service';



@Injectable({
    providedIn: 'root'
})
export class InventariosService {
    private readonly baseUrl = `${APP_CONFIG.apiUrl}inventario`;

    constructor(private http: HttpClient) { }

    /**
     * GET /inventario
     * Trae el listado de piezas en proceso (PSDTABPZAS) con sus filtros opcionales.
     */
    getInventario(filtros?: InventarioFiltros): Observable<InventarioItem[]> {
        let params = new HttpParams();

        if (filtros?.cve_art) {
            params = params.set('cve_art', filtros.cve_art);
        }

        if (filtros?.cve_alm) {
            params = params.set('cve_alm', filtros.cve_alm);
        }

        return this.http
            .get<ApiResponse<InventarioItem[]>>(`${this.baseUrl}`, { params })
            .pipe(map((res) => res.data));
    }

    /**
    * POST /inventario/escanear
    * Busca el detalle completo de un rollo a partir del código QR (con ceros a la izquierda).
    */
    escanearQr(codigo: string): Observable<InventarioItem> {
        return this.http
            .post<ApiResponse<InventarioItem>>(`${this.baseUrl}/escanearinventario`, { codigo })
            .pipe(map((res) => res.data));
    }
}