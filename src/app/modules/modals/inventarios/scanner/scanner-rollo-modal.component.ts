import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { slideUp } from 'app/shared/animations/mobile/slide-up.animation';
import { LectorQrComponent } from 'app/shared/components/lector-qr/lector-qr.component';

@Component({
  selector: 'app-modal-escaner-qr',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, LectorQrComponent],
  templateUrl: './scanner-rollo-modal.component.html',
  animations: [slideUp],
})
export class ModalEscanerQrComponent {
  @Input() escaneando = false;
  @Input() errorEscaner: string | null = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() scanSuccess = new EventEmitter<string>();
  @Output() camarasEncontradas = new EventEmitter<MediaDeviceInfo[]>();
  @Output() permisoCamara = new EventEmitter<boolean>();

  private readonly DISMISS_THRESHOLD = 140;

  private touchStartY = 0;
  private dragY = 0;
  isDragging = false;
  dragTransform = 'translateY(0)';
  dragTransition = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';

  onOverlayClick(): void {
    this.cerrar.emit();
  }

  onScanSuccess(codigo: string): void {
    this.scanSuccess.emit(codigo);
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