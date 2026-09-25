import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { slideUp } from 'app/shared/animations/mobile/slide-up.animation';
import { LectorQrComponent } from 'app/shared/components/lector-qr/lector-qr.component';

export interface ScanFeedback {
  codigo: string;
  ok: boolean;
  mensaje?: string;
}

@Component({
  selector: 'app-modal-escaner-embarques',
  standalone: true,
  imports: [CommonModule, MatIconModule, LectorQrComponent],
  templateUrl: './scanner-embarques-modal.component.html',
  animations: [slideUp],
})
export class ModalEscanerEmbarquesComponent {
  @ViewChild(LectorQrComponent) lectorQr?: LectorQrComponent;

  /** El padre decide si el modal se puede cerrar (por defecto sí). */
  @Input() titulo = 'Escanear embarques';
  @Input() ultimoFeedback: ScanFeedback | null = null;
  @Input() totalEscaneados = 0;

  @Output() cerrar = new EventEmitter<void>();
  @Output() codigoEscaneado = new EventEmitter<string>();

  private readonly DISMISS_THRESHOLD = 140;
  // Pausa cortita para que el usuario vea el feedback (ok/error) antes de
  // que la cámara vuelva a quedar lista para el siguiente código.
  private readonly REANUDAR_DELAY_MS = 900;

  private touchStartY = 0;
  private dragY = 0;
  isDragging = false;
  dragTransform = 'translateY(0)';
  dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';

  private reanudarTimeout: ReturnType<typeof setTimeout> | null = null;

  onOverlayClick(): void {
    this.cerrarModal();
  }

  cerrarModal(): void {
    if (this.reanudarTimeout) {
      clearTimeout(this.reanudarTimeout);
      this.reanudarTimeout = null;
    }
    this.cerrar.emit();
  }

  /**
   * Clave: este modal NO se cierra al detectar un código. Solo lo emite
   * hacia el padre (para que lo mande al backend, actualice contador, etc.)
   * y, tras una pequeña pausa visual, reanuda el lector él solito para
   * seguir escaneando el siguiente rollo/paquete.
   */
  onScanSuccess(codigo: string): void {
    this.codigoEscaneado.emit(codigo);

    if (this.reanudarTimeout) clearTimeout(this.reanudarTimeout);
    this.reanudarTimeout = setTimeout(() => {
      this.lectorQr?.reanudar();
    }, this.REANUDAR_DELAY_MS);
  }

  // ---- swipe-down para cerrar (solo gesto, no auto-cierre por scan) ----

  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
    this.dragY = 0;
    this.isDragging = true;
    this.dragTransition = 'none';
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging) return;
    event.preventDefault();
    const deltaY = event.touches[0].clientY - this.touchStartY;
    if (deltaY <= 0) {
      this.dragTransform = 'translateY(0)';
      return;
    }
    this.dragY = deltaY;
    const resistance =
      deltaY > this.DISMISS_THRESHOLD
        ? this.DISMISS_THRESHOLD + (deltaY - this.DISMISS_THRESHOLD) * 0.35
        : deltaY;
    this.dragTransform = `translateY(${resistance}px)`;
  }

  onTouchEnd(): void {
    this.isDragging = false;
    this.dragTransition = 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)';
    if (this.dragY >= this.DISMISS_THRESHOLD) {
      this.dragTransform = 'translateY(120%) scale(0.95)';
      setTimeout(() => {
        this.cerrarModal();
        this.dragTransform = 'translateY(0)';
      }, 260);
    } else {
      this.dragTransform = 'translateY(0)';
    }
  }
}