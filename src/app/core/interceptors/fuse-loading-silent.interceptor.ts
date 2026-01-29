import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { FuseLoadingService } from '@fuse/services/loading';
import { SILENT_HTTP } from './silent-http.token';

export const fuseLoadingSilentInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(FuseLoadingService);
  const silent = req.context.get(SILENT_HTTP);

  if (silent) {
    return next(req);
  }

  loading.show();
  return next(req).pipe(finalize(() => loading.hide()));
};
