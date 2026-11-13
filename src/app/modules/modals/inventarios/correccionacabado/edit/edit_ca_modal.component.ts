import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  EditCAItem,
  EditCAResultado,
  UnidadCA,
} from 'app/modules/admin/Inventarios/types/correccion acabado.type';

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
export class ModalEditCAComponent implements OnInit {
  @Input({ required: true }) item!: EditCAItem;
  @Input() guardando = false;
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<EditCAResultado>();
  @Input() eliminando = false;
  @Output() eliminar = new EventEmitter<string>();
  readonly confirmandoEliminar = signal(false);
  readonly unidades: UnidadCA[] = ['KGS', 'LBS', 'MTS', 'YDS'];
  readonly ESTATUS_EDITABLE = 3;

  cantidad: number | null = null;
  tara: number | null = null;
  pesoNeto: number | null = null;
  pesoBruto: number | null = null;
  unidad: UnidadCA = 'KGS';

  // Dropdown propio (reemplaza al <select> nativo, que se cerraba solo)
  readonly openSelect = signal<'unidad' | null>(null);
  readonly menuPos = signal<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  toggleSelect(which: 'unidad', event: Event): void {
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
    this.recalcularNetoDesdeCantidad();
  }

  cerrarSelects(): void {
    this.openSelect.set(null);
  }

  // Renderiza solo UN modal (desktop o móvil)
  private readonly bp = inject(BreakpointObserver);
  readonly isDesktop = toSignal(this.bp.observe('(min-width: 768px)').pipe(map((r) => r.matches)), {
    initialValue: true,
  });

  // --- Drag (móvil) ---
  private readonly DISMISS_THRESHOLD = 120;
  private touchStartY = 0;
  private touchCurrentY = 0;
  isDragging = false;
  dragTransform = 'none';
  dragTransition = 'transform 0.3s ease';

  ngOnInit(): void {
    this.tara = this.item?.tara ?? 0;
    this.pesoNeto = this.item?.peso ?? null;
    this.sincronizarBruto();
    if (this.pesoNeto != null) this.cantidad = this.pesoNeto; // KGS por defecto
  }
  private get rend1(): number {
    return this.item?.rendimiento ?? 0;
  }

  private get rend2(): number {
    return this.item?.rendimientoYdLb ?? 0;
  }

  /** Cantidad capturada, normalizada a kilos según la U.M. elegida. */
  private get kgBase(): number | null {
    return this.pesoNeto != null && !isNaN(this.pesoNeto) ? this.pesoNeto : null;
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

  get pbruto(): number | null {
    const kg = this.kgBase;
    return kg == null ? null : kg + (this.tara ?? 0);
  }

  get puedeGuardar(): boolean {
    return (
      !this.bloqueado &&
      !this.guardando &&
      !this.eliminando &&
      (this.pesoNeto ?? 0) > 0 &&
      (this.tara ?? 0) >= 0 &&
      this.pesoBruto != null &&
      this.pesoBruto >= (this.pesoNeto ?? 0) &&
      this.kilogramos != null &&
      this.libras != null &&
      this.metros != null &&
      this.yardas != null
    );
  }

  onGuardar(): void {
    if (!this.puedeGuardar) return;
    this.guardar.emit({
      rollo: this.item.rollo,
      cantidad: this.cantidad ?? (this.pesoNeto as number),
      unidad: this.unidad,
      kilogramos: this.r3(this.pesoNeto as number),
      libras: this.libras as number,
      metros: this.metros as number,
      yardas: this.yardas as number,
      tara: this.r3(this.tara ?? 0),
      pbruto: this.r3(this.pesoBruto as number),
    });
  }

  pedirEliminar(): void {
    if (this.bloqueado) return;
    this.confirmandoEliminar.set(true);
  }
  cancelarEliminar(): void {
    this.confirmandoEliminar.set(false);
  }

  onEliminar(): void {
    if (this.eliminando || this.bloqueado) return;
    this.eliminar.emit(this.item.rollo);
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

  private r3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }

  // ---- Handlers de edición ----
  onCantidadChange(v: number | null): void {
    this.cantidad = v;
    this.recalcularNetoDesdeCantidad();
  }

  onNetoChange(v: number | null): void {
    this.pesoNeto = v;
    const c = this.cantidadDesdeKg(v);
    if (c != null) this.cantidad = this.r3(c);
    this.sincronizarBruto();
  }

  onTaraChange(v: number | null): void {
    this.tara = v;
    this.sincronizarBruto();
  }

  onBrutoChange(v: number | null): void {
    this.pesoBruto = v;
    if (v == null) return;

    const neto = this.r3(v - (this.tara ?? 0));
    this.pesoNeto = neto;

    // Mantiene Cantidad sincronizada con el nuevo neto, según la U.M.
    const c = neto > 0 ? this.cantidadDesdeKg(neto) : null;
    if (c != null) this.cantidad = this.r3(c);
  }

  private sincronizarBruto(): void {
    this.pesoBruto = this.pesoNeto == null ? null : this.r3(this.pesoNeto + (this.tara ?? 0));
  }

  private recalcularNetoDesdeCantidad(): void {
    const kg = this.kgDesdeCantidad();
    this.pesoNeto = kg == null ? null : this.r3(kg);
    this.sincronizarBruto();
  }

  private kgDesdeCantidad(): number | null {
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

  private cantidadDesdeKg(kg: number | null): number | null {
    if (kg == null || isNaN(kg)) return null;
    switch (this.unidad) {
      case 'KGS':
        return kg;
      case 'LBS':
        return kg / KG_POR_LB;
      case 'MTS':
        return this.rend1 > 0 ? kg * this.rend1 : null;
      case 'YDS':
        return this.rend2 > 0 ? (kg / KG_POR_LB) * this.rend2 : null;
    }
  }

  get bloqueado(): boolean {
    return Number(this.item?.estatus) !== this.ESTATUS_EDITABLE;
  }
}
