import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DATE_LOCALE,
  MatNativeDateModule,
  MatOptionModule,
  MatRippleModule,
} from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fuseAnimations } from '@fuse/animations';
import { EdosCuentaService } from '../edos_cuenta.service';



@Component({
  selector: 'edos_cuenta-list',
  templateUrl: './edos_cuentaList.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatIconModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatSortModule,
    MatPaginatorModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatOptionModule,
    MatCheckboxModule,
    MatRippleModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-MX' }],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: fuseAnimations,
})
export class EdosCuentaListComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput: any;
  tabActiva: 'pendientes' | 'aprobadas' | 'rechazadas' = 'pendientes';
  searchControl: FormControl = new FormControl('');

  constructor(
    private _ScanService: EdosCuentaService,
    private _snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}
}
