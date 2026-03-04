import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
  selector: 'Procesos-viewjc',
  templateUrl: './procesosview.component.html',
  styleUrls: ['./procesosview.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTabsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcesosViewComponent {
  selectedTabIndex = 0;

  constructor() {}

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    // console.log('Tab cambiado a:', index);
  }
}
