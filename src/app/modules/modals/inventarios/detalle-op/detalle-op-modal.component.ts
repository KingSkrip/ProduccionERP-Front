import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { OpGrupo } from 'app/modules/admin/Inventarios/inventarios.component';
import { slideUp } from 'app/shared/animations/mobile/slide-up.animation';


@Component({
  selector: 'app-modal-detalle-op',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './detalle-op-modal.component.html',
  animations: [slideUp],
})
export class ModalDetalleOpComponent {
  @Input({ required: true }) op!: OpGrupo;
  @Output() cerrar = new EventEmitter<void>();

  private readonly DISMISS_THRESHOLD = 120;

  private touchStartY = 0;
  private touchCurrentY = 0;
  isDragging = false;
  dragTransform = 'translateY(0)';
  dragTransition = 'transform 0.3s ease';

  onOverlayClick(): void {
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
        this.dragTransform = 'translateY(0)';
      }, 200);
    } else {
      this.dragTransform = 'translateY(0)';
    }
  }
}