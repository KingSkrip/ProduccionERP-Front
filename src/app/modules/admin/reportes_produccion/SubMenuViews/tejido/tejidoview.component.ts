// ========================================
// tejidoview.component.ts
// ========================================
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { ProduccionTabComponent } from '../../list/tabs/produccion/produccion-tejido.compoonent';
import { TejidoRevisadoTabComponent } from '../../list/tabs/revisado/tejido-revisado.component';
import { TejidoTabComponent } from '../../list/tabs/tejido/tejido-tab.component';

@Component({
  selector: 'tejido-view',
  templateUrl: './tejidoview.component.html',
  styleUrls: ['./tejidoview.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTabsModule,
    TejidoTabComponent,
    ProduccionTabComponent,
    TejidoRevisadoTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TejidoViewComponent {
  selectedTabIndex = 0;

  constructor() {
    // console.log(' TejidoViewComponent cargado');
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    // console.log('Tab cambiado a:', index);
  }
}
