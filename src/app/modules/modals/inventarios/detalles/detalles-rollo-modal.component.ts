import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { slideUp } from 'app/shared/animations/mobile/slide-up.animation';

@Component({
  selector: 'app-modal-rollo-detalle',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './detalles-rollo-modal.component.html',
  animations: [slideUp],
})
export class ModalRolloDetalleComponent {
  @Input({ required: true }) rollo!: any;
  @Input({ required: true }) campos!: { label: string; key: string }[];
  @Input() origenTexto = '';
  @Input() origenClase = '';
  @Output() cerrar = new EventEmitter<void>();

  private readonly DISMISS_THRESHOLD = 140;

  private touchStartY = 0;
  private dragY = 0;
  isDragging = false;
  dragTransform = 'translateY(0)';
  dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';

  onOverlayClick(): void {
    this.cerrar.emit();
  }

  valorCampo(item: any, key: string): string {
    const val = item?.[key];

    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';

    return String(val);
  }

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
        this.cerrar.emit();
        this.dragTransform = 'translateY(0)';
      }, 260);
    } else {
      this.dragTransform = 'translateY(0)';
    }
  }
}