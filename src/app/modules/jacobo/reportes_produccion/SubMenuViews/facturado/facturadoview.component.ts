import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FacturadoTabComponent } from '../../list/tabs/facturado/facturado-tab.compoonent';

@Component({
  selector: 'facturado-view',
  templateUrl: './facturadoview.component.html',
  styleUrls: ['./facturadoview.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, FacturadoTabComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacturadoViewComponent {
  constructor() {
    // console.log(' FacturadoViewComponent cargado');
  }
}
