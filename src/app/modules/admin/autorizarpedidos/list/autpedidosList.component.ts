import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fuseAnimations } from '@fuse/animations';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AutorizarPedidosService } from '../autpedidos.service';

@Component({
  selector: 'autorizarpedidos-list',
  templateUrl: './autpedidosList.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatProgressBarModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: fuseAnimations,
})
export class AutorizarPedidosListComponent implements OnInit, OnDestroy {
  pedidos: any[] = [];
  pedidosFiltrados: any[] = [];
  isLoading: boolean = false;
  searchControl: FormControl = new FormControl('');

  private _unsubscribeAll: Subject<any> = new Subject<any>();

  constructor(
    private _changeDetectorRef: ChangeDetectorRef,
    private _fuseConfirmationService: FuseConfirmationService,
    private _pedidosService: AutorizarPedidosService,
    private _snackBar: MatSnackBar,
  ) {}

  // -----------------------------------------------------------------------------------------------------
  // @ Lifecycle hooks
  // -----------------------------------------------------------------------------------------------------

  ngOnInit(): void {
    this.cargarPedidos();
    this.configurarBuscador();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Public methods
  // -----------------------------------------------------------------------------------------------------

  /**
   * Cargar pedidos desde el servicio
   */
  cargarPedidos(): void {
    this.isLoading = true;
    this._changeDetectorRef.markForCheck();

    this._pedidosService
      .getPedidosPorAutorizar()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (pedidos) => {
          this.pedidos = pedidos;
          this.pedidosFiltrados = pedidos;
          this.isLoading = false;
          this._changeDetectorRef.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar pedidos:', error);
          this._snackBar.open('Error al cargar pedidos. Verifica tu conexión.', 'Cerrar', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.isLoading = false;
          this._changeDetectorRef.markForCheck();
        },
      });
  }

  /**
   * Configurar el buscador con debounce
   */
  configurarBuscador(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this._unsubscribeAll))
      .subscribe((valor) => {
        this.filtrarPedidos(valor);
      });
  }

  /**
   * Filtrar pedidos por búsqueda
   */
  filtrarPedidos(valor: string): void {
    if (!valor || valor.trim() === '') {
      this.pedidosFiltrados = this.pedidos;
    } else {
      const filtro = valor.toLowerCase().trim();
      this.pedidosFiltrados = this.pedidos.filter(
        (p) =>
          p.PEDIDO?.toString().toLowerCase().includes(filtro) ||
          p.CVE_CTE?.toLowerCase().includes(filtro) ||
          p.CLIENTE?.toLowerCase().includes(filtro),
      );
    }
    this._changeDetectorRef.markForCheck();
  }

  /**
   * Autorizar un pedido específico
   */
  autorizarPedido(pedido: any): void {
    const confirmacion = this._fuseConfirmationService.open({
      title: 'Autorizar crédito',
      message: `¿Confirmas que deseas autorizar el crédito para el pedido <strong>${pedido.PEDIDO}</strong>?`,
      icon: {
        show: true,
        name: 'heroicons_outline:check-circle',
        color: 'success',
      },
      actions: {
        confirm: {
          show: true,
          label: 'Autorizar',
          color: 'primary',
        },
        cancel: {
          show: true,
          label: 'Cancelar',
        },
      },
      dismissible: true,
    });

    confirmacion.afterClosed().subscribe((result) => {
      if (result === 'confirmed') {
        this.isLoading = true;
        this._changeDetectorRef.markForCheck();

        this._pedidosService
          .autorizarCredito(pedido.ID)
          .pipe(takeUntil(this._unsubscribeAll))
          .subscribe({
            next: () => {
              // Remover de la lista
              this.pedidos = this.pedidos.filter((p) => p.ID !== pedido.ID);
              this.pedidosFiltrados = this.pedidosFiltrados.filter((p) => p.ID !== pedido.ID);

              this._snackBar.open('✓ Pedido autorizado correctamente', 'Cerrar', {
                duration: 3000,
                panelClass: 'success-snackbar',
              });

              this.isLoading = false;
              this._changeDetectorRef.markForCheck();
            },
            error: (error) => {
              console.error('Error al autorizar pedido:', error);
              this._snackBar.open('Error al autorizar el pedido. Intenta de nuevo.', 'Cerrar', {
                duration: 5000,
                panelClass: 'error-snackbar',
              });
              this.isLoading = false;
              this._changeDetectorRef.markForCheck();
            },
          });
      }
    });
  }

  /**
   * Track by function para optimizar el rendering
   */
  trackByFn(index: number, item: any): number {
    return item.ID || index;
  }
}
