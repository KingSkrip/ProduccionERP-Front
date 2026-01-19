import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProcesosTabComponent } from '../../list/tabs/procesos/procesos-tab.compoonent';

@Component({
    selector: 'acabado-real-view',
    templateUrl: './acabadorealview.component.html',
    styleUrls: ['./acabadorealview.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        ProcesosTabComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcabadoRealViewComponent {
    constructor() {
        // console.log('✅ AcabadoRealViewComponent cargado');
    }
}

