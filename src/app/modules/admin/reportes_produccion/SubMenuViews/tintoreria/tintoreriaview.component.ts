// ========================================
// tintoreriaview.component.ts
// ========================================
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TintoreriaTabComponent } from '../../list/tabs/tintoreria/tintoreria-tab.compoonent';

@Component({
  selector: 'tintoreria-view',
  templateUrl: './tintoreriaview.component.html',
  styleUrls: ['./tintoreriaview.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, TintoreriaTabComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TintoreriaViewComponent {
  constructor() {
    // console.log(' TintoreriaViewComponent cargado');
  }
}
