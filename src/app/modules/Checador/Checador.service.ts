import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { APP_CONFIG } from 'app/core/config/app-config';
import { SILENT_HTTP } from 'app/core/interceptors/silent-http.token';
import {
  BehaviorSubject,
  Observable,
  catchError,
  filter,
  map,
  of,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChecadorService {

}
