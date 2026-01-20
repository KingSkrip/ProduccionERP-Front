import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { ProcesosTabComponent } from '../../list/tabs/procesos/procesos-tab.compoonent';
import { PorRevisarTabComponent } from '../../list/tabs/por revisar/porrevisar-tab.component';
import { SaldosTabComponent } from '../../list/tabs/saldos/saldos.component';
import { EmbarquesTabComponent } from '../../list/tabs/embarques/embarques.component';

@Component({
    selector: 'inicio-view',
    templateUrl: './inicioview.component.html',
    styleUrls: ['./inicioview.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatTabsModule,
        ProcesosTabComponent,
        PorRevisarTabComponent,
        SaldosTabComponent,
        EmbarquesTabComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InicioViewComponent {
    selectedTabIndex = 0;

    constructor() {
        // console.log('✅ InicioViewComponent cargado');
    }

    onTabChange(index: number): void {
        this.selectedTabIndex = index;
        // console.log('Tab cambiado a:', index);
    }
}
