// import { DOCUMENT } from '@angular/common';
// import {
//     Component,
//     Inject,
//     OnDestroy,
//     OnInit,
//     Renderer2,
//     ViewEncapsulation,
// } from '@angular/core';
// import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
// import { FuseConfig, FuseConfigService } from '@fuse/services/config';
// import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
// import { FusePlatformService } from '@fuse/services/platform';
// import { FUSE_VERSION } from '@fuse/version';
// import { Subject, combineLatest, filter, map, takeUntil } from 'rxjs';


// @Component({
//     selector: 'profile',
//     templateUrl: './profile.component.html',
//     styleUrls: ['./profile.component.scss'],
//     encapsulation: ViewEncapsulation.None,
  
// })
// export class ProfileComponent implements OnInit, OnDestroy {
//     config: FuseConfig;
//     layout: string;
//     scheme: 'dark' | 'light';
//     theme: string;
//     private _unsubscribeAll: Subject<any> = new Subject<any>();

//     /**
//      * Constructor
//      */
//     constructor(
//         private _activatedRoute: ActivatedRoute,
//         @Inject(DOCUMENT) private _document: any,
//         private _renderer2: Renderer2,
//         private _router: Router,
//         private _fuseConfigService: FuseConfigService,
//         private _fuseMediaWatcherService: FuseMediaWatcherService,
//         private _fusePlatformService: FusePlatformService
//     ) {}


// }
