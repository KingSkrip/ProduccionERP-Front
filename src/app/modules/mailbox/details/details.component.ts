import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FuseScrollResetDirective } from '@fuse/directives/scroll-reset';

import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { APP_CONFIG } from 'app/core/config/app-config';
import { UserService } from 'app/core/user/user.service';
import { Subject, takeUntil } from 'rxjs';
import { labelColorDefs } from '../mailbox.constants';
import { MailboxService } from '../mailbox.service';
import { MailFolder, MailLabel } from '../mailbox.types';

@Component({
  selector: 'mailbox-details',
  templateUrl: './details.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MatButtonModule,
    RouterLink,
    MatIconModule,
    MatMenuModule,
    MatRippleModule,
    MatCheckboxModule,
    FuseScrollResetDirective,
    MatFormFieldModule,
    MatInputModule,
    DecimalPipe,
    DatePipe,
    OverlayModule,
    FormsModule,
    MatTooltipModule,
    CommonModule,
    MatMenuModule,
  ],
})
export class MailboxDetailsComponent implements OnInit, OnDestroy {
  @ViewChild('infoDetailsPanelOrigin')
  private _infoDetailsPanelOrigin: MatButton;
  @ViewChild('attachmentViewer')
  private _attachmentViewer: TemplateRef<any>;
  @ViewChild('infoDetailsPanel')
  private _infoDetailsPanel: TemplateRef<any>;
  currentUserId: number | null = null;
  @ViewChild('replyFileInput') replyFileInput: any;
  private _participantsCache: { id: number; result: any[] } | null = null;
  replyingTo: { id: number; author: string; body: string } | null = null;
  mail: any;
  labelColors: any;
  labels: MailLabel[];
  folders: MailFolder[];
  replyText: string = '';
  replyAttachments: File[] = [];
  private _overlayRef: OverlayRef;
  replyFormActive: boolean = false;
  replyType: 'reply' | 'reply_all' = 'reply';
  replyPreviewMap = new Map<string, string>();
  apiBase = APP_CONFIG.apiBase;
  private readonly PARTICIPANT_COLORS = [
    { bg: '#F4C0D1', text: '#72243E' },
    { bg: '#FDE68A', text: '#92400E' },
    { bg: '#C4B5FD', text: '#4C1D95' },
    { bg: '#A7F3D0', text: '#065F46' },
    { bg: '#FED7AA', text: '#9A3412' },
    { bg: '#BAE6FD', text: '#0C4A6E' },
  ];
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  avatarUrl: string = '';
  composeAttachments: {
    file: File;
    preview?: string;
    type: string;
    name: string;
    size: number;
  }[] = [];

  /**
   * Constructor
   */
  constructor(
    private _activatedRoute: ActivatedRoute,
    private _elementRef: ElementRef,
    private _mailboxService: MailboxService,
    private _overlay: Overlay,
    private _router: Router,
    private _viewContainerRef: ViewContainerRef,
    private _userService: UserService,
    private _sanitizer: DomSanitizer,
  ) {}

  // -----------------------------------------------------------------------------------------------------
  // @ Lifecycle hooks
  // -----------------------------------------------------------------------------------------------------

  /**
   * On init
   */
  ngOnInit(): void {
    this.currentUserId = this._myIdentityId();

    this._mailboxService.mailsUpdated$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((shouldReload) => {
        if (shouldReload && this.mail?.id) {
          this._mailboxService
            .getMailByIdFromApi(this.mail.id)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((updatedMail) => {
              this.mail = updatedMail;
            });
        }
      });

    // Get the Color de etiquetas
    this.labelColors = labelColorDefs;

    // Folders
    this._mailboxService.folders$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((folders: MailFolder[]) => {
        this.folders = folders;
      });

    // Labels
    this._mailboxService.labels$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((labels: MailLabel[]) => {
        this.labels = labels;
      });

   this._mailboxService.mail$.pipe(takeUntil(this._unsubscribeAll)).subscribe((mail) => {
  this._participantsCache = null;
  this.mail = mail;
  this.avatarUrl = this.buildAvatar(mail);
});

    this._mailboxService.selectedMailChanged.pipe(takeUntil(this._unsubscribeAll)).subscribe(() => {
      this.replyFormActive = false;
    });
  }

  /**
   * On destroy
   */
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Public methods
  // -----------------------------------------------------------------------------------------------------

  /**
   * Get the current folder
   */
  getCurrentFolder(): any {
    return this._activatedRoute.snapshot.paramMap.get('folder');
  }

  /**
   * Move to folder
   *
   * @param folderSlug
   */
  moveToFolder(folderSlug: string): void {
    const folderMap: Record<string, string> = {
      mensajes: 'general',
      eliminados: 'eliminados',
      spam: 'spam',
      borradores: 'drafts',
    };

    const apiFolder = folderMap[folderSlug] || folderSlug;

    // Actualizar UI inmediatamente
    this.mail.folder = apiFolder;

    //  NUEVO: delega al service que ya sabe si usar mailboxItemId o workorderId
    this._mailboxService.moveTo(this.mail, apiFolder as any).subscribe({
      next: () => {
        this._router.navigate(['./'], { relativeTo: this._activatedRoute.parent });
      },
      error: (err) => {
        console.error('Error moviendo correo:', err);
      },
    });
  }

  /**
   * Toggle label
   *
   * @param label
   */
  toggleLabel(label: MailLabel): void {
    this._ensureLabelsArray();

    let deleted = false;

    if (this.mail.labels.includes(label.id)) {
      deleted = true;
      this.mail.labels.splice(this.mail.labels.indexOf(label.id), 1);
    } else {
      this.mail.labels.push(label.id);
    }

    this._mailboxService.updateMail(this.mail.id, { labels: this.mail.labels }).subscribe();
    if (deleted) {
      if (
        this._activatedRoute.snapshot.paramMap.get('label') &&
        this._activatedRoute.snapshot.paramMap.get('label') === label.slug
      ) {
        this._router.navigate(['./'], {
          relativeTo: this._activatedRoute.parent,
        });
      }
    }
  }

  /**
   * Toggle importantes
   */
toggleimportantes(): void {
  this.mail.importantes = !this.mail.importantes;
  this._mailboxService.toggleImportant(this.mail).subscribe();
}

toggleStar(): void {
  this.mail.destacados = !this.mail.destacados;
  this._mailboxService.toggleStar(this.mail).subscribe();
}

  /**
   * Toggle unread
   *
   * @param unread
   */
  toggleUnread(unread: boolean): void {
    this.mail.unread = unread;
    // unread=true => is_read=false
    this._mailboxService.markRead(this.mail, !unread).subscribe();
  }

  /**
   * RESPUESTAS (REPLY)
   */

  attachReplyFile(): void {
    this.replyFileInput.nativeElement.click();
  }

  onReplyFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files?.length) {
      this.addReplyFiles(Array.from(input.files));
    }

    input.value = '';
  }

  onReplyDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  onReplyDrop(ev: DragEvent): void {
    ev.preventDefault();
    const files = Array.from(ev.dataTransfer?.files || []);
    if (files.length) this.addReplyFiles(files);
  }

  private addReplyFiles(files: File[]): void {
    const existing = new Set(
      this.replyAttachments.map((f) => `${f.name}-${f.size}-${f.lastModified}`),
    );

    const incoming = files.filter((f) => !existing.has(`${f.name}-${f.size}-${f.lastModified}`));

    if (!incoming.length) return;

    this.replyAttachments.push(...incoming);
  }

  replyFileKey(f: File): string {
    return `${f.name}-${f.size}-${f.lastModified}`;
  }

  replyFilePreview(file: File): string {
    const key = this.replyFileKey(file);

    if (!this.replyPreviewMap.has(key)) {
      this.replyPreviewMap.set(key, URL.createObjectURL(file));
    }

    return this.replyPreviewMap.get(key)!;
  }

  removeReplyFile(file: File): void {
    const key = this.replyFileKey(file);

    const url = this.replyPreviewMap.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      this.replyPreviewMap.delete(key);
    }

    this.replyAttachments = this.replyAttachments.filter((f) => f !== file);
  }

  /**
   * Reply
   */
  // reply(): void {
  //   this.replyFormActive = true;
  //   setTimeout(() => {
  //     this._elementRef.nativeElement.scrollTop = this._elementRef.nativeElement.scrollHeight;
  //   });
  // }
  buildAvatar(mail: any): string {
    const photo = mail?.de?.firebirdUser?.photo;

    if (!photo) {
      return '';
    }

    return this.apiBase + photo;
  }

  reply(): void {
    this.replyType = 'reply';
    this.replyFormActive = true;
    this._scrollBottom();
  }

  /**
   * Responder a todos
   */
  // replyAll(): void {
  //   this.replyFormActive = true;
  //   setTimeout(() => {
  //     this._elementRef.nativeElement.scrollTop = this._elementRef.nativeElement.scrollHeight;
  //   });
  // }

  replyAll(): void {
    this.replyType = 'reply_all';
    this.replyFormActive = true;
    this._scrollBottom();
  }

  private _scrollBottom(): void {
    setTimeout(() => {
      this._elementRef.nativeElement.scrollTop = this._elementRef.nativeElement.scrollHeight;
    });
  }

  /**
   * Reenviar
   */
  Reenviar(): void {
    this.replyFormActive = true;
    setTimeout(() => {
      this._elementRef.nativeElement.scrollTop = this._elementRef.nativeElement.scrollHeight;
    });
  }

  /**
   * Discard
   */
  discard(): void {
    this.replyFormActive = false;
  }

  /**
   * Send
   */
  send(): void {
    if (!this.replyText.trim() && !this.replyAttachments.length) return;

    const payload = {
      workorder_id: this.mail.id,
      reply_type: this.replyType,
      reply_to_id: this.replyingTo?.id ?? this.getLastReplyId(),
      body: this.replyText,
    };

    this._mailboxService.replyToMail(payload, this.replyAttachments).subscribe({
      next: (updatedWorkorder) => {
        // Actualizar el mail actual con las replies
        this.mail = updatedWorkorder;

        // Limpiar formulario
        this.replyText = '';
        this.replyAttachments = [];
        this.replyFormActive = false;

        // Scroll para ver la nueva respuesta
        setTimeout(() => {
          this._elementRef.nativeElement.scrollTop = this._elementRef.nativeElement.scrollHeight;
        }, 100);
      },
      error: (err) => console.error('Error enviando reply', err),
    });
  }

  getLastReplyId(): number | null {
    if (!this.mail?.replies?.length) return null;
    return this.mail.replies[this.mail.replies.length - 1].id;
  }

  /**
   * Open info details panel
   */
  openInfoDetailsPanel(): void {
    this._overlayRef = this._overlay.create({
      backdropClass: '',
      hasBackdrop: true,
      scrollStrategy: this._overlay.scrollStrategies.block(),
      positionStrategy: this._overlay
        .position()
        .flexibleConnectedTo(this._infoDetailsPanelOrigin._elementRef.nativeElement)
        .withFlexibleDimensions(true)
        .withViewportMargin(16)
        .withLockedPosition(true)
        .withPositions([
          {
            originX: 'start',
            originY: 'bottom',
            overlayX: 'start',
            overlayY: 'top',
          },
          {
            originX: 'start',
            originY: 'top',
            overlayX: 'start',
            overlayY: 'bottom',
          },
          {
            originX: 'end',
            originY: 'bottom',
            overlayX: 'end',
            overlayY: 'top',
          },
          {
            originX: 'end',
            originY: 'top',
            overlayX: 'end',
            overlayY: 'bottom',
          },
        ]),
    });
    const templatePortal = new TemplatePortal(this._infoDetailsPanel, this._viewContainerRef);
    this._overlayRef.attach(templatePortal);
    this._overlayRef.backdropClick().subscribe(() => {
      if (this._overlayRef && this._overlayRef.hasAttached()) {
        this._overlayRef.detach();
      }
      if (templatePortal && templatePortal.isAttached) {
        templatePortal.detach();
      }
    });
  }

  /**
   * Track by function for ngFor loops
   *
   * @param index
   * @param item
   */
  trackByFn(index: number, item: any): any {
    return item.id || index;
  }

  getSubject(m: any) {
    return m?.Asunto || m?.titulo || '(Sin asunto)';
  }
  getContent(m: any) {
    return m?.content || m?.descripcion || '';
  }

  getSenderName(m: any) {
    return (
      m?.from?.contact?.split('<')?.[0]?.trim() ||
      m?.de?.firebird_user?.NOMBRE ||
      m?.de?.firebirdUser?.NOMBRE ||
      'Sistema'
    );
  }

  getAvatar(m: any) {
    const photo =
      m?.from?.photo ||
      m?.de?.firebirdUser?.PHOTO ||
      m?.de?.firebird_user?.PHOTO ||
      m?.de?.firebirdUser?.photo ||
      m?.de?.firebird_user?.photo;

    return this._mailboxService.userPhoto({ photo });
  }

  isUnread(m: any) {
    if (typeof m?.unread === 'boolean') return m.unread;
    return !m?.mailbox_items?.[0]?.read_at;
  }

  private _ensureLabelsArray(): void {
    if (!Array.isArray(this.mail?.labels)) this.mail.labels = [];
  }

  trackByReplyId(index: number, reply: any): any {
    return reply?.id ?? index;
  }

  trackByAttachmentId(index: number, att: any): any {
    return att?.id ?? index;
  }

  isArray(v: any): v is any[] {
    return Array.isArray(v);
  }

  toText(v: any): string {
    if (Array.isArray(v)) return v.filter(Boolean).join(', ');
    if (typeof v === 'string' && v.trim()) return v;
    return '';
  }

  getAttachmentIcon(a: any): string {
    const type = (a?.type ?? '').toLowerCase();
    const name = (a?.name ?? '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop()! : '';

    // Imágenes
    if (
      type.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)
    ) {
      return 'heroicons_outline:photo';
    }

    // PDF
    if (type === 'application/pdf' || ext === 'pdf') {
      return 'heroicons_outline:document-text';
    }

    // Word / Docs
    if (['doc', 'docx'].includes(ext) || type.includes('word')) {
      return 'heroicons_outline:document-text';
    }

    // Excel / Sheets
    if (['xls', 'xlsx', 'csv'].includes(ext) || type.includes('spreadsheet')) {
      return 'heroicons_outline:table-cells';
    }

    // PowerPoint
    if (['ppt', 'pptx'].includes(ext) || type.includes('presentation')) {
      return 'heroicons_outline:presentation-chart-bar';
    }

    // Zip / Rar
    if (
      ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) ||
      type.includes('zip') ||
      type.includes('compressed')
    ) {
      return 'heroicons_outline:archive-box';
    }

    // Audio / Video
    if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
      return 'heroicons_outline:musical-note';
    }
    if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
      return 'heroicons_outline:film';
    }
    return 'heroicons_outline:document';
  }

  getToSummary(mail: any): string {
    if (this._isSentLike(mail)) {
      const toList = this._normalizeList(mail?.to);
      return toList[0] ?? 'Sin destinatario';
    }
    if (this._iAmRecipient(mail)) return 'mí';
    const toList = this._normalizeList(mail?.to);
    return toList[0] ?? 'mí';
  }

  private _normalizeList(v: any): string[] {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'string' && v.trim()) return [v.trim()];
    return [];
  }

  private _getFolderSlugById(id: any): string | null {
    const f = this.folders?.find((x) => x.id === id);
    return f?.slug ?? null;
  }

  private _isSentView(mail?: any): boolean {
    const routeSlug = this.getCurrentFolder(); // lo que viene en la URL
    const mailSlug = this._getFolderSlugById(mail?.folder); // lo que trae el mail
    const slug = (routeSlug || mailSlug || '').toLowerCase();

    return ['enviados', 'sent', 'salida', 'outbox', 'drafts', 'borradores'].includes(slug);
  }

  private _extractEmail(v: any): string {
    const s = typeof v === 'string' ? v : (v?.email ?? v?.address ?? v?.contact ?? v?.from ?? '');

    const m = String(s).match(/<([^>]+)>/);
    return (m?.[1] ?? s ?? '').toLowerCase().trim();
  }

  private _isFromMe(mail?: any): boolean {
    const myEmail =
      (this._mailboxService as any)?.currentUserEmail?.toLowerCase?.() ||
      (this._mailboxService as any)?.meEmail?.toLowerCase?.() ||
      (localStorage.getItem('userEmail') ?? '').toLowerCase();

    if (!myEmail) return false;

    const fromEmail = this._extractEmail(mail?.from ?? mail?.de);
    return !!fromEmail && fromEmail === myEmail;
  }

  private _isSentLike(mail?: any): boolean {
    const routeSlug = this.getCurrentFolder();
    const mailSlug = this._getFolderSlugById(mail?.folder);
    const slug = (routeSlug || mailSlug || '').toLowerCase();
    const byFolder = ['enviados', 'sent', 'salida', 'outbox'].includes(slug);
    return byFolder || this._isFromMe(mail);
  }

  getToPrimary(mail: any): string {
    if (this._isSentLike(mail)) {
      const toList = this._normalizeList(mail?.to);
      return toList[0] ?? 'Sin destinatario';
    }
    return 'mí';
  }

  getOtherRecipientsCount(mail: any): number {
    if (this._isSentLike(mail)) {
      const toList = this._normalizeList(mail?.to);
      const toOthers = Math.max(0, toList.length - 1);
      const cc = Number(mail?.ccCount ?? mail?.cc?.length ?? 0);
      const bcc = Number(mail?.bccCount ?? mail?.bcc?.length ?? 0);
      return toOthers + cc + bcc;
    }

    if (this._iAmRecipient(mail)) {
      return this._otherRecipientsCountExcludingMe(mail);
    }

    return 0;
  }

  private _myIdentityId(): number | null {
    try {
      const token = localStorage.getItem('encrypt') ?? '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub ? Number(payload.sub) : null;
    } catch {
      const me: any = this._userService.user;
      const id = me?.identity_id ?? me?.id;
      return id ? Number(id) : null;
    }
  }

  private _iAmRecipient(mail: any): boolean {
    const myId = this._myIdentityId();
    if (!myId) return false;

    const parts = Array.isArray(mail?.task_participants) ? mail.task_participants : [];
    return parts.some((p: any) => Number(p?.user_id) === myId);
  }

  private _otherRecipientsCountExcludingMe(mail: any): number {
    const myId = this._myIdentityId();
    const parts = Array.isArray(mail?.task_participants) ? mail.task_participants : [];
    const ids = new Set<number>();
    for (const p of parts) {
      const uid = Number(p?.user_id);
      if (!uid) continue;
      ids.add(uid);
    }

    if (!myId) return ids.size;
    ids.delete(myId);
    return ids.size;
  }

  openAttachmentViewer(att: any): void {
    this._overlayRef = this._overlay.create({
      hasBackdrop: true,
      backdropClass: 'bg-black-70',
      panelClass: ['attachment-viewer-panel'],
      scrollStrategy: this._overlay.scrollStrategies.block(),
      positionStrategy: this._overlay.position().global().centerHorizontally().centerVertically(),
    });

    const portal = new TemplatePortal(this._attachmentViewer, this._viewContainerRef, {
      $implicit: att,
    });

    this._overlayRef.attach(portal);

    this._overlayRef.backdropClick().subscribe(() => {
      this.closeAttachmentViewer();
    });
  }

  closeAttachmentViewer(): void {
    if (this._overlayRef) {
      this._overlayRef.dispose();
      this._overlayRef = null!;
    }
  }

  getAttachmentUrl(att: any): string {
    if (att.url) return att.url;

    if (att.preview) {
      return 'images/apps/mailbox/' + att.preview;
    }

    return '';
  }

  // En tu componente details.component.ts, agrega estos métodos:

  isImageAttachment(att: any): boolean {
    const type = (att?.type ?? '').toLowerCase();
    const name = (att?.name ?? '').toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const ext = name.includes('.') ? name.split('.').pop()! : '';

    return type.startsWith('image/') || imageExts.includes(ext);
  }

  isPdfAttachment(att: any): boolean {
    const type = (att?.type ?? '').toLowerCase();
    const name = (att?.name ?? '').toLowerCase();

    return type === 'application/pdf' || name.endsWith('.pdf');
  }

  getSafeAttachmentUrl(att: any): string {
    if (att.url) {
      return att.url;
    }

    if (att.path) {
      const baseUrl = APP_CONFIG.apiBase.replace(/\/$/, '');
      let cleanPath = att.path;
      if (cleanPath.startsWith('public/')) {
        cleanPath = cleanPath.substring(7);
      }

      // 👇 AGREGAR 'workorders/' si no está presente
      if (!cleanPath.startsWith('workorders/')) {
        cleanPath = `workorders/${cleanPath}`;
      }

      const pathParts = cleanPath.split('/').filter(Boolean);
      const encodedPath = pathParts.map((part) => encodeURIComponent(part)).join('/');
      const url = `${baseUrl}/storage/${encodedPath}`;
      return url;
    }

    if (att.preview) {
      return `images/apps/mailbox/${att.preview}`;
    }

    console.error('❌ No URL found for attachment:', att);
    return '';
  }

  getSafePdfUrl(att: any): SafeResourceUrl {
    const url = this.getSafeAttachmentUrl(att);
    return this._sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  onAttachmentError(event: any, att: any): void {
    console.error('Error cargando archivo:', att.name, event);
    // Opcional: mostrar mensaje de error al usuario
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  getReplyAvatar(reply: any): string {
    // Intentar ambas variantes (camelCase y snake_case)
    const photo =
      reply?.user?.firebirdUser?.PHOTO ||
      reply?.user?.firebird_user?.PHOTO ||
      reply?.user?.firebirdUser?.photo ||
      reply?.user?.firebird_user?.photo;

    return this._mailboxService.userPhoto({ photo });
  }

  getReplyAuthor(reply: any): string {
    return reply?.user?.firebirdUser?.NOMBRE || reply?.user?.firebird_user?.NOMBRE || 'Usuario';
  }

  getStatusBadgeClass(status: string): string {
    const map = {
      asignada: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'en proceso': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      finalizado: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cancelado: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      devuelto: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return map[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-500';
  }

  getPriorityBadgeClass(priority: string): string {
    const map = {
      alta: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      media: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      baja: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return map[priority?.toLowerCase()] ?? 'bg-gray-100 text-gray-500';
  }

  isOwnReply(reply: any): boolean {
    const me: any = this._userService.user;
    const myUserId = me?.id ?? me?.user_id;
    return Number(reply?.user_id) === Number(myUserId);
  }

  isOwnMessage(mail: any): boolean {
    const me: any = this._userService.user;
    const myUserId = Number(me?.id ?? me?.user_id);
    // El emisor del mail original está en mail.de_id
    return Number(mail?.de_id) === myUserId;
  }

  isOverdue(mail: any): boolean {
    if (!mail.due_date) return false;
    return new Date(mail.due_date) < new Date();
  }

  getStatusDotClass(status: string): string {
    const map = {
      asignada: 'bg-blue-500',
      'en proceso': 'bg-amber-500',
      finalizado: 'bg-green-500',
      cancelado: 'bg-red-500',
      devuelto: 'bg-yellow-500',
    };
    return map[status?.toLowerCase()] ?? 'bg-gray-400';
  }

  getParticipantColor(p: any): { bg: string; text: string } {
    const name = (p?.name || '').trim();
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [
      { bg: '#E3F2FD', text: '#1E88E5' }, // azul
      { bg: '#E8F5E9', text: '#43A047' }, // verde
      { bg: '#FFF3E0', text: '#FB8C00' }, // naranja
      { bg: '#FCE4EC', text: '#D81B60' }, // rosa
      { bg: '#F3E5F5', text: '#8E24AA' }, // morado
      { bg: '#E0F2F1', text: '#00897B' }, // teal
      { bg: '#FBE9E7', text: '#F4511E' }, // rojo suave
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  getParticipants(
    mail: any,
  ): { name: string; email: string; initials: string; color: { bg: string; text: string } }[] {
    if (this._participantsCache?.id === mail?.id) {
      return this._participantsCache.result;
    }

    const colors = [
      { bg: '#B5D4F4', text: '#0C447C' },
      { bg: '#9FE1CB', text: '#085041' },
      { bg: '#F4C0D1', text: '#72243E' },
      { bg: '#FDE68A', text: '#92400E' },
      { bg: '#C4B5FD', text: '#4C1D95' },
    ];

    const seen = new Set<string>();
    const participants: any[] = [];
    const add = (person: any, idx: number) => {
      const email = person?.contact ?? person?.email ?? person ?? '';
      const name = person?.name ?? email;
      if (!email || seen.has(email)) return;
      seen.add(email);
      const initials = name
        .split(' ')
        .slice(0, 2)
        .map((w: string) => w[0]?.toUpperCase() ?? '')
        .join('');
      participants.push({ name, email, initials, color: colors[idx % colors.length] });
    };
    add(mail.from, 0);
    const allRecipients = [...(mail.to ?? []), ...(mail.cc ?? []), ...(mail.bcc ?? [])];
    allRecipients.forEach((r, i) => add(r, i + 1));
    mail.replies?.forEach((reply: any, i: number) => {
      add(reply.from ?? reply.author, allRecipients.length + i + 1);
    });

    this._participantsCache = { id: mail.id, result: participants };
    return participants;
  }

  getPersonColor(identifier: string): { bg: string; text: string } {
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % this.PARTICIPANT_COLORS.length;
    return this.PARTICIPANT_COLORS[index];
  }

  setReplyTo(reply: any): void {
    this.replyingTo = {
      id: reply.id,
      author: this.getReplyAuthor(reply),
      body: reply.body,
    };
  }

  clearReplyTo(): void {
    this.replyingTo = null;
  }

  onEnterKey(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  getReplyTo(reply: any, replies: any[]) {
    if (!reply.reply_to_id) return null;
    return replies.find((r) => r.id === reply.reply_to_id);
  }

  truncateFileName(name: string, maxLength: number = 20): string {
    if (!name) return '';
    const extIndex = name.lastIndexOf('.');
    if (extIndex === -1) {
      return name.substring(0, maxLength) + '....';
    }
    const namePart = name.substring(0, extIndex);
    const ext = name.substring(extIndex);
    return namePart.substring(0, maxLength) + '....' + ext;
  }

  isReceiver(mail: any): boolean {
    if (!this.currentUserId) return false;
    if ((mail.mailbox_items?.length ?? 0) > 0) return true;
    return (mail?.task_participants ?? []).some(
      (p: any) =>
        p.role === 'receptor' &&
        Number(p?.user?.firebird_user_clave) === Number(this.currentUserId),
    );
  }

  getRecipientRole(mail: any): 'cc' | 'bcc' | null {
    if (!this.currentUserId) return null;
    const match = (p: any) =>
      Number(p?.user_id) === Number(this.currentUserId) ||
      Number(p?.user?.firebird_user_clave) === Number(this.currentUserId);
    const isCc = (mail?.task_participants ?? []).some((p: any) => p.role === 'cc' && match(p));
    const isBcc = (mail?.task_participants ?? []).some((p: any) => p.role === 'bcc' && match(p));
    if (isBcc) return 'bcc';
    if (isCc) return 'cc';
    return null;
  }

  getStatusTextClass(status: string): string {
    const map: Record<string, string> = {
      asignada: 'text-blue-600 dark:text-blue-400',
      'en proceso': 'text-amber-600 dark:text-amber-400',
      finalizado: 'text-green-600 dark:text-green-400',
      cancelado: 'text-red-600 dark:text-red-400',
      devuelto: 'text-yellow-600 dark:text-yellow-400',
    };
    return map[status?.toLowerCase()] ?? 'text-gray-500';
  }

  iniciarTicket(event: Event, mail: any): void {
    event.stopPropagation();
    this._mailboxService.iniciarTicket(mail).subscribe({
      next: (updated) => {
        this._participantsCache = null;
        this.mail = updated;
      },
      error: (err) => console.error(err),
    });
  }

  finalizarTicket(event: Event, mail: any): void {
    event.stopPropagation();
    this._mailboxService.finalizarTicket(mail).subscribe({
      next: (updated) => {
        this._participantsCache = null;
        this.mail = updated;
      },
      error: (err) => console.error(err),
    });
  }
}
