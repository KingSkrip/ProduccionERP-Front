import { HttpContextToken } from '@angular/common/http';

export const SILENT_HTTP = new HttpContextToken<boolean>(() => false);


// silent-Http.token.ts