import { Injectable } from '@angular/core';
import { FuseNavigationItem } from '@fuse/components/navigation/navigation.types';
import { RoleEnum, SubRoleEnum } from 'app/core/auth/roles/dataroles';
import { menuSuAdmin, menuColaborador, menuRh, menuAdmin, menuJefe } from 'app/mock-api/common/navigation/data';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FuseNavigationService {
    private _componentRegistry: Map<string, any> = new Map();
    private _navigationStore: Map<string, FuseNavigationItem[]> = new Map();

    private _onNavigationChanged: BehaviorSubject<{ key: string, navigation: FuseNavigationItem[] }>
        = new BehaviorSubject<{ key: string, navigation: FuseNavigationItem[] }>({ key: '', navigation: [] });

    public onNavigationChanged$: Observable<{ key: string, navigation: FuseNavigationItem[] }>
        = this._onNavigationChanged.asObservable();

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Register navigation component
     *
     * @param name
     * @param component
     */
    registerComponent(name: string, component: any): void {
        this._componentRegistry.set(name, component);
    }

    /**
     * Deregister navigation component
     *
     * @param name
     */
    deregisterComponent(name: string): void {
        this._componentRegistry.delete(name);
    }

    /**
     * Get navigation component from the registry
     *
     * @param name
     */
    getComponent<T>(name: string): T {
        return this._componentRegistry.get(name);
    }

    /**
     * Store the given navigation with the given key
     *
     * @param key
     * @param navigation
     */
    storeNavigation(key: string, navigation: FuseNavigationItem[]): void {
        this._navigationStore.set(key, navigation);

        // Emitir el cambio con estructura correcta
        this._onNavigationChanged.next({ key, navigation });
    }
    /**
     * Get navigation from storage by key
     *
     * @param key
     */
    getNavigation(key: string): FuseNavigationItem[] {
        return this._navigationStore.get(key) ?? [];
    }

    /**
     * Delete the navigation from the storage
     *
     * @param key
     */
    deleteNavigation(key: string): void {
        // Check if the navigation exists
        if (!this._navigationStore.has(key)) {
            console.warn(
                `Navigation with the key '${key}' does not exist in the store.`
            );
        }

        // Delete from the storage
        this._navigationStore.delete(key);
    }

    /**
     * Utility function that returns a flattened
     * version of the given navigation array
     *
     * @param navigation
     * @param flatNavigation
     */
    getFlatNavigation(
        navigation: FuseNavigationItem[],
        flatNavigation: FuseNavigationItem[] = []
    ): FuseNavigationItem[] {
        for (const item of navigation) {
            if (item.type === 'basic') {
                flatNavigation.push(item);
                continue;
            }

            if (
                item.type === 'aside' ||
                item.type === 'collapsable' ||
                item.type === 'group'
            ) {
                if (item.children) {
                    this.getFlatNavigation(item.children, flatNavigation);
                }
            }
        }

        return flatNavigation;
    }

    /**
     * Utility function that returns the item
     * with the given id from given navigation
     *
     * @param id
     * @param navigation
     */
    getItem(
        id: string,
        navigation: FuseNavigationItem[]
    ): FuseNavigationItem | null {
        for (const item of navigation) {
            if (item.id === id) {
                return item;
            }

            if (item.children) {
                const childItem = this.getItem(id, item.children);

                if (childItem) {
                    return childItem;
                }
            }
        }

        return null;
    }

    /**
     * Utility function that returns the item's parent
     * with the given id from given navigation
     *
     * @param id
     * @param navigation
     * @param parent
     */
    getItemParent(
        id: string,
        navigation: FuseNavigationItem[],
        parent: FuseNavigationItem[] | FuseNavigationItem
    ): FuseNavigationItem[] | FuseNavigationItem | null {
        for (const item of navigation) {
            if (item.id === id) {
                return parent;
            }

            if (item.children) {
                const childItem = this.getItemParent(id, item.children, item);

                if (childItem) {
                    return childItem;
                }
            }
        }

        return null;
    }

    //SubRoleEnum

    getNavigationByRole(roleId: number, subRoleId?: number): FuseNavigationItem[] {
        let navigation: FuseNavigationItem[] = [];

        // 1️⃣ Navegación base por ROL
        switch (roleId) {

            case RoleEnum.RH:
                navigation = menuRh;
                break;

            case RoleEnum.SUADMIN:
                navigation = menuSuAdmin;
                break;

            case RoleEnum.ADMIN:
                navigation = menuAdmin;
                break;

            case RoleEnum.COLABORADOR:
                navigation = menuColaborador;
                break;

            default:
                navigation = [];
                break;
        }

        // 2️⃣ Sobrescribir por SUBROL
        if (subRoleId) {

            switch (subRoleId) {
                case SubRoleEnum.JEFE:
                    navigation = menuJefe;
                    break;
                // futuros subroles aquí
            }
        }

        // 3️⃣ Seguridad
        if (!Array.isArray(navigation)) {
            console.error('Navigation inválida', { roleId, subRoleId });
            return [];
        }

        return [...navigation];
    }


}
