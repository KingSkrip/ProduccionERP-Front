import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProcesosTabComponent } from '../../list/tabs/procesos/procesos-tab.compoonent';
import { AcabadoRealTabComponent } from '../../list/tabs/acabadoreal/acabadoreal-tab.component';

@Component({
    selector: 'acabado-real-view',
    templateUrl: './acabadorealview.component.html',
    styleUrls: ['./acabadorealview.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        AcabadoRealTabComponent
      
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcabadoRealViewComponent {
    constructor() {
        // console.log('✅ AcabadoRealViewComponent cargado');
    }
}

