import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ScanService } from './modules/colaborador/scan/scan.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(private _scanService: ScanService) {}

  ngOnInit(): void {
    const desbloquear = () => {
       this._scanService.desbloquearAudio();
      document.removeEventListener('click', desbloquear);
      document.removeEventListener('keydown', desbloquear);
      document.removeEventListener('touchstart', desbloquear);
    };

    document.addEventListener('click', desbloquear);
    document.addEventListener('keydown', desbloquear);
    document.addEventListener('touchstart', desbloquear);
  }

  detectarZebra(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('zebra') || ua.includes('tc') || ua.includes('android');
    // Zebra TC-series manda su UA con "zebra" o puedes verificar el modelo exacto
  }
}
