import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { EditCAItem, EditCAResultado, MonedaCA, UnidadCA } from 'app/modules/admin/Inventarios/types/correccion acabado.type';

import { slideUp } from 'app/shared/animations/mobile/slide-up.animation';
import { map } from 'rxjs';

const KG_POR_LB = 0.453592;
const YD_POR_M = 1.09361;

@Component({
  selector: 'app-modal-edit-ca',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './edit_ca_modal.component.html',
  animations: [slideUp],
})
export class ModalEditCAComponent {
  @Input({ required: true }) item!: EditCAItem;
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<EditCAResultado>();

  readonly unidades: UnidadCA[] = ['KGS', 'LBS', 'MTS', 'YDS'];
  readonly monedas: MonedaCA[] = ['MXN', 'USD'];

  cantidad: number | null = null;
  unidad: UnidadCA = 'KGS';
  precio: number | null = null;
  moneda: MonedaCA = 'MXN';

  // Dropdown propio (reemplaza al <select> nativo, que se cerraba solo)
readonly openSelect = signal<'unidad' | 'moneda' | null>(null);
readonly menuPos = signal<{ top: number; left: number; width: number }>({
  top: 0,
  left: 0,
  width: 0,
});

toggleSelect(which: 'unidad' | 'moneda', event: Event): void {
  event.stopPropagation();

  if (this.openSelect() === which) {
    this.openSelect.set(null);
    return;
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  this.menuPos.set({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  this.openSelect.set(which);
}

  elegirUnidad(u: UnidadCA, event: Event): void {
    event.stopPropagation();
    this.unidad = u;
    this.openSelect.set(null);
  }

  elegirMoneda(m: MonedaCA, event: Event): void {
    event.stopPropagation();
    this.moneda = m;
    this.openSelect.set(null);
  }

  cerrarSelects(): void {
    this.openSelect.set(null);
  }

  // Renderiza solo UN modal (desktop o móvil)
  private readonly bp = inject(BreakpointObserver);
  readonly isDesktop = toSignal(
    this.bp.observe('(min-width: 768px)').pipe(map((r) => r.matches)),
    { initialValue: true },
  );

  // --- Drag (móvil) ---
  private readonly DISMISS_THRESHOLD = 120;
  private touchStartY = 0;
  private touchCurrentY = 0;
  isDragging = false;
dragTransform = 'none';
  dragTransition = 'transform 0.3s ease';

  // Conversiones:
  //   valorCantL = kg / 0.453592
  //   valorCantM = kg * rend1   (m/Kg)
  //   valorCantY = libras * rend2 (yd/Lb)

  private get rend1(): number {
    return this.item?.rendimiento ?? 0;
  }

  private get rend2(): number {
    return this.item?.rendimientoYdLb ?? 0;
  }

  /** Cantidad capturada, normalizada a kilos según la U.M. elegida. */
  private get kgBase(): number | null {
    const q = this.cantidad;
    if (q == null || isNaN(q)) return null;

    switch (this.unidad) {
      case 'KGS':
        return q;
      case 'LBS':
        return q * KG_POR_LB;
      case 'MTS':
        return this.rend1 > 0 ? q / this.rend1 : null;
      case 'YDS':
        return this.rend2 > 0 ? (q / this.rend2) * KG_POR_LB : null;
    }
  }

  get kilogramos(): number | null {
    return this.kgBase;
  }

  get libras(): number | null {
    const kg = this.kgBase;
    return kg == null ? null : kg / KG_POR_LB;
  }

  get metros(): number | null {
    const kg = this.kgBase;
    return kg == null || this.rend1 <= 0 ? null : kg * this.rend1;
  }

  get yardas(): number | null {
    const lb = this.libras;
    return lb == null || this.rend2 <= 0 ? null : lb * this.rend2;
  }

  get anchoYardas(): number | null {
    const a = this.item?.ancho;
    return a == null ? null : a * YD_POR_M;
  }

  get puedeGuardar(): boolean {
    return (this.cantidad ?? 0) > 0 && (this.precio ?? 0) > 0;
  }

  onGuardar(): void {
    if (!this.puedeGuardar) return;

    this.guardar.emit({
      rollo: this.item.rollo,
      cantidad: this.cantidad as number,
      unidad: this.unidad,
      precio: this.precio as number,
      moneda: this.moneda,
      kilogramos: this.kilogramos,
      libras: this.libras,
      metros: this.metros,
      yardas: this.yardas,
    });
  }

  /** Cierra solo si el click fue directamente sobre el fondo. */
  onOverlayClick(event?: MouseEvent): void {
    if (event && event.target !== event.currentTarget) return;
    this.cerrar.emit();
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
    this.touchCurrentY = this.touchStartY;
    this.isDragging = true;
    this.dragTransition = 'none';
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging) return;
    event.preventDefault();
    this.touchCurrentY = event.touches[0].clientY;
    const delta = this.touchCurrentY - this.touchStartY;
    if (delta > 0) {
      this.dragTransform = `translateY(${delta}px)`;
    }
  }

  onTouchEnd(): void {
    const delta = this.touchCurrentY - this.touchStartY;
    this.isDragging = false;
    this.dragTransition = 'transform 0.3s ease';

if (delta > this.DISMISS_THRESHOLD) {
  this.dragTransform = 'translateY(100%)';
  setTimeout(() => {
    this.cerrar.emit();
    this.dragTransform = 'none';
  }, 200);
} else {
  this.dragTransform = 'none';
}
  }
}