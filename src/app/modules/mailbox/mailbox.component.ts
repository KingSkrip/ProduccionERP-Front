import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { WebsocketService } from 'app/core/services/websockets/websocket.service';
import { UserService } from 'app/core/user/user.service';
import { Subject, takeUntil } from 'rxjs';
import { MailboxService } from './mailbox.service';
import { MailboxSidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'mailbox',
  templateUrl: './mailbox.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [MatSidenavModule, MailboxSidebarComponent, RouterOutlet],
})
export class MailboxComponent implements OnInit, OnDestroy {
  @ViewChild('drawer') drawer: MatDrawer;

  drawerMode: 'over' | 'side' = 'side';
  drawerOpened: boolean = true;
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  constructor(
    private _fuseMediaWatcherService: FuseMediaWatcherService,
    private _userService: UserService,
    private _websocketService: WebsocketService,
    private _mailboxService: MailboxService,
  ) {}

  ngOnInit(): void {
    const user = this._userService.user;

    if (user?.id) {
      const token = localStorage.getItem('encrypt') ?? '';

      this._websocketService.connect(Number(user.id), token);
    }

    // 🔥 PROCESAR EVENTOS WEBSOCKET
    this._websocketService
      .getMessages()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((msg) => {
        if (!msg) return;

        switch (msg.type) {
          case 'workorder.created':
            // Recargar la lista de correos
            this._mailboxService.reloadMails();
            break;

          case 'mail.reply.created':
            // Actualizar el mail actual si está abierto
            this._mailboxService.reloadMails();
            break;

          case 'mailbox.updated':
            // Actualizar el estado del item
            this._mailboxService.reloadMails();
            break;
        }
      });

    this._fuseMediaWatcherService.onMediaChange$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(({ matchingAliases }) => {
        this.drawerMode = matchingAliases.includes('md') ? 'side' : 'over';
        this.drawerOpened = matchingAliases.includes('md');
      });
  }

  ngOnDestroy(): void {
    //  desconectar websocket
    this._websocketService.disconnect();

    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }
}
