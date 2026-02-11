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
import { Mail, MailCategory, MailFilter, MailFolder, MailLabel } from './mailbox.types';

export interface SimpleUser {
  id: number;
  nombre: string;
  correo?: string | null;
  photo?: string | null;
}

export interface TaskParticipantPayload {
  user_id: number;
  role: 'receptor' | 'cc' | 'bcc';
  status_id?: number | null;
  comentarios?: string | null;
  fecha_accion?: string | null;
  orden?: number | null;
}

export interface CreateTaskPayload {
  de_id: number;
  para_id?: number | null;
  status_id?: number | null;
  titulo: string;
  descripcion: string;
  participants?: TaskParticipantPayload[];
}

@Injectable({ providedIn: 'root' })
export class MailboxService {
  selectedMailChanged: BehaviorSubject<any> = new BehaviorSubject(null);
  private _category: BehaviorSubject<MailCategory> = new BehaviorSubject(null);
  private _filters: BehaviorSubject<MailFilter[]> = new BehaviorSubject(null);
  private _folders: BehaviorSubject<MailFolder[]> = new BehaviorSubject(null);
  private _labels: BehaviorSubject<MailLabel[]> = new BehaviorSubject(null);
  private _mails: BehaviorSubject<Mail[]> = new BehaviorSubject(null);
  private _mailsLoading: BehaviorSubject<boolean> = new BehaviorSubject(false);
  private _mail: BehaviorSubject<Mail> = new BehaviorSubject(null);
  private _pagination: BehaviorSubject<any> = new BehaviorSubject(null);
  private readonly apiUrl = APP_CONFIG.apiUrl;

  private _mailsUpdated$ = new BehaviorSubject<boolean>(false);
  mailsUpdated$ = this._mailsUpdated$.asObservable();
  /**
   * Constructor
   */
  constructor(private _httpClient: HttpClient) {}

  // -----------------------------------------------------------------------------------------------------
  // @ Accessors
  // -----------------------------------------------------------------------------------------------------

  /**
   * WEBSOCKET
   */
  reloadMails(): void {
    this._mailsUpdated$.next(true);
  }

  /**
   * Getter for category
   */
  get category$(): Observable<MailCategory> {
    return this._category.asObservable();
  }

  /**
   * Getter for filters
   */
  get filters$(): Observable<MailFilter[]> {
    return this._filters.asObservable();
  }

  /**
   * Getter for folders
   */
  get folders$(): Observable<MailFolder[]> {
    return this._folders.asObservable();
  }

  /**
   * Getter for labels
   */
  get labels$(): Observable<MailLabel[]> {
    return this._labels.asObservable();
  }

  /**
   * Getter for mails
   */
  get mails$(): Observable<Mail[]> {
    return this._mails.asObservable();
  }

  /**
   * Getter for mails loading
   */
  get mailsLoading$(): Observable<boolean> {
    return this._mailsLoading.asObservable();
  }

  /**
   * Getter for mail
   */
  get mail$(): Observable<Mail> {
    return this._mail.asObservable();
  }

  /**
   * Getter for pagination
   */
  get pagination$(): Observable<any> {
    return this._pagination.asObservable();
  }

  // ==========================
  // Mailbox actions (REAL)
  // ==========================
  markRead(mail: any, is_read = true): Observable<any> {
    const mi = this.getMailboxItemId(mail);

    // 1) si tengo mailboxItemId uso el endpoint actual
    if (mi) {
      return this._httpClient
        .patch<any>(`${this.apiUrl}mailbox/${mi}/read`, { is_read })
        .pipe(map((resp) => resp?.data ?? resp));
    }

    // 2) si NO existe mailboxItem, uso endpoint por workorder
    const wo = this.getWorkorderId(mail);
    return this._httpClient
      .patch<any>(`${this.apiUrl}mailbox/workorder/${wo}/read`, { is_read })
      .pipe(map((resp) => resp?.data ?? resp));
  }

  toggleStar(mail: any): Observable<any> {
    const mi = this.getMailboxItemId(mail);

    if (mi) {
      return this._httpClient
        .patch<any>(`${this.apiUrl}mailbox/${mi}/star`, {})
        .pipe(map((resp) => resp?.data ?? resp));
    }

    const wo = this.getWorkorderId(mail);
    return this._httpClient
      .patch<any>(`${this.apiUrl}mailbox/workorder/${wo}/star`, {})
      .pipe(map((resp) => resp?.data ?? resp));
  }

  toggleImportant(mail: any): Observable<any> {
    const mi = this.getMailboxItemId(mail);

    if (mi) {
      return this._httpClient
        .patch<any>(`${this.apiUrl}mailbox/${mi}/important`, {})
        .pipe(map((resp) => resp?.data ?? resp));
    }

    const wo = this.getWorkorderId(mail);
    return this._httpClient
      .patch<any>(`${this.apiUrl}mailbox/workorder/${wo}/important`, {})
      .pipe(map((resp) => resp?.data ?? resp));
  }

  moveTo(mail: any, folder: 'general' | 'spam' | 'eliminados' | 'drafts'): Observable<any> {
    const mi = this.getMailboxItemId(mail);

    if (mi) {
      return this._httpClient
        .patch<any>(`${this.apiUrl}mailbox/${mi}/move`, { folder })
        .pipe(map((resp) => resp?.data ?? resp));
    }

    const wo = this.getWorkorderId(mail);
    return this._httpClient
      .patch<any>(`${this.apiUrl}mailbox/workorder/${wo}/move`, { folder })
      .pipe(map((resp) => resp?.data ?? resp));
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Public methods
  // -----------------------------------------------------------------------------------------------------

  /**
   * Get filters
   */
  getFilters(): Observable<any> {
    return this._httpClient.get<MailFilter[]>('api/apps/mailbox/filters').pipe(
      tap((response: any) => {
        this._filters.next(response);
      }),
    );
  }

  /**
   * Get folders
   */
  getFolders(): Observable<any> {
    return this._httpClient.get<MailFolder[]>('api/apps/mailbox/folders').pipe(
      tap((response: any) => {
        this._folders.next(response);
      }),
    );
  }

  /**
   * Get labels
   */
  getLabels(): Observable<any> {
    return this._httpClient.get<MailLabel[]>('api/apps/mailbox/labels').pipe(
      tap((response: any) => {
        this._labels.next(response);
      }),
    );
  }

  /**
   * Get mails by filter
   */
  getMailsByFilter(filter: string, page: string = '1'): Observable<any> {
    // Execute the mails loading with true
    this._mailsLoading.next(true);

    return this._httpClient
      .get<Mail[]>('api/apps/mailbox/mails', {
        params: {
          filter,
          page,
        },
      })
      .pipe(
        tap((response: any) => {
          this._category.next({
            type: 'filter',
            name: filter,
          });
          this._mails.next(response.mails);
          this._pagination.next(response.pagination);
          this._mailsLoading.next(false);
        }),
        switchMap((response) => {
          if (response.mails === null) {
            return throwError({
              message: 'Requested page is not available!',
              pagination: response.pagination,
            });
          }

          return of(response);
        }),
      );
  }

  /**
   * Get mails by folder
   */
  getMailsByFolder(folder: string, page: string = '1'): Observable<any> {
    this._mailsLoading.next(true);

    // 👇 Traducción de slugs UI -> slugs API
    const apiFolderMap: Record<string, string> = {
      mensajes: 'general',
    };

    const apiFolder = apiFolderMap[folder] ?? folder;

    return this._httpClient
      .get<any>(`${this.apiUrl}mailbox/${apiFolder}`, { params: { page } })
      .pipe(
        map((resp: any) => resp?.data ?? resp),
        tap((response: any) => {
          this._category.next({ type: 'folder', name: folder }); // UI muestra "mensajes"
          const mails = (response?.mails ?? []).map((wo: any) => this.normalizeWorkorderToMail(wo));
          this._mails.next(mails);
          this._pagination.next(response.pagination);
          this._mailsLoading.next(false);
        }),
        switchMap((response) => {
          if (response.mails === null) {
            return throwError(() => ({
              message: 'Requested page is not available!',
              pagination: response.pagination,
            }));
          }
          return of(response);
        }),
      );
  }

  getMailsByCustomFilter(filter: 'importantes' | 'destacados', page = '1') {
    this._mailsLoading.next(true);

    const mapSlug: Record<'importantes' | 'destacados', string> = {
      importantes: 'important',
      destacados: 'starred',
    };

    const apiFilter = mapSlug[filter];

    return this._httpClient
      .get<any>(`${this.apiUrl}mailbox/${apiFilter}`, { params: { page } })
      .pipe(
        map((resp: any) => resp?.data ?? resp),
        tap((response: any) => {
          this._category.next({ type: 'filter', name: filter });
          const mails = (response?.mails ?? []).map((wo: any) => this.normalizeWorkorderToMail(wo));
          this._mails.next(mails);
          this._pagination.next(response.pagination);
          this._mailsLoading.next(false);
        }),
      );
  }

  /**
   * Get mails by label
   */
  getMailsByLabel(label: string, page: string = '1'): Observable<any> {
    // Execute the mails loading with true
    this._mailsLoading.next(true);

    return this._httpClient
      .get<Mail[]>('api/apps/mailbox/mails', {
        params: {
          label,
          page,
        },
      })
      .pipe(
        tap((response: any) => {
          this._category.next({
            type: 'label',
            name: label,
          });
          this._mails.next(response.mails);
          this._pagination.next(response.pagination);
          this._mailsLoading.next(false);
        }),
        switchMap((response) => {
          if (response.mails === null) {
            return throwError({
              message: 'Requested page is not available!',
              pagination: response.pagination,
            });
          }

          return of(response);
        }),
      );
  }

  /**
   * Get mail by id
   */

  getMailById(id: string): Observable<any> {
    const wantedId = String(id);

    return this._mails.pipe(
      filter((mails: any) => Array.isArray(mails) && mails.length > 0),
      take(1),
      map((mails: any[]) => {
        const mail = mails.find((item) => String(item?.id) === wantedId) || null;
        this._mail.next(mail);
        return mail;
      }),
      switchMap((mail) => {
        if (!mail) {
          return throwError(() => new Error('Could not found mail with id of ' + wantedId + '!'));
        }
        return of(mail);
      }),
    );
  }

  /**
   * Update mail
   *
   * @param id
   * @param mail
   */
  updateMail(id: string, mail: Mail): Observable<any> {
    return this._httpClient
      .patch('api/apps/mailbox/mail', {
        id,
        mail,
      })
      .pipe(
        tap(() => {
          // Re-fetch the folders on mail update
          // to get the updated counts on the sidebar
          this.getFolders().subscribe();
        }),
      );
  }

  /**
   * Reset the current mail
   */
  resetMail(): Observable<boolean> {
    return of(true).pipe(
      take(1),
      tap(() => {
        this._mail.next(null);
      }),
    );
  }

  /**
   * Add label
   *
   * @param label
   */
  addLabel(label: MailLabel): Observable<any> {
    return this.labels$.pipe(
      take(1),
      switchMap((labels) =>
        this._httpClient.post<MailLabel>('api/apps/mailbox/label', { label }).pipe(
          map((newLabel) => {
            // Update the labels with the Nueva etiqueta
            this._labels.next([...labels, newLabel]);

            // Return the Nueva etiqueta
            return newLabel;
          }),
        ),
      ),
    );
  }

  /**
   * Update label
   *
   * @param id
   * @param label
   */
  updateLabel(id: string, label: MailLabel): Observable<any> {
    return this.labels$.pipe(
      take(1),
      switchMap((labels) =>
        this._httpClient
          .patch<MailLabel>('api/apps/mailbox/label', {
            id,
            label,
          })
          .pipe(
            map((updatedLabel: any) => {
              // Find the index of the updated label within the labels
              const index = labels.findIndex((item) => item.id === id);

              // Update the label
              labels[index] = updatedLabel;

              // Update the labels
              this._labels.next(labels);

              // Return the updated label
              return updatedLabel;
            }),
          ),
      ),
    );
  }

  /**
   * Delete label
   *
   * @param id
   */
  deleteLabel(id: string): Observable<any> {
    return this.labels$.pipe(
      take(1),
      switchMap((labels) =>
        this._httpClient.delete('api/apps/mailbox/label', { params: { id } }).pipe(
          map((isDeleted: any) => {
            // Find the index of the deleted label within the labels
            const index = labels.findIndex((item) => item.id === id);

            // Delete the label
            labels.splice(index, 1);

            // Update the labels
            this._labels.next(labels);

            // Return the deleted status
            return isDeleted;
          }),
        ),
      ),
    );
  }

  /**
   * tasks
   */
  createTask(payload: CreateTaskPayload, files: File[] = [], silent = false): Observable<any> {
    const context = new HttpContext().set(SILENT_HTTP, silent);

    const fd = new FormData();
    fd.append('de_id', String(payload.de_id));
    fd.append('para_id', payload.para_id == null ? '' : String(payload.para_id));
    fd.append('status_id', payload.status_id == null ? '' : String(payload.status_id));
    fd.append('titulo', payload.titulo ?? '');
    fd.append('descripcion', payload.descripcion ?? '');

    // IMPORTANT: participants como JSON string (porque FormData)
    fd.append('participants', JSON.stringify(payload.participants ?? []));

    // files como attachments[]
    for (const f of files) {
      fd.append('attachments[]', f, f.name);
    }

    return this._httpClient.post<any>(`${this.apiUrl}tasks/store`, fd, { context }).pipe(
      map((resp) => resp?.data ?? resp),
      catchError((err) => {
        console.error('Error al crear task', err);
        return throwError(
          () => new Error(err?.error?.message || err?.message || 'Error desconocido'),
        );
      }),
    );
  }

  getAllUsers(q = '', limit = 200): Observable<SimpleUser[]> {
    let params = new HttpParams().set('q', q).set('limit', String(limit));

    return this._httpClient
      .get<
        { success?: boolean; data?: SimpleUser[] } | SimpleUser[]
      >(`${this.apiUrl}users/all`, { params })
      .pipe(
        map((resp: any) => {
          // soporta ambos formatos: {data:[...]} o [...]
          return Array.isArray(resp) ? resp : (resp?.data ?? []);
        }),
        catchError((err) => {
          console.error('Error cargando usuarios', err);
          return throwError(() => err);
        }),
      );
  }

  userPhoto(u: { photo?: string | null }): string {
    const p = (u.photo || '').trim();
    if (!p) return 'assets/images/avatars/default-avatar.png';

    if (p.startsWith('http://') || p.startsWith('https://')) return p;

    const base = APP_CONFIG.apiBase.replace(/\/$/, '');
    const path = p.startsWith('/') ? p : `/${p}`;
    return `${base}${path}`;
  }

  // private normalizeWorkorderToMail(wo: any): any {
  //   const myEmail = (
  //     (localStorage.getItem('encrypt_user_email') ??
  //       localStorage.getItem('userEmail') ??
  //       localStorage.getItem('email') ??
  //       '') as string
  //   )
  //     .toLowerCase()
  //     .trim();

  //   const participants = Array.isArray(wo?.task_participants) ? wo.task_participants : [];

  //   const byRole = (role: 'receptor' | 'cc' | 'bcc') =>
  //     participants
  //       .filter((p) => p?.role === role)
  //       .sort((a, b) => (a?.orden ?? 0) - (b?.orden ?? 0))
  //       .map((p) => {
  //         const fu = p?.user?.firebird_user;
  //         const name = (fu?.NOMBRE ?? '').trim();
  //         const email = (fu?.CORREO ?? '').trim();
  //         if (myEmail && email && email.toLowerCase().trim() === myEmail) {
  //           return 'me';
  //         }

  //         if (name && email) return `${name} <${email}>`;
  //         return name || email;
  //       })
  //       .filter(Boolean);

  //   const fromFU = wo?.de?.firebird_user;
  //   const fromName = (fromFU?.NOMBRE ?? '').trim();
  //   const fromEmail = (fromFU?.CORREO ?? '').trim();
  //   const photoPath = (fromFU?.PHOTO ?? '').toString();

  //   const toList = wo?.para?.firebird_user
  //     ? (() => {
  //         const fu = wo.para.firebird_user;
  //         const n = (fu?.NOMBRE ?? '').trim();
  //         const e = (fu?.CORREO ?? '').trim();
  //         return [n && e ? `${n} <${e}>` : n || e].filter(Boolean);
  //       })()
  //     : byRole('receptor');

  //   const ccList = byRole('cc');
  //   const bccList = byRole('bcc');

  //   const dateRaw = wo?.fecha_solicitud ?? wo?.created_at ?? wo?.updated_at;

  //   const attachments = (wo?.attachments ?? []).map((a: any) => ({
  //     id: a.id,
  //     name: a.original_name,
  //     type: a.mime_type,
  //     size: a.size,
  //     path: a.path,
  //     preview: a.preview,
  //   }));

  //   const mailboxItems =
  //     (Array.isArray(wo?.mailbox_items) && wo.mailbox_items) ||
  //     (Array.isArray(wo?.mailboxItems) && wo.mailboxItems) ||
  //     [];

  //   const mi0 = mailboxItems?.[0] ?? null;

  //   // deriva flags a formato “Mail” para que UI pinte igual
  //   const destacados = mi0 ? !!mi0.is_starred : !!wo.destacados;
  //   const importantes = mi0 ? !!mi0.is_important : !!wo.importantes;
  //   const unread = mi0 ? !mi0.read_at : typeof wo.unread === 'boolean' ? wo.unread : false;

  //   return {
  //     ...wo,

  //     mailbox_items: mailboxItems,

  //     destacados,
  //     importantes,
  //     unread,

  //     from: {
  //       contact: fromName && fromEmail ? `${fromName} <${fromEmail}>` : fromName || fromEmail,
  //       avatar: this.userPhoto({ photo: photoPath }),
  //     },
  //     to: toList,
  //     cc: ccList,
  //     bcc: bccList,
  //     date: dateRaw ? new Date(dateRaw) : null,

  //     Asunto: wo?.titulo ?? wo?.Asunto ?? '(Sin asunto)',
  //     ccCount: ccList.length,
  //     bccCount: bccList.length,

  //     attachments,
  //   };
  // }

  private normalizeWorkorderToMail(wo: any): any {
    const myEmail = (
      (localStorage.getItem('encrypt_user_email') ??
        localStorage.getItem('userEmail') ??
        localStorage.getItem('email') ??
        '') as string
    )
      .toLowerCase()
      .trim();

    const participants = Array.isArray(wo?.task_participants) ? wo.task_participants : [];

    const byRole = (role: 'receptor' | 'cc' | 'bcc') =>
      participants
        .filter((p) => p?.role === role)
        .sort((a, b) => (a?.orden ?? 0) - (b?.orden ?? 0))
        .map((p) => {
          const fu = p?.user?.firebird_user;
          const name = (fu?.NOMBRE ?? '').trim();
          const email = (fu?.CORREO ?? '').trim();

          if (myEmail && email && email.toLowerCase().trim() === myEmail) {
            return 'me';
          }

          if (name && email) return `${name} <${email}>`;
          return name || email;
        })
        .filter(Boolean);

    const fromFU = wo?.de?.firebird_user;
    const fromName = (fromFU?.NOMBRE ?? '').trim();
    const fromEmail = (fromFU?.CORREO ?? '').trim();
    const photoPath = (fromFU?.PHOTO ?? '').toString();

    const toList = wo?.para?.firebird_user
      ? (() => {
          const fu = wo.para.firebird_user;
          const n = (fu?.NOMBRE ?? '').trim();
          const e = (fu?.CORREO ?? '').trim();
          return [n && e ? `${n} <${e}>` : n || e].filter(Boolean);
        })()
      : byRole('receptor');

    const ccList = byRole('cc');
    const bccList = byRole('bcc');

    const dateRaw = wo?.fecha_solicitud ?? wo?.created_at ?? wo?.updated_at;

    // 👇 FILTRAR SOLO ATTACHMENTS DEL MAIL PRINCIPAL (sin reply_id)
    const attachments = (wo?.attachments ?? [])
      .filter((a: any) => !a.reply_id) // 👈 IMPORTANTE
      .map((a: any) => ({
        id: a.id,
        name: a.original_name,
        type: a.mime_type,
        size: a.size,
        path: a.path,
        preview: a.preview,
      }));

    // 👇 NORMALIZAR REPLIES (con sus attachments)
    const replies = (wo?.replies ?? []).map((reply: any) => ({
      ...reply,
      attachments: (reply?.attachments ?? []).map((a: any) => ({
        id: a.id,
        name: a.original_name,
        original_name: a.original_name, // 👈 AGREGAR ESTO
        type: a.mime_type,
        size: a.size,
        path: a.path,
        preview: a.preview,
      })),
    }));

    const mailboxItems =
      (Array.isArray(wo?.mailbox_items) && wo.mailbox_items) ||
      (Array.isArray(wo?.mailboxItems) && wo.mailboxItems) ||
      [];

    const mi0 = mailboxItems?.[0] ?? null;

    const destacados = mi0 ? !!mi0.is_starred : !!wo.destacados;
    const importantes = mi0 ? !!mi0.is_important : !!wo.importantes;
    const unread = mi0 ? !mi0.read_at : typeof wo.unread === 'boolean' ? wo.unread : false;

    return {
      ...wo,

      mailbox_items: mailboxItems,

      destacados,
      importantes,
      unread,

      from: {
        contact: fromName && fromEmail ? `${fromName} <${fromEmail}>` : fromName || fromEmail,
        avatar: this.userPhoto({ photo: photoPath }),
      },
      to: toList,
      cc: ccList,
      bcc: bccList,
      date: dateRaw ? new Date(dateRaw) : null,

      Asunto: wo?.titulo ?? wo?.Asunto ?? '(Sin asunto)',
      ccCount: ccList.length,
      bccCount: bccList.length,

      attachments, // 👈 SOLO LOS DEL MAIL PRINCIPAL
      replies, // 👈 REPLIES NORMALIZADAS CON SUS ATTACHMENTS
    };
  }

  getMyEmail(): string {
    // 1) si ya lo tienes en algún lado
    const e1 = (this as any)?.currentUserEmail;
    if (typeof e1 === 'string' && e1.trim()) return e1.toLowerCase().trim();

    // 2) fallback: usa lo que ya guardas en localStorage (si guardas algo)
    const e2 = (
      localStorage.getItem('userEmail') ??
      localStorage.getItem('email') ??
      localStorage.getItem('correo') ??
      ''
    )
      .toLowerCase()
      .trim();

    return e2;
  }

  createDraft(payload: CreateTaskPayload, files: File[] = [], silent = false): Observable<any> {
    const context = new HttpContext().set(SILENT_HTTP, silent);

    const fd = new FormData();
    fd.append('de_id', String(payload.de_id));
    fd.append('para_id', payload.para_id == null ? '' : String(payload.para_id));
    fd.append('status_id', payload.status_id == null ? '' : String(payload.status_id));
    fd.append('titulo', payload.titulo ?? '');
    fd.append('descripcion', payload.descripcion ?? '');
    fd.append('participants', JSON.stringify(payload.participants ?? []));

    for (const f of files) fd.append('attachments[]', f, f.name);

    // 👇 endpoint nuevo para draft
    return this._httpClient.post<any>(`${this.apiUrl}mailbox/drafts/store`, fd, { context }).pipe(
      map((resp) => resp?.data ?? resp),
      catchError((err) => throwError(() => err)),
    );
  }

  private getMailboxItemId(mail: any): number | null {
    return mail?.mailbox_items?.[0]?.id ?? mail?.mailboxItems?.[0]?.id ?? null;
  }

  private getWorkorderId(mail: any): number {
    return Number(mail?.id);
  }

  /**
   * RESPUESTAS (REPLY)
   */
  // replyToMail(payload: any, files: File[] = []) {
  //   const formData = new FormData();

  //   Object.keys(payload).forEach((key) => {
  //     if (payload[key] !== null && payload[key] !== undefined) {
  //       formData.append(key, payload[key]);
  //     }
  //   });

  //   files.forEach((file) => {
  //     formData.append('attachments[]', file);
  //   });

  //   return this._httpClient.post<any>(`${this.apiUrl}mailbox/reply`, formData).pipe(
  //     map((resp) => resp?.data ?? resp),
  //     tap((workorder) => {
  //       // 👇 ACTUALIZAR EL MAIL ACTUAL CON LAS REPLIES
  //       const currentMails = this._mails.value || [];
  //       const index = currentMails.findIndex((m) => m.id === workorder.id);

  //       if (index !== -1) {
  //         currentMails[index] = this.normalizeWorkorderToMail(workorder);
  //         this._mails.next([...currentMails]);
  //       }

  //       // Actualizar el mail individual
  //       if (this._mail.value?.id === workorder.id) {
  //         this._mail.next(this.normalizeWorkorderToMail(workorder));
  //       }
  //     }),
  //   );
  // }

  /**
   * RESPUESTAS (REPLY)
   */
  replyToMail(payload: any, files: File[] = []) {
    const formData = new FormData();

    Object.keys(payload).forEach((key) => {
      if (payload[key] !== null && payload[key] !== undefined) {
        formData.append(key, payload[key]);
      }
    });

    files.forEach((file) => {
      formData.append('attachments[]', file);
    });

    return this._httpClient.post<any>(`${this.apiUrl}mailbox/reply`, formData).pipe(
      map((resp) => resp?.data ?? resp),
      map((workorder) => {
        // 👇 NORMALIZAR EL WORKORDER ANTES DE DEVOLVERLO
        return this.normalizeWorkorderToMail(workorder);
      }),
      tap((normalizedWorkorder) => {
        // 👇 ACTUALIZAR LA LISTA DE MAILS
        const currentMails = this._mails.value || [];
        const index = currentMails.findIndex((m) => m.id === normalizedWorkorder.id);

        if (index !== -1) {
          currentMails[index] = normalizedWorkorder;
          this._mails.next([...currentMails]);
        }

        // 👇 ACTUALIZAR EL MAIL INDIVIDUAL
        if (this._mail.value?.id === normalizedWorkorder.id) {
          this._mail.next(normalizedWorkorder);
        }
      }),
    );
  }

  /**
   * WEBSOCKET
   */

  // ========================================
  // AGREGAR ESTOS MÉTODOS A TU MailboxService
  // ========================================

  /**
   * ✅ Agregar nuevo correo al principio de la lista (llamado desde WebSocket)
   */
  prependMail(newMail: any): void {
    const currentMails = this._mails.value || [];

    // Verificar que no exista ya
    const exists = currentMails.some((m) => m.id === newMail.id);
    if (exists) {

      return;
    }

    // Normalizar el workorder a formato Mail
    const normalizedMail = this.normalizeWorkorderToMail(newMail);

    // Agregar al principio
    const updatedMails = [normalizedMail, ...currentMails];
    this._mails.next(updatedMails);

    // Actualizar paginación
    const currentPagination = this._pagination.value;
    if (currentPagination) {
      this._pagination.next({
        ...currentPagination,
        length: currentPagination.length + 1,
      });
    }

  }

  /**
   * ✅ Actualizar correo existente en la lista (llamado desde WebSocket)
   */
  updateMailInList(workorderId: number, changes: any): void {
    const currentMails = this._mails.value || [];

    const updatedMails = currentMails.map((mail) => {
      if (Number(mail.id) === Number(workorderId)) {
        // Actualizar mailbox_items si los cambios son de estado
        if (mail.mailbox_items?.[0]) {
          const updatedMailboxItems = [
            {
              ...mail.mailbox_items[0],
              ...changes,
            },
          ];

          return {
            ...mail,
            mailbox_items: updatedMailboxItems,
            // También actualizar campos de nivel superior
            destacados: changes.is_starred ?? mail.destacados,
            importantes: changes.is_important ?? mail.importantes,
            unread: changes.read_at ? false : changes.read_at === null ? true : mail.unread,
          };
        }

        return { ...mail, ...changes };
      }
      return mail;
    });

    this._mails.next(updatedMails);

    // También actualizar el mail individual si está abierto
    const currentMail = this._mail.value;
    if (currentMail && Number(currentMail.id) === Number(workorderId)) {
      if (currentMail.mailbox_items?.[0]) {
        const updatedMailboxItems = [
          {
            ...currentMail.mailbox_items[0],
            ...changes,
          },
        ];

        this._mail.next({
          ...currentMail,
          mailbox_items: updatedMailboxItems,
          destacados: changes.is_starred ?? currentMail.destacados,
          importantes: changes.is_important ?? currentMail.importantes,
          unread: changes.read_at ? false : changes.read_at === null ? true : currentMail.unread,
        });
      } else {
        this._mail.next({ ...currentMail, ...changes });
      }
    }


  }

  /**
   * ✅ Agregar respuesta a un correo (llamado desde WebSocket)
   */
  addReplyToMail(workorderId: number, replyData: any): void {
    const currentMails = this._mails.value || [];

    const updatedMails = currentMails.map((mail) => {
      if (Number(mail.id) === Number(workorderId)) {
        const replies = mail.replies || [];

        // Verificar que no exista ya
        const replyExists = replies.some((r: any) => r.id === replyData.id);
        if (replyExists) {
          return mail;
        }

        return {
          ...mail,
          replies: [...replies, replyData],
        };
      }
      return mail;
    });

    this._mails.next(updatedMails);

    // También actualizar el mail individual si está abierto
    const currentMail = this._mail.value;
    if (currentMail && Number(currentMail.id) === Number(workorderId)) {
      const replies = currentMail.replies || [];
      const replyExists = replies.some((r: any) => r.id === replyData.id);

      if (!replyExists) {
        this._mail.next({
          ...currentMail,
          replies: [...replies, replyData],
        });
      }
    }

  }

  /**
   * ✅ Refrescar carpeta actual (útil para debugging)
   */
  refreshCurrentFolder(): void {
    const category = this._category.value;

    if (!category) {
      console.warn('⚠️ No hay carpeta activa para refrescar');
      return;
    }



    if (category.type === 'folder') {
      this.getMailsByFolder(category.name).subscribe();
    } else if (category.type === 'filter') {
      this.getMailsByCustomFilter(category.name as any).subscribe();
    }
  }
}
