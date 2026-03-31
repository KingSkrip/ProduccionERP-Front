import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { EmbarquesTabComponent } from '../../list/tabs/embarques/embarques.component';
import { PorRevisarTabComponent } from '../../list/tabs/por revisar/porrevisar-tab.component';
import { ProcesosTabComponent } from '../../list/tabs/procesos/procesos-tab.compoonent';
import { SaldosTabComponent } from '../../list/tabs/saldos/saldos.component';

@Component({
  selector: 'Procesos-view',
  templateUrl: './procesosview.component.html',
  styleUrls: ['./procesosview.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTabsModule,
    ProcesosTabComponent,
    PorRevisarTabComponent,
    SaldosTabComponent,
    EmbarquesTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcesosViewComponent {
  selectedTabIndex = 0;
  constructor() {}

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    // console.log('Tab cambiado a:', index);
  }



  // Método que se llama al hacer clic en los tabs de móvil
  selectTab(index: number): void {
    this.selectedTabIndex = index;
    
    // Opcional: Guardar la pestaña seleccionada para recordarla
    // localStorage.setItem('lastTab', index.toString());
  }

}
