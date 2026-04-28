import { DatePipe, NgClass } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink, RouterOutlet } from '@angular/router';

import { Subject, takeUntil } from 'rxjs';
import { MailboxComponent } from '../mailbox.component';
import { MailboxService } from '../mailbox.service';
import { MailCategory } from '../mailbox.types';

@Component({
  selector: 'mailbox-list',
  templateUrl: './list.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    MatProgressBarModule,
    NgClass,
    RouterOutlet,
    DatePipe,
  ],
})
export class MailboxListComponent implements OnInit, OnDestroy {
  @ViewChild('mailList') mailList: ElementRef;
  myUserId: number | null = null;
  category: MailCategory;
  mails: any[]; // Cambiado de Mail[] a any[] para aceptar WorkOrders
  mailsLoading: boolean = false;
  pagination: any;
  selectedMail: any;
  myEmail: string = '';
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  /**
   * Constructor
   */
  constructor(
    public mailboxComponent: MailboxComponent,
    private _mailboxService: MailboxService,
  ) {}

  // -----------------------------------------------------------------------------------------------------
  // @ Lifecycle hooks
  // -----------------------------------------------------------------------------------------------------

  /**
   * On init
   */
  ngOnInit(): void {
    try {
      const token = localStorage.getItem('encrypt') ?? '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.myUserId = payload.sub; // 989
    } catch (e) {
      this.myUserId = null;
    }
    this.myEmail = (
      localStorage.getItem('encrypt_user_email') ??
      localStorage.getItem('userEmail') ??
      localStorage.getItem('email') ??
      ''
    )
      .toLowerCase()
      .trim();

    this._mailboxService.mailsUpdated$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((shouldReload) => {
        if (shouldReload && this.category) {
          // Recargar la categoría actual
          this._mailboxService.refreshCurrentFolder();
        }
      });

    // Category
    this._mailboxService.category$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((category: MailCategory) => {
        this.category = category;
      });

    // Mails
    this._mailboxService.mails$.pipe(takeUntil(this._unsubscribeAll)).subscribe((mails: any[]) => {
      this.mails = (mails ?? []).map((m) => ({
        ...m,
        _mailDate: m.date ?? m.created_at ?? m.updated_at ?? null,
      }));
    });

    // Mails loading
    this._mailboxService.mailsLoading$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((mailsLoading: boolean) => {
        this.mailsLoading = mailsLoading;
        if (this.mailList && !mailsLoading) {
          this.mailList.nativeElement.scrollTo(0, 0);
        }
      });

    // Pagination
    this._mailboxService.pagination$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((pagination) => {
        this.pagination = pagination;
      });

    // Selected mail
    this._mailboxService.mail$.pipe(takeUntil(this._unsubscribeAll)).subscribe((mail: any) => {
      this.selectedMail = mail;
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
   * Get sender name from mail/workorder
   */
  getSenderName(mail: any): string {
    if (mail.from?.contact) {
      return mail.from.contact.split('<')[0].trim();
    }

    const nombre = mail.de?.firebird_user?.NOMBRE;
    if (nombre) return nombre;

    return 'Sistema';
  }

  /**
   * Get subject from mail/workorder
   */
  getSubject(mail: any): string {
    return mail.Asunto || mail.titulo || '(Sin asunto)';
  }

  /**
   * Get content from mail/workorder
   */
  getContent(mail: any): string {
    return mail.content || mail.descripcion || '';
  }

  /**
   * Check if mail is unread
   */
  isUnread(mail: any): boolean {
    // Si tiene estructura Mail
    if (typeof mail.unread === 'boolean') {
      return mail.unread;
    }

    // Si es WorkOrder con mailbox_items
    const mailboxItem = mail.mailbox_items?.[0];
    return !mailboxItem?.read_at;
  }

  /**
   * Check if mail is important
   */
  isImportant(mail: any): boolean {
    if (typeof mail.importantes === 'boolean') {
      return mail.importantes;
    }

    const mailboxItem = mail.mailbox_items?.[0];
    return !!mailboxItem?.is_important;
  }

  /**
   * Check if mail is starred
   */
  isStarred(mail: any): boolean {
    if (typeof mail.destacados === 'boolean') {
      return mail.destacados;
    }

    const mailboxItem = mail.mailbox_items?.[0];
    return !!mailboxItem?.is_starred;
  }

  /**
   * Get attachments count
   */
  hasAttachments(mail: any): boolean {
    return (mail.attachments?.length || 0) > 0;
  }

  /**
   * Get mail date
   */
  getMailDate(mail: any): Date | null {
    const raw = mail?.fecha_solicitud ?? mail?.date ?? mail?.created_at ?? mail?.updated_at ?? null;

    if (!raw) return null;

    //  si viene "YYYY-MM-DD HH:mm:ss" lo convertimos a ISO local "YYYY-MM-DDTHH:mm:ss"
    if (typeof raw === 'string' && raw.includes(' ') && !raw.includes('T')) {
      return new Date(raw.replace(' ', 'T'));
    }

    return new Date(raw);
  }

  /**
   * On mail selected
   *
   * @param mail
   */
  onMailSelected(mail: any): void {
    if (this.isUnread(mail)) {
      // 1) Marca localmente como leído (UI)
      if (mail.mailbox_items?.[0]) {
        mail.mailbox_items[0].read_at = new Date().toISOString();

        // 2) Llama backend con el ID correcto (MailboxItem.id)
        const mailboxItemId = mail.mailbox_items[0].id;
        this._mailboxService.markRead(mailboxItemId, true).subscribe();
      }
    }

    this._mailboxService.selectedMailChanged.next(mail);
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

  /**
   * Check if current user is the receiver (not the sender)
   */
  isReceiver(mail: any): boolean {
    const folderName = (this.category?.name ?? '').toLowerCase();
    const sentFolders = ['enviados', 'sent', 'borradores', 'drafts'];

    if (sentFolders.some((f) => folderName.includes(f))) return false;
    if ((mail.mailbox_items?.length ?? 0) > 0) return true;
    if (!this.myUserId) return false;

    return (mail.task_participants ?? []).some(
      (p: any) =>
        p.role === 'receptor' && Number(p?.user?.firebird_user_clave) === Number(this.myUserId),
    );
  }

  getStatusTextClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'asignada':
        return 'text-cyan-500';
      case 'en proceso':
        return 'text-orange-500';
      case 'devuelto':
        return 'text-yellow-500';
      case 'finalizado':
        return 'text-green-500';
      case 'cancelado':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  }

  getParticipants(mail: any): any[] {
    return (mail.participants ?? []).filter((p) => p.type !== 'emisor');
  }

  iniciarTicket(event: Event, mail: any): void {
    event.stopPropagation();
    event.preventDefault();

    this._mailboxService.iniciarTicket(mail).subscribe({
      error: (err) => console.error('Error', err),
    });
  }

  finalizarTicket(event: Event, mail: any): void {
    event.stopPropagation();
    event.preventDefault();

    this._mailboxService.finalizarTicket(mail).subscribe({
      error: (err) => console.error('Error', err),
    });
  }


  getRecipientRole(mail: any): 'cc' | 'bcc' | null {
  if (!this.myUserId) return null;

  const isCc = (mail.task_participants ?? []).some(
    (p: any) =>
      p.role === 'cc' && Number(p?.user?.firebird_user_clave) === Number(this.myUserId),
  );
  const isBcc = (mail.task_participants ?? []).some(
    (p: any) =>
      p.role === 'bcc' && Number(p?.user?.firebird_user_clave) === Number(this.myUserId),
  );

  if (isBcc) return 'bcc';
  if (isCc) return 'cc';
  return null;
}
}
