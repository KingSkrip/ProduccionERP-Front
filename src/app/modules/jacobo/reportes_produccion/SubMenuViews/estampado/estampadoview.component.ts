// ========================================
// estampadoview.component.ts
// ========================================
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EstampadosTabComponent } from '../../list/tabs/estampados/estampados-tab.compoonent';

@Component({
  selector: 'estampado-view',
  templateUrl: './estampadoview.component.html',
  styleUrls: ['./estampadoview.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, EstampadosTabComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstampadoViewComponent {
  constructor() {
    // console.log(' EstampadoViewComponent cargado');
  }
}
