/**
 * Extends {@link ModelCollection} instances with helpful functionality.
 *
 * ```js
 * // esm
 * import { models } from '@paychex/core';
 *
 * // cjs
 * const { models } = require('@paychex/core');
 *
 * // iife
 * const { models } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ models }) { ... });
 * define(['@paychex/core'], function({ models }) { ... });
 * ```
 *
 * @module models/utils
 * @example
 * ```js
 * import { createRequest, fetch } from '~/path/to/data';
 *
 * const getUserReports = {
 *   method: 'GET',
 *   base: 'reporting',
 *   path: 'reports/:user',
 * };
 *
 * export async function getReports(user) {
 *   const request = createRequest(getUserReports, { user });
 *   const response = await fetch(request);
 *   const reportList = models.collection(...response.data);
 *   // order reports newest first and then by name
 *   return models.utils.withOrdering(reportList, ['date', 'name'], ['desc', 'asc']);
 * }
 */

import {
    head,
    size,
    orderBy,
    groupBy,
    filter,
    isEmpty,
    isNumber,
    identity,
    uniqBy,
    differenceBy,
    intersectionBy,
    negate,
} from 'lodash';

import { mixin, readonly } from './shared';

import type { ModelCollection } from './index';

export interface EventCollection extends Readonly<Record<string, string>> {

    /**
     * Fired when a new uniqueness method is specified.
     *
     * @event
     * @example
     * ```js
     * const list = models.utils.withUnique(models.collection(1.0, 1.5, 2.0));
     *
     * list.on(Events.UNIQUE_CHANGED, () => {
     *   console.log('items:', list.items());
     * });
     *
     * list.uniqueBy(Math.floor); // "items: [1.0, 2.0]"
     * ```
     */
    UNIQUE_CHANGED: 'unique-change'

    /**
     * Fired when {@link OrderedModelCollection.orderBy orderBy} is invoked.
     *
     * @event
     * @example
     * ```js
     * const list = models.utils.withOrdering(models.collection());
     *
     * list.on(Events.ORDER_CHANGED, () => {
     *   console.log('order changed');
     * });
     *
     * list.add(1, 2, 3);
     * list.orderBy([], ['desc']); // "order changed"
     * ```
     */
    ORDER_CHANGED: 'order-change'

    /**
     * Fired when {@link FilteredModelCollection.filterBy filterBy} is invoked.
     *
     * @event
     * @example
     * ```js
     * const list = models.utils.withFiltering(models.collection());
     * const isOdd = num => num % 2;
     *
     * list.on(Events.FILTER_CHANGED, () => {
     *   console.log('filter changed');
     * });
     *
     * list.add(1, 2, 3);
     * list.filterBy(isOdd); // "filter changed"
     * ```
     */
    FILTER_CHANGED: 'filter-change'

    /**
     * Fired when {@link GroupedModelCollection.groupBy groupBy} is invoked.
     *
     * @event
     * @example
     * ```js
     * import { users } from '../data/users';
     *
     * const list = models.utils.withGrouping(models.collection());
     *
     * list.on(Events.GROUP_CHANGED, () => {
     *   console.log('group changed');
     * });
     *
     * list.add(...users);
     * list.groupBy(['region']); // "group changed"
     * ```
     */
    GROUP_CHANGED: 'group-change'

    /**
     * Fired when the currently active item changes.
     *
     * @event
     * @example
     * ```js
     * import { users } from '../data/users';
     *
     * const list = models.utils.withActive(models.collection());
     *
     * list.on(Events.ACTIVE_CHANGED, (curr, prev) => {
     *   console.log('active changed from', prev, 'to', curr);
     * });
     *
     * list.add(1, 2, 3);
     * list.active(2); // "active changed from 1 to 2"
     * ```
     */
    ACTIVE_CHANGED: 'active-change'

    /**
     * Fired when the selected items have changed.
     *
     * @event
     * @example
     * ```js
     * import { users } from '../data/users';
     *
     * const list = models.utils.withSelection(models.collection());
     *
     * list.on(Events.SELECTION_CHANGED, (selected) => {
     *   console.log('selection changed', selected);
     * });
     *
     * list.add(1, 2, 3);
     * list.selected(); // []
     * list.selected(2, 3); // "selection changed [2, 3]"
     * ```
     */
    SELECTION_CHANGED: 'selection-change'

    /**
     * Fired when the current page has changed.
     *
     * @event
     * @example
     * ```js
     * import { users } from '../data/users';
     *
     * const list = models.utils.withPaging(models.collection(), 2);
     *
     * list.on(Events.PAGE_CHANGED, (pageIndex) => {
     *   console.log('page changed', pageIndex);
     * });
     *
     * list.add(...users);
     * list.nextPage(); // "page changed 1"
     * list.prevPage(); // "page changed 0"
     * ```
     */
    PAGE_CHANGED: 'page-change'

    /**
     * Fired when one or more items in the collection were
     * updated during an {@link UpdatingModelCollection.upsert upsert}
     * or {@link UpdatingModelCollection.merge merge} operation.
     *
     * @event
     * @example
     * ```js
     * import { newUsers, allUsers, activeUsers } from '../data/users';
     *
     * const list = models.utils.withUpdating(models.collection(), 'username');
     *
     * list.on(Events.ITEMS_UPDATED, (modified) => {
     *   console.log('users updated', modified);
     * });
     *
     * list.add(...newUsers);
     * list.upsert(...allUsers);
     * list.merge(...activeUsers);
     * ```
     */
    ITEMS_UPDATED: 'items-update'

}

export const Events: EventCollection = Object.freeze({
    UNIQUE_CHANGED: 'unique-change',
    ORDER_CHANGED: 'order-change',
    FILTER_CHANGED: 'filter-change',
    GROUP_CHANGED: 'group-change',
    ACTIVE_CHANGED: 'active-change',
    SELECTION_CHANGED: 'selection-change',
    PAGE_CHANGED: 'page-change',
    ITEMS_UPDATED: 'items-update',
});

/**
 * Adds "active item" tracking and navigation to an existing {@link ModelCollection} instance.
 *
 * **Note on Grouping**: If you want to navigate through a grouped list, you may want
 * to ensure an order has been applied beforehand. Use {@link module:models.withOrdering withOrdering}
 * and ensure your array of iteratees starts with your group selector. This ensures that
 * navigating through the list correctly moves between groups.
 *
 * @extends ModelCollection
 * @listens {@link Events.ADDED}
 * @listens {@link Events.REMOVED}
 * @listens {@link Events.FILTER_CHANGED}
 * @listens {@link Events.ACTIVE_CHANGED}
 */
export interface ActiveModelCollection extends ModelCollection {

    /**
    * Gets or sets the current active item in the list.
    * **NOTE:** Only currently available items can be activated. For example, if you
    * are using {@link module:models.withFiltering withFiltering} then items which
    * have been filtered out can not be activated.
    *
    * @param item The item to activate. Must be present in the current list.
    * To retrieve the currently active item, do not pass any arguments.
    * @returns The currently active item.
    * @fires {@link Events.ACTIVE_CHANGED}
    * @example
    * ```js
    * const list = models.utils.withActive(models.collection(1, 2, 3));
    *
    * console.log(list.active());  // 1
    * console.log(list.active(2)); // 2
    * console.log(list.active(5)); // 2
    * ```
    */
    active(item?: any): any

    /**
     * @param wrap Whether to wrap back to the start of the
     * list if the currently active item is the last item.
    * @returns The newly activated item, or `null` if at end of list
    * and `wrap` is not truthy.
    * @example
    * ```js
    * const list = models.utils.withActive(models.collection(1, 2, 3));
    * list.active(2);
    * list.next(); // 3
    * list.next(); // null (at end of list)
    * list.next(true); // 1 (wraps to start)
    * ```
    */
    next(wrap?: boolean): any

    /**
     * @param wrap Whether to wrap back to the end of the
     * list if the currently active item is the first item.
     * @returns The newly activated item, or `null` if at start of list
     * and `wrap` is not truthy.
     * @example
     * ```js
     * const list = models.utils.withActive(models.collection(1, 2, 3));
     * list.active(2);
     * list.prev(); // 1
     * list.prev(); // null (at start of list)
     * list.prev(true); // 3 (wraps to end)
    * ```
     */
    prev(wrap?: boolean): any

    /**
     * Returns `true` if the currently active item is the last item in the list.
     *
     * @readonly
     * @example
     * ```js
     * const list = models.utils.withActive(models.collection(1, 2, 3));
     *
     * list.active(); // 1
     * list.atStart; // true
     * list.atEnd; // false
     *
     * list.next(); // 2
     * list.atStart; // false
     * list.atEnd; // false
     *
     * list.next(); // 3
     * list.atStart; // false
     * list.atEnd; // true
    * ```
     */
    atEnd: boolean

    /**
     * Returns `true` if the currently active item is the first item in the list.
     *
     * @readonly
     * @example
     * ```js
     * const list = models.utils.withActive(models.collection(1, 2, 3));
     *
     * list.active(); // 1
     * list.atStart; // true
     * list.atEnd; // false
     *
     * list.next(); // 2
     * list.atStart; // false
     * list.atEnd; // false
     *
     * list.next(); // 3
     * list.atStart; // false
     * list.atEnd; // true
    * ```
     */
    atStart: boolean

}

/**
 * Adds ordering functionality to an existing {@link ModelCollection} instance.
 *
 * @extends ModelCollection
 */
export interface OrderedModelCollection extends ModelCollection {

    /**
     * Orders the internal ModelCollection collection using the information provided.
     *
     * @param iteratees Optional iteratees to use as selector functions.
     * @param orders Optional sort orders to use for each selector value.
     * @fires {@link Events.ORDER_CHANGED}
     * @example
     * ```js
     * const list = models.collection(1, 2, 3, 4, 5, 6);
     * const ordered = models.utils.withOrdering(list, [], ['desc']);
     *
     * ordered.items(); // [6, 5, 4, 3, 2, 1]
     *
     * ordered.orderBy(); // identity ascending
     * ordered.items(); // [1, 2, 3, 4, 5, 6];
     *
     * ordered.orderBy(num => num % 3);
     * ordered.items(); // [3, 6, 1, 4, 2, 5];
     * ```
     * @example
     * ```js
     * import { loadNotifications } from '../data/notifications';
     *
     * export async function getNotificationsList() {
     *   const notifications = await loadNotifications();
     *   const list = models.utils.withOrdering(models.collection(notifications));
     *   list.orderBy(['priority', 'date', 'subject'], ['desc', 'desc', 'asc']);
     *   return list;
     * }
     * ```
     */
    orderBy(iteratees: any[], orders?: string[]): void

}

/**
 * Adds filtering functionality to an existing {@link ModelCollection} instance.
 *
 * @extends ModelCollection
 */
export interface FilteredModelCollection extends ModelCollection {

    /**
    * Filters the underlying items in the ModelCollection collection.
    *
    * @param filterer The filter logic to apply.
    * @fires {@link Events.FILTER_CHANGED}
    * @example
    * ```js
    * import { getNotificationsList } from '../models/notifications';
    *
    * export async function getUnreadNotifications() {
    *   // wrap an existing ModelCollection
    *   const list = await getNotificationsList();
    *   return models.utils.withFiltering(list, ['unread']);
    * }
    * ```
    * @example
    * ```js
    * const isOdd = num => num % 2;
    * const list = models.withFiltering(models.collection(), isOdd);
    *
    * list.add(1, 2, 3, 4, 5);
    * list.items(); // [1, 3, 5]
    *
    * list.filterBy(); // reset filtering
    * list.items(); // [1, 2, 3, 4, 5]
    * ```
    */
    filterBy(filterer?: any): void

}

/**
 * Adds grouping functionality to an existing {@link ModelCollection} instance.
 *
 * @extends ModelCollection
 */
export interface GroupedModelCollection extends ModelCollection {

    /**
    * Groups the underlying items in the ModelCollection collection.
    *
    * @param grouper The grouping logic to apply.
    * @fires {@link Events.GROUP_CHANGED}
    * @example
    * ```js
    * import { getNotificationsList } from '../models/notifications';
    *
    * export async function groupNotifications() {
    *   // wrap an existing ModelCollection
    *   const list = await getNotificationsList();
    *   return models.utils.withGrouping(list, ['status']);
    * }
    * ```
    * @example
    * ```js
    * import { cond, conforms, constant, stubTrue } from 'lodash';
    * import { getClientList } from '../models/client';
    *
    * const lessThan = (max) => (num) => num < max;
    *
    * // function that buckets by employeeCount
    * const employeeBuckets = cond([
    *   [ conforms({ employeeCount: lessThan(10) }), constant('small')  ],
    *   [ conforms({ employeeCount: lessThan(50) }), constant('medium') ],
    *   [ stubTrue,                                  constant('large')  ]
    * ]);
    *
    * export async function getBucketedClientList() {
    *   const list = await getClientList();
    *   return models.utils.withGrouping(list, employeeBuckets);
    * }
    *
    * // CONSUMER:
    * const clients = await getBucketedClientList();
    * clients.groups(); // { small: [...], medium: [...], large: [...] }
    *
    * clients.groupBy(['region']);
    * clients.groups(); // { 'east': [...], 'north': [...], 'south': [...] }
    * ```
    */
    groupBy(grouper: any): void

    /**
     * Returns the groups from the underlying collection. Groups are returned
     * as an object whose keys are the group names; each value is an array of
     * the objects belonging to that group.
     *
     * @returns The grouped objects.
     * @example
     * ```js
     * import { getNotificationsList } from '../models/notifications';
     *
     * export async function groupNotifications() {
     *   // wrap an existing ModelCollection
     *   const list = await getNotificationsList();
     *   return models.utils.withGrouping(list, ['status']);
     * }
     *
     * // CONSUMER:
     * const notifications = groupNotifications();
     * notifications.groups(); // { 'read': [...], 'unread': [...] }
    * ```
     */
    groups(): { [key: string]: any[] }

}

/**
 * Tracks which items within the wrapped {@link ModelCollection} instance
 * are selected at any given time. **NOTE:** Items which are not
 * available through the wrapped ModelCollection can not be selected.
 *
 * @extends ModelCollection
 * @listens {@link Events.REMOVED}
 * @listens {@link Events.FILTER_CHANGED}
 */
export interface SelectionModelCollection extends ModelCollection {

    /**
    * Gets or sets the currently selected items within the list.
    * **NOTE:** Only currently available items can be selected. For example, if you
    * are using {@link module:models.withFiltering withFiltering} then items which
    * have been filtered out can not be selected.
    *
    * @param items The items to select. Must be present in the current list.
    * To retrieve the currently selected items, do not pass any arguments.
    * @returns The currently selected items.
    * @fires {@link Events.SELECTION_CHANGED}
    * @example
    * ```js
    * const list = models.utils.withSelection(models.collection(1, 2, 3));
    *
    * list.selected();  // []
    * list.selected(2); // [2]
    * list.selected(2, 3); // [2, 3]
    * ```
    */
    selected(...items: any[]): any[]

    /**
     * Select all, none, or some of the ModelCollection items, depending on which
     * are currently selected and which are passed as arguments.
     *
     * When called with no arguments, the behavior of toggle changes depending
     * on whether _none_, _some_, or _all_ items are currently selected:
     *
     * call | condition | result
     * :--- | :--- | :---
     * `toggle()` | selected() == [] | select all items
     * `toggle()` | selected() != items() | select all items
     * `toggle()` | selected() == items() | select no items
     *
     * When passed items, only those items' selection status will be toggled.
     * None of the previously selected items' selection status will change:
     *
     * ```javascript
     * list.selected(); // [1, 2, 3]
     * list.toggle(2);  // [1, 3]
     * list.toggle(2);  // [1, 2, 3]
     * ```
     *
     * @param items The items to select or deselect. Must be present
     * in the current list. To select or deselect all items, pass no arguments.
     * @returns The currently selected items.
     * @fires {@link Events.SELECTION_CHANGED}
     * @example
     * ```js
     * const list = models.utils.withSelection(models.collection(1, 2, 3));
     *
     * list.selected(); // []
     * list.toggle(); // [1, 2, 3]
     * list.toggle(2); // [1, 3]
     * list.toggle(); // [1, 2, 3]
     * list.toggle(); // []
     * list.toggle(1, 2); // [1, 2]
     * ```
     */
    toggle(...items: any[]): any[]

}

/**
 * Provides paging functionality to the wrapped {@link ModelCollection} instance.
 *
 * **Order of Operations:** Typically, you should call `withPaging` _after_
 * applying any other decorators. This ensures the underling `items` collection
 * represents the correct set of items when calculating page counts.
 *
 * **Note on Active Items:** If you apply paging to a {@link ActiveModelCollection ActiveModelCollection}
 * created using the {@link module:models.withActive withActive} decorator, the
 * current page index will update automatically as you change the active item.
 *
 * @extends ModelCollection
 * @listens {@link Events.ADDED}
 * @listens {@link Events.REMOVED}
 * @listens {@link Events.ACTIVE_CHANGED}
 * @listens {@link Events.FILTER_CHANGED}
 */
export interface PagedModelCollection extends ModelCollection {

    /**
     * Gets or sets the current page size (the number of items that
     * should be visible on each page.)
     *
     * @param size The number of items to show on each page.
     * Pass no arguments to retrieve the current page size.
     * @returns The current page size.
     * @example
     * ```js
     * const list = models.utils.withPaging(models.collection());
     *
     * list.pageSize(); // 50 (default page size)
     *
     * list.pageSize(5); // 5
     * list.add(1, 2, 3, 4, 5, 6, 7, 8);
     * list.items(); // [1, 2, 3, 4, 5]
     *
     * list.pageSize(3); // 3
     * list.items(); // [1, 2, 3]
     * ```
     */
    pageSize(size?: number): number

    /**
     * Moves to the next page of items. Does nothing if called on the last page.
     *
     * @returns The new page index.
     * @fires {@link Events.PAGE_CHANGED}
     * @example
     * ```js
     * const list = models.utils.withPaging(models.collection(1, 2, 3, 4, 5));
     *
     * list.pageSize(2);
     * list.pageIndex(); // 0
     *
     * list.nextPage();  // 1
     * list.nextPage();  // 2
     * list.nextPage();  // 2 (stops on last page)
     * ```
     */
    nextPage(): number

    /**
     * Moves to the previous page of items. Does nothing if called on the first page.
     *
     *@returns The new page index.
     * @fires {@link Events.PAGE_CHANGED}
     * @example
     * ```js
     * const list = models.utils.withPaging(models.collection(1, 2, 3, 4, 5));
     *
     * list.pageSize(2);
     * list.pageIndex(2); // start on last page
     *
     * list.prevPage();  // 1
     * list.prevPage();  // 0
     * list.prevPage();  // 0 (stops on first page)
     * ```
     */
    prevPage(): number

    /**
     * Gets or sets the current page index (base 0). If outside the available bounds,
     * the given index will be clamped between 0 and {@link pageCount} - 1.
     *
     * @param index The new page index.
     * @returns The new page index.
     * @example
     * ```js
     * const list = models.utils.withPaging(models.collection(1, 2, 3, 4, 5));
     *
     * list.pageSize(2);
     * list.pageIndex(); // 0
     *
     * list.nextPage();
     * list.pageIndex(); // 1
     *
     * list.pageIndex(0); // 0
     * list.pageIndex(15); // 2
     * list.pageIndex(-1); // 0
     * ```
     */
    pageIndex(index?: number): number

    /**
     * Returns the number of pages based on the number of {@link items}
     * and the current {@link pageSize}.
     *
     * @readonly
     * @example
     * ```js
     * const list = models.utils.withPaging(models.collection(1, 2, 3, 4));
     *
     * list.pageSize(10);
     * console.log(list.pageCount); // 1
     *
     * list.pageSize(2);
     * console.log(list.pageCount); // 2
     *
     * list.add(5);
     * console.log(list.pageCount); // 3
     * ```
     * @example
     * ```js
     * // paging over a filtered list
     *
     * // order matters! filter first, then page:
     * const list = models.utils.withPaging(
     *   models.utils.withFiltering(
     *     models.collection()));
     *
     * list.pageSize(2);
     * list.add(1, 2, 3, 4, 5);
     * console.log(list.pageCount); // 3
     *
     * const isOdd = num => num % 2;
     * list.filterBy(isOdd);
     * console.log(list.pageCount); // 2
     * ```
     */
    pageCount: number

}

/**
 * Adds a uniqueness constraint to an existing {@link ModelCollection}'s items.
 *
 * @extends ModelCollection
 */
export interface UniqueModelCollection extends ModelCollection {

    /**
     * Applies a uniqueness constraint to the wrapped {@link ModelCollection} items.
     *
     * @param iteratee Optional iteratee to use as a selector function.
     * @fires {@link Events.UNIQUE_CHANGED}
     * @example
     * ```js
     * const list = models.utils.withUnique(models.collection());
     *
     * list.add(1, 2, 3);
     * list.items(); // [1, 2, 3]
     *
     * list.add(1, 2, 2.5, 3, 4);
     * list.items(); // [1, 2, 2.5, 3, 4]
     *
     * list.uniqueBy(Math.floor);
     * list.items(); // [1, 2, 3, 4]
     * ```
     */
    uniqueBy(iteratee?: any): void

}

/**
 * Adds methods to update a {@link ModelCollection}'s items based on a more current
 * collection of items.
 *
 * @extends UniqueModelCollection
 */
export interface UpdatingModelCollection extends UniqueModelCollection {

    /**
     * Adds or updates items in the underlying collection. Does _not_ remove any
     * existing items.
     *
     * @param items The items to add or update in the underlying collection.
     * @fires {@link Events.ADDED}
     * @fires {@link Events.ITEMS_UPDATED}
     * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee}
     * @example
     * ```js
     * // our selector can use lodash iteratee
     * const list = models.utils.withUpdating(models.collection, 'id');
     *
     * list.add({ id: 123, name: 'Alice' });
     * list.add({ id: 456, name: 'Bob' });
     *
     * // update the first entry, keeping the second entry
     * list.upsert({ id: 123, name: 'Alicia' });
     * ```
     */
    upsert(...items: any[]): void

    /**
     * Adds, updates, _and_ removes items in the underlying collection based on
     * the incoming items.
     *
     * @param items The items to add or update in the underlying collection.
     * Any items in the existing collection that are _not_ in the incoming collection
     * will be removed.
     * @fires {@link Events.ADDED}
     * @fires {@link Events.REMOVED}
     * @fires {@link Events.ITEMS_UPDATED}
     * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee}
     * @example
     * ```js
     * // our selector can use lodash iteratee
     * const list = models.utils.withUpdating(models.collection, 'id');
     * let users = [
     *   { id: 123, name: 'Alice' },
     *   { id: 456, name: 'Bob' }
     * ];
     *
     * list.add(...users);
     *
     * // update the first entry and REMOVE the second entry
     * users = [ { id: 123, name: 'Alicia' } ];
     * list.merge(...users);
     * ```
     */
    merge(...items: any[]): void

}

/**
 * Orders the specified {@link ModelCollection} items. You can order
 * using multiple selector functions and specify a different sort
 * order for each selector.
 *
 * @param list The ModelCollection instance to adapt.
 * @param args Optional arguments to pass to lodash's orderBy method.
 * @returns A ModelCollection with ordering functionality.
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#orderBy _.orderBy}
 * @example
 * ```js
 * import { getClientData } from '../data';
 *
 * export async function getClientList() {
 *   const clients = await getClientData();
 *   const list = models.collection(...clients);
 *   const date = (client) => Date.parse(client.dateModified);
 *   // order by branch name ascending and then date modified descending...
 *   // NOTE: we can use lodash iteratee shortcuts for our accessors; see
 *   // https://lodash.com/docs/4.17.11#iteratee for more information.
 *   return models.utils.withOrdering(list, ['branch', date], ['asc', 'desc']);
 * }
 *
 * // CONSUMERS:
 * const list = await getClientList();
 * list.items(); // [...clients ordered by branch asc and date desc...]
 *
 * // modify ordering:
 * list.orderBy(); // order by identity
 * list.orderBy([...iteratees]); // use ascending order
 * list.orderBy([...iteratees], [...orders]); // use specified orders
 * ```
 */
export function withOrdering<T extends ModelCollection>(list: T, ...args: any[]): OrderedModelCollection & T {

    let orderArgs = args;

    function setOrderBy(...params: any[]) {
        orderArgs = params;
        list.fire(Events.ORDER_CHANGED);
    }

    function items() {
        return orderBy(list.items(), ...orderArgs);
    }

    return {
        ...list,
        ...mixin(items),
        orderBy: setOrderBy,
    };

}

/**
 * Filters the specified ModelCollection's items.
 *
 * @param list The ModelCollection instance to adapt.
 * @param filterer The filter logic to apply.
 * @returns A ModelCollection with added filtering logic.
 * @example
 * ```js
 * import { getNotificationsList } from '../models/notifications';
 *
 * export async function getUnreadNotifications() {
 *   // wrap an existing ModelCollection
 *   const list = await getNotificationsList();
 *   return models.utils.withFiltering(list, ['unread']);
 * }
 * ```
 * @example
 * ```js
 * const isOdd = num => num % 2;
 * const list = models.utils.withFiltering(models.collection(), isOdd);
 *
 * list.add(1, 2, 3, 4, 5);
 * list.items(); // [1, 3, 5]
 *
 * list.filterBy(); // reset filtering
 * list.items(); // [1, 2, 3, 4, 5]
 * ```
 */
export function withFiltering<T extends ModelCollection>(list: T, filterer: Function = identity): FilteredModelCollection & T {

    let filterFn: Function = filterer;

    function items() {
        return filter(list.items(), filterFn);
    }

    function filterBy(fn: Function) {
        filterFn = fn;
        list.fire(Events.FILTER_CHANGED);
    }

    return {
        ...list,
        ...mixin(items),
        filterBy,
    };

}

/**
 * Applies grouping logic to the specified ModelCollection's items.
 *
 * @param list The ModelCollection instance to adapt.
 * @param grouper Optional arguments to pass to lodash's groupBy
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#groupBy _.groupBy}
 * @returns A ModelCollection with added grouping logic.
 * @example
 * ```js
 * import { getNotificationsList } from '../models/notifications';
 *
 * export async function groupNotifications() {
 *   // wrap an existing ModelCollection
 *   const list = await getNotificationsList();
 *   return models.utils.withGrouping(list, ['status']);
 * }
 * ```
 * @example
 * ```js
 * import { cond, conforms, constant, stubTrue } from 'lodash';
 * import { getClientList } from '../models/client';
 *
 * const lessThan = (max) => (num) => num < max;
 *
 * // function that buckets by employeeCount
 * const employeeBuckets = cond([
 *   [ conforms({ employeeCount: lessThan(10) }), constant('small')  ],
 *   [ conforms({ employeeCount: lessThan(20) }), constant('medium') ],
 *   [ stubTrue,                                  constant('large')  ]
 * ]);
 *
 * export async function getBucketedClientList() {
 *   const list = await getClientList();
 *   return models.utils.withGrouping(list, employeeBuckets);
 * }
 *
 * // CONSUMER:
 * const clients = await getBucketedClientList();
 * clients.groups(); // { small: [...], medium: [...], large: [...] }
 *
 * clients.groupBy(['region']);
 * clients.groups(); // { 'east': [...], 'north': [...], 'south': [...] }
 * ```
 */
export function withGrouping<T extends ModelCollection>(list: T, grouper: any = identity): GroupedModelCollection & T {

    let groupFn: any = grouper;

    function setGroupBy(fn?: any) {
        groupFn = fn;
        list.fire(Events.GROUP_CHANGED);
    }

    function groups() {
        return groupBy(list.items(), groupFn);
    }

    return {
        ...list,
        groups,
        groupBy: setGroupBy
    };

}

/**
 * Adds "active item" tracking and navigation to an existing {@link ModelCollection} instance.
 *
 * @param list The model list to add active item tracking and navigation to.
 * @returns A ModelCollection with active item tracking and navigation.
 * @example
 * ```js
 * const list = models.utils.withActive(models.collection(1, 2, 3));
 *
 * list.on('active-change', (current, previous) => {
 *   console.log('activating', current);
 *   console.log('deactivating', previous);
 * });
 *
 * list.active(); // 1
 * list.next(); // 2
 * list.prev(); // 1
 * list.active(3); // 3
 * list.next(true); // 1
 * ```
 */
export function withActive<T extends ModelCollection>(list: T): ActiveModelCollection & T {

    let item: any = null,
        lastIndex = -1,
        atStart = true,
        atEnd = true;

    function active(element: any): any {
        const items = list.items();
        const index = items.indexOf(element);
        if (index >= 0) {
            const curr = item;
            item = element;
            lastIndex = index;
            list.fire(Events.ACTIVE_CHANGED, item, curr);
        }
        return item;
    }

    function next(wrap = false): any {
        let index = lastIndex + 1;
        const items = list.items();
        if (index >= size(items)) {
            if (!wrap) return null;
            index = 0;
        }
        return active(items[index]);
    }

    function prev(wrap = false): any {
        let index = lastIndex - 1;
        const items = list.items();
        if (index < 0) {
            if (!wrap) return null;
            index = size(items) - 1;
        }
        return active(items[index]);
    }

    function activeChanged() {
        const length = size(list.items());
        atStart = lastIndex <= 0;
        atEnd = lastIndex === length - 1;
    }

    function updateActive() {
        const items = list.items();
        if (isEmpty(items)) {
            item = null;
            lastIndex = -1;
            atStart = atEnd = true;
        } else if (!items.includes(item)) {
            const length = size(items);
            const index = Math.min(Math.max(0, lastIndex), length - 1);
            active(items[index]);
        }
    }

    list.on('active-change', activeChanged);
    list.on('items-add', updateActive);
    list.on('items-remove', updateActive);
    list.on('filter-change', updateActive);

    active(head(list.items()));

    return Object.defineProperties({
        ...list,
        next,
        prev,
        active,
        atEnd,
        atStart,
    }, {
        atEnd: readonly(() => atEnd),
        atStart: readonly(() => atStart)
    });

}

/**
 * Adds selection tracking to an existing {@link ModelCollection} instance.
 *
 * @param list The model list to add selection tracking to.
 * @returns A ModelCollection with selection capabilities.
 * @example
 * ```js
 * const list = models.utils.withSelection(models.collection(1, 2, 3));
 *
 * list.selected(); // []
 * list.toggle();   // [1, 2, 3]
 * list.toggle(2);  // [1, 3]
 * list.selected(3) // [3]
 *
 * list.on('selection-change', (selection) => {
 *   console.log('selection changed', selection);
 * });
 *
 * list.selected(1); // "selection changed [1]"
 * list.toggle(); // "selection changed [1, 2, 3]"
 * ```
 */
export function withSelection<T extends ModelCollection>(list: T): SelectionModelCollection & T {

    let selection: any = [];

    const isNotOneOf = negate(isOneOf);

    function isOneOf(item: any): boolean {
        return this.includes(item);
    }

    function selected(...elements: any[]): any[] {
        let result = selection.slice();
        const intersection = list.items()
            .filter(isOneOf, elements);
        if (!isEmpty(intersection) || !isEmpty(elements)) {
            const prev = result;
            selection = intersection;
            result = selection.slice();
            list.fire(Events.SELECTION_CHANGED, result, prev);
        }
        return result;
    }

    function toggle(...elements: any[]): any[] {
        if (isEmpty(elements)) {
            const items = list.items();
            if (size(selection) !== size(items)) {
                return selected(...items); // select all
            }
            return selected('\0'); // deselect all
        }
        const toRemove = elements.filter(isOneOf, selection);
        const toAdd = elements.filter(isNotOneOf, toRemove);
        const toKeep = selection.filter(isNotOneOf, toRemove);
        const select = toKeep.concat(toAdd);
        return selected(...select); // toggle
    }

    function updateSelection() {
        selected(...selection);
    }

    list.on('items-remove', updateSelection);
    list.on('filter-change', updateSelection);

    return {
        ...list,
        toggle,
        selected
    };

}

/**
 * Adds paging to an existing {@link ModelCollection} instance.
 *
 * @param list The model list to add paging to.
 * @param size The number of items to show on each page.
 * @returns A ModelCollection with paging capabilities.
 * @example
 * ```js
 * // paging over a filtered list
 *
 * // order matters! filter first, then page:
 * const list = models.utils.withPaging(
 *   models.utils.withFiltering(
 *     models.collection()));
 *
 * list.pageSize(2);
 * list.add(1, 2, 3, 4, 5);
 * console.log(list.pageCount); // 3
 *
 * const isOdd = num => num % 2;
 * list.filterBy(isOdd);
 * console.log(list.pageCount); // 2
 *
 * list.add(6, 7, 8, 9, 10);
 * console.log(list.pageCount); // 3
 *
 * console.log(list.pageIndex()); // 0
 * console.log(list.items()); // [1, 3]
 *
 * list.nextPage();
 * console.log(list.items()); // [5, 7]
 * ```
 */
export function withPaging<T extends ModelCollection>(list: T, num = 50): PagedModelCollection & T {

    let count = num,
        index = 0,
        numPages = 0;

    function pageSize(number: number): number {
        if (isNumber(number)) {
            count = number;
            updatePageIndex();
        }
        return count;
    }

    function items(): any[] {
        const start = index * count;
        return list.items().slice(start, start + count);
    }

    function nextPage(): number {
        return pageIndex(index + 1);
    }

    function prevPage(): number {
        return pageIndex(index - 1);
    }

    function pageIndex(i: number): number {
        if (!isNumber(i)) return index;
        const prev = index;
        index = Math.max(0, Math.min(i, numPages - 1));
        prev !== index && list.fire(Events.PAGE_CHANGED, index);
        return index;
    }

    function updatePageIndex() {
        numPages = Math.ceil(size(list.items()) / count);
        pageIndex(index);
    }

    function followActiveItem(active: any) {
        const original = list.items();
        const activeIndex = original.indexOf(active);
        const newPageIndex = Math.floor(activeIndex / count);
        pageIndex(newPageIndex);
    }

    updatePageIndex();

    list.on('items-add', updatePageIndex);
    list.on('items-remove', updatePageIndex);
    list.on('filter-change', updatePageIndex);
    list.on('active-change', followActiveItem);

    return Object.defineProperties({
        ...list,
        ...mixin(items),
        pageSize,
        nextPage,
        prevPage,
        pageIndex,
        pageCount: numPages,
    }, {
        pageCount: readonly(() => numPages)
    });

}

/**
 * Applies a uniqueness constraint to the specified {@link ModelCollection}.
 *
 * @param list The ModelCollection instance to apply the uniqueness constraint to.
 * @param iteratee Optional key selector to use for uniqueness.
 * @returns A ModelCollection with a uniqueness constraint.
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#uniqBy _.uniqBy}
 * @example
 * ```js
 * import { getUsers } from '../data/users';
 *
 * export async function getUsersList() {
 *   const users = await getUsers();
 *   const userList = models.collection(...users);
 *   // NOTE: we can use lodash iteratee shortcuts for our selector; see
 *   // https://lodash.com/docs/4.17.11#iteratee for more information.
 *   return models.utils.withUnique(userList, 'username');
 * }
 * ```
 */
export function withUnique<T extends ModelCollection>(list: T, selector: any = identity): UniqueModelCollection & T {

    let unique: any = selector;

    function uniqueBy(fnUniqBy: any) {
        unique = fnUniqBy;
        list.fire(Events.UNIQUE_CHANGED);
    }

    function items() {
        return uniqBy(list.items(), unique);
    }

    return {
        ...list,
        ...mixin(items),
        uniqueBy,
    };

}

/**
 * Adds methods to update the underlying collection based on a new collection.
 *
 * **NOTE:** This wrapper uses {@link withUnique}
 * to ensure that only 1 instance of an item is present in the underlying collection.
 *
 * @param list The ModelCollection to add updating functionality to.
 * @param selector The key selector to use to uniquely
 * identify elements in the collection.
 * @returns A ModelCollection that has various methods
 * you can invoke to update the underlying collection based on a new collection.
 * @see {@link https://lodash.com/docs/4.17.11#iteratee iteratee} and {@link https://lodash.com/docs/4.17.11#uniqBy uniqBy}
 * @example
 * ```js
 * import { getUsers } from '../data/users';
 *
 * export async function getUsersList() {
 *   const users = await getUsers();
 *   const userList = models.collection(...users);
 *   // NOTE: we can use lodash iteratee shortcuts for our selector; see
 *   // https://lodash.com/docs/4.17.11#iteratee for more information.
 *   return models.utils.withUpdating(userList, 'username');
 * }
 *
 * // USAGE:
 * const list = await getUsersList();
 * const currentUsers = await getUsers(); // maybe on a poll
 * list.merge(...currentUsers);
 * ```
 */
export function withUpdating<T extends ModelCollection>(list: T, selector: any = identity): UpdatingModelCollection & T {

    const inner = withUnique(list, selector);

    function merge(...items: any[]) {
        const toRemove = differenceBy(inner.items(), items, selector);
        inner.remove(...toRemove);
        upsert(...items);
    }

    function upsert(...items: any[]) {
        const toAdd = differenceBy(items, inner.items(), selector);
        const toUpdate = intersectionBy(inner.items(), items, selector);
        inner.add(...toAdd);
        if (!isEmpty(toUpdate)) {
            inner.stop();
            const modified = intersectionBy(items, toUpdate, selector);
            inner.remove(...toUpdate);
            inner.add(...modified);
            inner.resume();
            inner.fire(Events.ITEMS_UPDATED, modified);
        }
    }

    return {
        ...inner,
        merge,
        upsert
    };

}
