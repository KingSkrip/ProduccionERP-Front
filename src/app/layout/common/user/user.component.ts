import { BooleanInput } from '@angular/cdk/coercion';
import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.types';
import { Subject, takeUntil } from 'rxjs';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import { APP_CONFIG } from 'app/core/config/app-config';

@Component({
    selector: 'user',
    templateUrl: './user.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'user',
    imports: [
        MatButtonModule,
        MatMenuModule,
        MatIconModule,
        NgClass,
        MatDividerModule,
    ],
})
export class UserComponent implements OnInit, OnDestroy {
    static ngAcceptInputType_showAvatar: BooleanInput;
    @Input() showAvatar: boolean = true;
    user: User;
    apiBase = APP_CONFIG.apiBase;
    private _photoVersion = Date.now();

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _router: Router,
        private _userService: UserService,
        private _chatService: ChatService
    ) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------



    get photoUrl(): string {
        if (!this.user?.photo) return '';

        // Si ya viene full url (http...), úsala tal cual
        if (this.user.photo.startsWith('http')) {
            return `${this.user.photo}?v=${this._photoVersion}`;
        }

        const base = this.apiBase.endsWith('/') ? this.apiBase : this.apiBase + '/';
        const photo = this.user.photo.startsWith('/') ? this.user.photo.substring(1) : this.user.photo;

        return `${base}${photo}?v=${this._photoVersion}`;
    }


    private _lastPhoto = '';


    /**
     * On init
     */
    ngOnInit(): void {
        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user: User) => {
                this.user = user;

                if (user?.photo && user.photo !== this._lastPhoto) {
                    this._lastPhoto = user.photo;
                    this._photoVersion = Date.now(); // cache-bust si cambió
                }

                this._changeDetectorRef.markForCheck();
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
     * Update the user status
     *
     * @param status
     */
    updateUserStatus(status: string): void {
        if (!this.user) return;

        this._userService.updateUserStatus(status);
    }


    /**
     * Sign out
     */
    signOut(): void {
        this._router.navigate(['/sign-out']);
    }


    openProfile(): void {

        const redirectURL = '/pages/settings';

        this._router.navigateByUrl(redirectURL);

    }


    openSettings(): void {

        const redirectURL = '/pages/profile';

        this._router.navigateByUrl(redirectURL);
    }

}
