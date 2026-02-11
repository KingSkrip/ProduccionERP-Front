import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { WebsocketService } from 'app/core/services/websockets/websocket.service';
import { UserService } from 'app/core/user/user.service';
import { Subject, takeUntil } from 'rxjs';
import { MailboxSidebarComponent } from './sidebar/sidebar.component';
import { MailboxService } from './mailbox.service';

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

  console.log('👤 USER COMPLETO:', {
    id: user?.id,
    firebird_user_id: user?.firebird_user_id,
    firebird_user_clave: user?.firebird_user_clave,
    name: user?.name,
  });

  if (user?.id) {
    const token = localStorage.getItem('encrypt') ?? '';

    console.log('🔥 Conectando WS:', {
      identity_id: user.id,
      firebird_user_id: user.firebird_user_id,
      usando_para_ws: user.id,
    });

    this._websocketService.connect(Number(user.id), token);
  }

  // 🔥 PROCESAR EVENTOS WEBSOCKET
  this._websocketService
    .getMessages()
    .pipe(takeUntil(this._unsubscribeAll))
    .subscribe((msg) => {
      if (!msg) return;
      
      console.log('📡 Evento WS recibido:', msg);

      switch (msg.type) {
        case 'workorder.created':
          console.log('📨 Nuevo workorder:', msg.data);
          // Recargar la lista de correos
          this._mailboxService.reloadMails();
          break;

        case 'mail.reply.created':
          console.log('💬 Nueva respuesta:', msg.data);
          // Actualizar el mail actual si está abierto
          this._mailboxService.reloadMails();
          break;

        case 'mailbox.updated':
          console.log('📬 Mailbox actualizado:', msg.data);
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
    // ✅ desconectar websocket
    this._websocketService.disconnect();

    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }
}
