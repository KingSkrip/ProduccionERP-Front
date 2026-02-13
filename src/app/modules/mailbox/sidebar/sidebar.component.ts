import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  FuseNavigationItem,
  FuseNavigationService,
  FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';

import { Subject, takeUntil } from 'rxjs';
import { MailboxComposeComponent } from '../compose/compose.component';
import { labelColorDefs } from '../mailbox.constants';
import { MailboxService } from '../mailbox.service';
import { MailFilter, MailFolder, MailLabel } from '../mailbox.types';

@Component({
  selector: 'mailbox-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatIconModule, FuseVerticalNavigationComponent],
})
export class MailboxSidebarComponent implements OnInit, OnDestroy {
  filters: MailFilter[];
  folders: MailFolder[];
  labels: MailLabel[];
  menuData: FuseNavigationItem[] = [];
  private _filtersMenuData: FuseNavigationItem[] = [];
  private _foldersMenuData: FuseNavigationItem[] = [];
  private _labelsMenuData: FuseNavigationItem[] = [];
  private _otherMenuData: FuseNavigationItem[] = [];
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  /**
   * Constructor
   */
  constructor(
    private _mailboxService: MailboxService,
    private _matDialog: MatDialog,
    private _fuseNavigationService: FuseNavigationService,
       private _cdr: ChangeDetectorRef,
  ) {}

  // -----------------------------------------------------------------------------------------------------
  // @ Lifecycle hooks
  // -----------------------------------------------------------------------------------------------------

  /**
   * On init
   */
  ngOnInit(): void {
    // Filters
    this._mailboxService.filters$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((filters: MailFilter[]) => {
        this.filters = filters;

        // Generate menu links
        this._generateFiltersMenuLinks();
      });

    // Folders
    this._mailboxService.folders$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((folders: MailFolder[]) => {
        this.folders = folders;

        // Generate menu links
        this._generateFoldersMenuLinks();

        // Update navigation badge
        this._updateNavigationBadge(folders);
      });

    // Labels
    this._mailboxService.labels$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((labels: MailLabel[]) => {
        this.labels = labels;

        // Generate menu links
        this._generateLabelsMenuLinks();
      });

    // Generate other menu links
    // this._generateOtherMenuLinks();
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
 * Open compose dialog
 */
openComposeDialog(): void {
  // Open the dialog
  const dialogRef = this._matDialog.open(MailboxComposeComponent);

  dialogRef.afterClosed().subscribe((result) => {});
}
  // -----------------------------------------------------------------------------------------------------
  // @ Private methods
  // -----------------------------------------------------------------------------------------------------

  /**
   * Generate menus for folders
   *
   * @private
   */
  private _generateFoldersMenuLinks(): void {
    this._foldersMenuData = [];
    this.folders.forEach((folder) => {
      const menuItem: FuseNavigationItem = {
        id: folder.id,
        title: folder.title,
        type: 'basic',
        icon: folder.icon,
        link: '/pages/mailbox/' + folder.slug,
      };

      //CONTADOR QUE SE PUEDE HACER AUTOMATICO CON LOS MENSAJES PENDIENTES O PONER UN INDICADOR

      // if (folder.count && folder.count > 0) {
      //   menuItem['badge'] = {
      //     title: folder.count + '',
      //   };
      // }

      this._foldersMenuData.push(menuItem);
    });
    this._updateMenuData();
  }

  /**
   * Generate menus for filters
   *
   * @private
   */
  private _generateFiltersMenuLinks(): void {
    this._filtersMenuData = [];

    // Iterate through the filters
    this.filters.forEach((filter) => {
      // Generate menu item for the filter
      this._filtersMenuData.push({
        id: filter.id,
        title: filter.title,
        type: 'basic',
        icon: filter.icon,
        link: '/pages/mailbox/filter/' + filter.slug,
      });
    });

    // Update the menu data
    this._updateMenuData();
  }

  /**
   * Generate menus for labels
   *
   * @private
   */
  private _generateLabelsMenuLinks(): void {
    // Reset the labels menu
    this._labelsMenuData = [];

    // Iterate through the labels
    this.labels.forEach((label) => {
      // Generate menu item for the label
      this._labelsMenuData.push({
        id: label.id,
        title: label.title,
        type: 'basic',
        icon: 'heroicons_outline:tag',
        classes: {
          icon: labelColorDefs[label.color].text,
        },
        link: '/pages/mailbox/label/' + label.slug,
      });
    });

    // Update the menu data
    this._updateMenuData();
  }

  /**
   * Generate other menus
   *
   * @private
   */
  // private _generateOtherMenuLinks(): void {
  //   // Settings menu
  //   this._otherMenuData.push({
  //     title: 'Settings',
  //     type: 'basic',
  //     icon: 'heroicons_outline:cog-8-tooth',
  //     link: '/pages/mailbox/settings',
  //   });

  //   // Update the menu data
  //   this._updateMenuData();
  // }

  /**
   * Update the menu data
   *
   * @private
   */
  private _updateMenuData(): void {
    this.menuData = [
      {
        title: 'BANDEJA',
        type: 'group',
        children: [...this._foldersMenuData],
      },
      {
        title: 'FILTROS',
        type: 'group',
        children: [...this._filtersMenuData],
      },
      // {
      //   title: 'ETIQUETAS',
      //   type: 'group',
      //   children: [...this._labelsMenuData],
      // },
      // {
      //   type: 'spacer',
      // },
      ...this._otherMenuData,
    ];
  }

  /**
   * Update the navigation badge using the
   * unread count of the inbox folder
   *
   * @param folders
   * @private
   */
  private _updateNavigationBadge(folders: MailFolder[]): void {
    const inboxFolder = this.folders?.find((f) => f.slug === 'mensajes');
    if (!inboxFolder) return;

    const mainNavigationComponent =
      this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');

    if (!mainNavigationComponent) return;

    const mainNavigation = mainNavigationComponent.navigation;

    // OJO: este id puede no existir en tu navegación
    const menuItem = this._fuseNavigationService.getItem('pages.mailbox', mainNavigation);

    if (!menuItem) {
      // Si quieres, log para saber cuál es el id real
      // console.warn('No existe item pages.mailbox en navegación', mainNavigation);
      return;
    }

    // Si no trae badge creado, lo creas
    if (!menuItem.badge) {
      menuItem.badge = { title: '0' };
    }

    menuItem.badge.title = String(inboxFolder.count ?? 0);

    mainNavigationComponent.refresh();
  }
}
