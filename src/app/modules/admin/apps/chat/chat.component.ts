import {
    ChangeDetectionStrategy,
    Component,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatService } from './chat.service';

import { MatDrawer, MatDrawerContainer } from '@angular/material/sidenav';
import { ProfileComponent } from './profile/profile.component';


@Component({
    selector: 'chat',
    templateUrl: './chat.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterOutlet,
        MatDrawer,
        MatDrawerContainer,
        ProfileComponent
    ],
})
export class ChatComponent {
    /**
     * Constructor
     */
    @ViewChild('profileDrawer', { static: true }) profileDrawer: MatDrawer;

    constructor(private _chatService: ChatService) { }

    ngOnInit(): void {
        this._chatService.openProfileDrawer$.subscribe(() => {
            this.profileDrawer.open();
        });
    }

}
