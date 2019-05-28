import head from 'lodash/head';
import size from 'lodash/size';
import orderBy from 'lodash/orderBy';
import groupBy from 'lodash/groupBy';
import filter from 'lodash/filter';
import isEmpty from 'lodash/isEmpty';
import isNumber from 'lodash/isNumber';
import identity from 'lodash/identity';
import uniqBy from 'lodash/uniqBy';
import differenceBy from 'lodash/differenceBy';
import intersectionBy from 'lodash/intersectionBy';
import negate from 'lodash/negate';

import { eventBus } from '../index';

/**
 * Provides utilities for working with collections of structured data.
 * Simplifies and standardizes support for common UI and business logic
 * surrounding data collections. You can easily extend functionality by
 * combining existing wrappers or by writing your own.
 *
 * @module models
 * @example
 * import { createRequest, fetch } from '~/path/to/data';
 * import { modelList, withOrdering } from '@paychex/core/models';
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
 *   const reportList = modelList(...response.data);
 *   // order reports newest first and then by name
 *   return withOrdering(reportList, ['date', 'name'], ['desc', 'asc']);
 * }
 */

function getIterator(items) {
    return function* iterator() {
        for (let item of items()) {
            yield item;
        }
    };
}

function mixin(items) {
    return {
        items,
        [Symbol.iterator]: getIterator(items)
    };
}

function removeFrom(element) {
    const { elements, removed } = this;
    const included = elements.includes(element);
    included && removed.push(element);
    return !included;
}

function readonly(getter) {
    return {
        get: getter,
        enumerable: true,
    };
}

/**
 * Fired when items are added to the ModelList.
 *
 * @event ModelList~items-add
 * @type {any[]}
 * @example
 * import { modelList } from '@paychex/core/models';
 *
 * const list = modelList();
 *
 * list.on('items-add', (items) => {
 *   console.log('new items added:', items);
 * });
 *
 * list.add(1, 2, 3); // "new items added: [1, 2, 3]"
 */

/**
 * Fired when items are removed from the ModelList.
 *
 * @event ModelList~items-remove
 * @type {any[]}
 * @example
 * import { modelList } from '@paychex/core/models';
 *
 * const list = modelList(1, 2, 3);
 *
 * list.on('items-remove', (items) => {
 *   console.log('items removed:', items);
 * });
 *
 * list.remove(2, 3); // "items removed: [2, 3]"
 */

/**
 * Fired when a new uniqueness method is specified.
 *
 * @event ModelList~UniqueModelList~unique-change
 * @type {undefined}
 * @example
 * import { modelList, withUnique } from '@paychex/core/models';
 *
 * const list = withUnique(modelList(1.0, 1.5, 2.0));
 *
 * list.on('unique-change', () => {
 *   console.log('items:', list.items());
 * });
 *
 * list.uniqueBy(Math.floor); // "items: [1.0, 2.0]"
 */

/**
 * Fired when {@link ModelList~OrderedModelList#orderBy orderBy} is invoked.
 *
 * @event ModelList~OrderedModelList~order-change
 * @type {undefined}
 * @example
 * import { modelList, withOrdering } from '@paychex/core/models';
 *
 * const list = withOrdering(modelList());
 *
 * list.on('order-change', () => {
 *   console.log('order changed');
 * });
 *
 * list.add(1, 2, 3);
 * list.orderBy([], ['desc']); // "order changed"
 */

/**
 * Fired when {@link ModelList~FilteredModelList#filterBy filterBy} is invoked.
 *
 * @event ModelList~FilteredModelList~filter-change
 * @type {undefined}
 * @example
 * import { modelList, withFiltering } from '@paychex/core/models';
 *
 * const list = withFiltering(modelList());
 * const isOdd = num => num % 2;
 *
 * list.on('filter-change', () => {
 *   console.log('filter changed');
 * });
 *
 * list.add(1, 2, 3);
 * list.filterBy(isOdd); // "filter changed"
 */

/**
 * Fired when {@link ModelList~GroupedModelList#groupBy groupBy} is invoked.
 *
 * @event ModelList~GroupedModelList~group-change
 * @type {undefined}
 * @example
 * import { modelList, withGrouping } from '@paychex/core/models';
 * import { users } from '../data/users';
 *
 * const list = withGrouping(modelList());
 *
 * list.on('group-change', () => {
 *   console.log('group changed');
 * });
 *
 * list.add(...users);
 * list.groupBy(['region']); // "group changed"
 */

/**
 * Fired when the currently active item changes.
 *
 * @event ModelList~ActiveModelList~active-change
 * @type {any}
 * @example
 * import { modelList, withActive } from '@paychex/core/models';
 * import { users } from '../data/users';
 *
 * const list = withActive(modelList());
 *
 * list.on('active-change', (curr, prev) => {
 *   console.log('active changed from', prev, 'to', curr);
 * });
 *
 * list.add(1, 2, 3);
 * list.active(2); // "active changed from 1 to 2"
 */

/**
 * Fired when the selected items have changed.
 *
 * @event ModelList~SelectionModelList~selection-change
 * @type {any[]}
 * @example
 * import { modelList, withSelection } from '@paychex/core/models';
 * import { users } from '../data/users';
 *
 * const list = withSelection(modelList());
 *
 * list.on('selection-change', (selected) => {
 *   console.log('selection changed', selected);
 * });
 *
 * list.add(1, 2, 3);
 * list.selected(); // []
 * list.selected(2, 3); // "selection changed [2, 3]"
 */

/**
 * Fired when the current page has changed.
 *
 * @event ModelList~PagedModelList~page-change
 * @type {number}
 * @example
 * import { modelList, withPaging } from '@paychex/core/models';
 * import { users } from '../data/users';
 *
 * const list = withPaging(modelList(), 2);
 *
 * list.on('page-change', (pageIndex) => {
 *   console.log('page changed', pageIndex);
 * });
 *
 * list.add(...users);
 * list.nextPage(); // "page changed 1"
 * list.prevPage(); // "page changed 0"
 */

/**
 * Fired when one or more items in the collection were
 * updated during an {@link ModelList~UpdatingModelList#upsert upsert}
 * or {@link ModelList~UpdatingModelList#merge merge} operation.
 *
 * @event ModelList~UpdatingModelList~items-update
 * @type {any[]}
 * @example
 * import { modelList, withUpdating } from '@paychex/core/models';
 * import { newUsers, allUsers, activeUsers } from '../data/users';
 *
 * const list = withUpdating(modelList(), 'username');
 *
 * list.on('items-update', (modified) => {
 *   console.log('users updated', modified);
 * });
 *
 * list.add(...newUsers);
 * list.upsert(...allUsers);
 * list.merge(...activeUsers);
 */

/**
 * @global
 * @interface ModelList
 * @mixes EventBus
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { createRequest, fetch } from '~/path/to/data';
 *
 * import { loadClientData } from '../data';
 *
 * export async function createClientDataModel(client) {
 *   const request = createRequest(loadClientData, { client });
 *   const response = await fetch(request);
 *   return modelList(...response.data); // spread values
 * }
 */

/**
 * Adds items to the ModelList.
 *
 * @method ModelList#add
 * @param {...any} [items] The items to add to the ModelList.
 * @fires ModelList~items-add
 * @example
 * import { modelList } from '@paychex/core/models';
 *
 * const list = modelList(1, 2, 3);
 * list.add(4, 5, 6);
 * console.log(list.items()); // [1, 2, 3, 4, 5, 6]
 */

/**
 * Removes items from the ModelList.
 *
 * @method ModelList#remove
 * @param {...any} [items] The items to remove from the ModelList.
 * @fires ModelList~items-remove
 * @example
 * import { modelList } from '@paychex/core/models';
 *
 * const list = modelList(1, 2, 3);
 * list.add(4, 5, 6);
 * list.remove(5, 1);
 * console.log(list.items()); // [2, 3, 4, 6]
 */

/**
 * Removes all items from the ModelList.
 *
 * @method ModelList#clear
 * @fires ModelList~items-remove
 * @example
 * import { modelList } from '@paychex/core/models';
 *
 * const list = modelList(1, 2, 3);
 * list.add(4, 5, 6);
 * console.log(list.items()); // [1, 2, 3, 4, 5, 6]
 * list.clear();
 * console.log(list.items()); // []
 */

/**
 * The set of items in the ModelList.
 *
 * **NOTE:** Returns a shallow copy of the underlying collection. That
 * means the array returned can be mutated without affecting the real
 * ModelList, but all the items in the array are the same by reference,
 * so mutating an object in the collection will also mutate the object
 * stored in the ModelList.
 *
 * @method ModelList#items
 * @example
 * import { modelList, withOrdering } from '@paychex/core/models';
 *
 * let list = modelList(1, 2, 3);
 * list.add(4, 5, 6);
 * console.log(list.items()); // [1, 2, 3, 4, 5, 6]
 * list = withOrdering(list, [], ['desc']);
 * console.log(list.items()); // [6, 5, 4, 3, 2, 1]
 */

/**
 * Creates a new {@link ModelList} instance.
 *
 * @function
 * @param {...any} [elements] Optional items to add to the collection.
 * @returns {ModelList} A new ModelList instance
 * @example
 * import { modelList } from '@paychex/core/models';
 *
 * export const emptyModel = modelList();
 * export const filledModel = modelList(1, 2, 3);
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { createRequest, fetch } from '~/path/to/data';
 *
 * import { loadClientData } from '../data';
 *
 * export async function createClientDataModel(client) {
 *   const request = createRequest(loadClientData, { client });
 *   const response = await fetch(request);
 *   return modelList(...response.data); // spread values
 * }
 */
export function modelList(...elements) {

    let collection = [];

    const list = {};
    const bus = eventBus(list);

    function items() {
        return collection.slice();
    }

    function add(...elements) {
        collection = collection.concat(elements);
        isEmpty(elements) || bus.fire('items-add', elements);
    }

    function remove(...elements) {
        const removed = [];
        collection = collection.filter(removeFrom, { elements, removed });
        isEmpty(removed) || bus.fire('items-remove', removed);
    }

    function clear() {
        const removed = items();
        collection.length = 0;
        isEmpty(removed) || bus.fire('items-remove', removed);
    }


    add(...elements);

    return Object.assign(list, {
        add,
        remove,
        clear,
        ...mixin(items),
        ...bus
    });

}

/**
 * Adds ordering functionality to an existing {@link ModelList} instance.
 *
 * @interface ModelList~OrderedModelList
 * @mixes ModelList
 */

/**
 * Orders the internal ModelList collection using the information provided.
 *
 * @method ModelList~OrderedModelList#orderBy
 * @param {iteratee[]} [iteratees=[identity]] Optional iteratees to use as selector functions.
 * @param {Array<'asc'|'desc'>} [orders=['asc']] Optional sort orders to use for each selector value.
 * @fires ModelList~OrderedModelList~order-change
 * @example
 * import { modelList, withOrdering } from '@paychex/core/models';
 *
 * const list = modelList(1, 2, 3, 4, 5, 6);
 *
 * list = withOrdering(list, [], ['desc']);
 * list.items(); // [6, 5, 4, 3, 2, 1]
 *
 * list.orderBy(); // identity ascending
 * list.items(); // [1, 2, 3, 4, 5, 6];
 *
 * list.orderBy(num => num % 3);
 * list.items(); // [3, 6, 1, 4, 2, 5];
 * @example
 * import { modelList, withOrdering } from '@paychex/core/models';
 * import { loadNotifications } from '../data/notifications';
 *
 * export async function getNotificationsList() {
 *   const notifications = await loadNotifications();
 *   const list = withOrdering(modelList(notifications));
 *   list.orderBy(['priority', 'date', 'subject'], ['desc', 'desc', 'asc']);
 *   return list;
 * }
 */

/**
 * Orders the specified {@link ModelList} items. You can order
 * using multiple selector functions and specify a different sort
 * order for each selector.
 *
 * @function
 * @param {ModelList} list The ModelList instance to adapt.
 * @param {...any[]} [args] Optional arguments to pass to lodash's orderBy method.
 * @returns {ModelList~OrderedModelList} A ModelList with ordering functionality.
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#orderBy _.orderBy}
 * @example
 * import { modelList, withOrdering } from '@paychex/core/models';
 * import { getClientData } from '../data';
 *
 * export async function getClientList() {
 *   const clients = await getClientData();
 *   const list = modelList(...clients);
 *   const date = (client) => Date.parse(client.dateModified);
 *   // order by branch name ascending and then date modified descending...
 *   // NOTE: we can use lodash iteratee shortcuts for our accessors; see
 *   // https://lodash.com/docs/4.17.11#iteratee for more information.
 *   return withOrdering(list, ['branch', date], ['asc', 'desc']);
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
 */
export function withOrdering(list, ...args) {

    let orderArgs = args;

    function _setOrderBy(...args) {
        orderArgs = args;
        list.fire('order-change');
    }

    function items() {
        return orderBy(list.items(), ...orderArgs);
    }

    return {
        ...list,
        ...mixin(items),
        orderBy: _setOrderBy,
    };

}

/**
 * Returns a boolean value given the specified inputs.
 *
 * @global
 * @callback ModelListPredicate
 * @param {any} value The incoming value.
 * @param {number|string} key The key or index of the value in the collection.
 * @param {Array} collection The collection the value came from.
 * @returns {boolean} true or false
 * @see {@link ModelList~FilteredModelList#filterBy ModelList filterBy example}
 */

/**
 * Adds filtering functionality to an existing {@link ModelList} instance.
 *
 * @interface ModelList~FilteredModelList
 * @mixes ModelList
 */

/**
 * Filters the underlying items in the ModelList collection.
 *
 * @method ModelList~FilteredModelList#filterBy
 * @param {ModelListPredicate} [filterer=identity] The filter logic to apply.
 * @fires ModelList~FilteredModelList~filter-change
 * @example
 * import { withFiltering } from '@paychex/core/models';
 * import { getNotificationsList } from '../models/notifications';
 *
 * export async function getUnreadNotifications() {
 *   // wrap an existing ModelList
 *   const list = await getNotificationsList();
 *   return withFiltering(list, ['unread']);
 * }
 * @example
 * import { modelList, withFiltering } from '@paychex/core/models';
 *
 * const isOdd = num => num % 2;
 * const list = withFiltering(modelList(), isOdd);
 *
 * list.add(1, 2, 3, 4, 5);
 * list.items(); // [1, 3, 5]
 *
 * list.filterBy(); // reset filtering
 * list.items(); // [1, 2, 3, 4, 5]
 */

/**
 * Filters the specified ModelList's items.
 *
 * @function
 * @param {ModelList} list The ModelList instance to adapt.
 * @param {ModelListPredicate} [filterer=identity] The filter logic to apply.
 * @returns {ModelList~FilteredModelList} A ModelList with added filtering logic.
 * @example
 * import { withFiltering } from '@paychex/core/models';
 * import { getNotificationsList } from '../models/notifications';
 *
 * export async function getUnreadNotifications() {
 *   // wrap an existing ModelList
 *   const list = await getNotificationsList();
 *   return withFiltering(list, ['unread']);
 * }
 * @example
 * import { modelList, withFiltering } from '@paychex/core/models';
 *
 * const isOdd = num => num % 2;
 * const list = withFiltering(modelList(), isOdd);
 *
 * list.add(1, 2, 3, 4, 5);
 * list.items(); // [1, 3, 5]
 *
 * list.filterBy(); // reset filtering
 * list.items(); // [1, 2, 3, 4, 5]
 */
export function withFiltering(list, filterer = identity) {

    let filterFn = filterer;

    function items() {
        return filter(list.items(), filterFn);
    }

    function filterBy(fn) {
        filterFn = fn;
        list.fire('filter-change');
    }

    return {
        ...list,
        ...mixin(items),
        filterBy,
    };

}

/**
 * Adds grouping functionality to an existing {@link ModelList} instance.
 *
 * @interface ModelList~GroupedModelList
 * @mixes ModelList
 */

/**
 * Groups the underlying items in the ModelList collection.
 *
 * @method ModelList~GroupedModelList#groupBy
 * @param {Function} [grouper=identity] The grouping logic to apply.
 * @fires ModelList~GroupedModelList~group-change
 * @example
 * import { withGrouping } from '@paychex/core/models';
 * import { getNotificationsList } from '../models/notifications';
 *
 * export async function groupNotifications() {
 *   // wrap an existing ModelList
 *   const list = await getNotificationsList();
 *   return withGrouping(list, ['status']);
 * }
 * @example
 * import { cond, conforms, constant, stubTrue } from 'lodash';
 * import { modelList, withGrouping } from '@paychex/core/models';
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
 *   return withGrouping(list, employeeBuckets);
 * }
 *
 * // CONSUMER:
 * const clients = await getBucketedClientList();
 * clients.groups(); // { small: [...], medium: [...], large: [...] }
 *
 * clients.groupBy(['region']);
 * clients.groups(); // { 'east': [...], 'north': [...], 'south': [...] }
 */

/**
 * Returns the groups from the underlying collection. Groups are returned
 * as an object whose keys are the group names; each value is an array of
 * the objects belonging to that group.
 *
 * @method ModelList~GroupedModelList#groups
 * @returns {Array<string, any[]>} The grouped objects.
 * @example
 * import { withGrouping } from '@paychex/core/models';
 * import { getNotificationsList } from '../models/notifications';
 *
 * export async function groupNotifications() {
 *   // wrap an existing ModelList
 *   const list = await getNotificationsList();
 *   return withGrouping(list, ['status']);
 * }
 *
 * // CONSUMER:
 * const notifications = groupNotifications();
 * notifications.groups(); // { 'read': [...], 'unread': [...] }
 */

/**
 * Applies grouping logic to the specified ModelList's items.
 *
 * @function
 * @param {ModelList} list The ModelList instance to adapt.
 * @param {Function} [grouper=identity] The grouping logic to apply.
 * @returns {ModelList~GroupedModelList} A ModelList with added filtering logic.
 * @example
 * import { withGrouping } from '@paychex/core/models';
 * import { getNotificationsList } from '../models/notifications';
 *
 * export async function groupNotifications() {
 *   // wrap an existing ModelList
 *   const list = await getNotificationsList();
 *   return withGrouping(list, ['status']);
 * }
 * @example
 * import { cond, conforms, constant, stubTrue } from 'lodash';
 * import { modelList, withGrouping } from '@paychex/core/models';
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
 *   return withGrouping(list, employeeBuckets);
 * }
 *
 * // CONSUMER:
 * const clients = await getBucketedClientList();
 * clients.groups(); // { small: [...], medium: [...], large: [...] }
 *
 * clients.groupBy(['region']);
 * clients.groups(); // { 'east': [...], 'north': [...], 'south': [...] }
 */
export function withGrouping(list, grouper = identity) {

    let groupFn = grouper;

    function _setGroupBy(fn) {
        groupFn = fn;
        list.fire('group-change');
    }

    function groups() {
        return groupBy(list.items(), groupFn);
    }

    return {
        ...list,
        groups,
        groupBy: _setGroupBy
    };

}

/**
 * Adds "active item" tracking and navigation to an existing {@link ModelList} instance.
 *
 * **Note on Grouping**: If you want to navigate through a grouped list, you may want
 * to ensure an order has been applied beforehand. Use {@link module:models.withOrdering withOrdering}
 * and ensure your array of iteratees starts with your group selector. This ensures that
 * navigating through the list correctly moves between groups.
 *
 * @interface ModelList~ActiveModelList
 * @mixes ModelList
 * @listens ModelList~event:items-add
 * @listens ModelList~event:items-remove
 * @listens ModelList~FilteredModelList~event:filter-change
 * @listens ModelList~ActiveModelList~event:active-change
 */

/**
 * Gets or sets the current active item in the list.
 * **NOTE:** Only currently available items can be activated. For example, if you
 * are using {@link module:models.withFiltering withFiltering} then items which
 * have been filtered out can not be activated.
 *
 * @method ModelList~ActiveModelList#active
 * @param {any} [item] The item to activate. Must be present in the current list.
 * To retrieve the currently active item, do not pass any arguments.
 * @returns {any} The currently active item.
 * @fires ModelList~ActiveModelList~active-change
 * @example
 * import { modelList, withActive } from '@paychex/core/models';
 *
 * const list = withActive(modelList(1, 2, 3));
 *
 * console.log(list.active());  // 1
 * console.log(list.active(2)); // 2
 * console.log(list.active(5)); // 2
 */

/**
 * @method ModelList~ActiveModelList#next
 * @param {boolean} [wrap=false] Whether to wrap back to the start of the
 * list if the currently active item is the last item.
 * @returns {any} The newly activated item, or `null` if at end of list
 * and `wrap` is not truthy.
 * @example
 * import { modelList, withActive } from '@paychex/core/models';
 *
 * const list = withActive(modelList(1, 2, 3));
 * list.active(2);
 * list.next(); // 3
 * list.next(); // null (at end of list)
 * list.next(true); // 1 (wraps to start)
 */

/**
 * @method ModelList~ActiveModelList#prev
 * @param {boolean} [wrap=false] Whether to wrap back to the end of the
 * list if the currently active item is the first item.
 * @returns {any} The newly activated item, or `null` if at start of list
 * and `wrap` is not truthy.
 * @example
 * import { modelList, withActive } from '@paychex/core/models';
 *
 * const list = withActive(modelList(1, 2, 3));
 * list.active(2);
 * list.prev(); // 1
 * list.prev(); // null (at start of list)
 * list.prev(true); // 3 (wraps to end)
 */

/**
 * Returns `true` if the currently active item is the last item in the list.
 *
 * @member ModelList~ActiveModelList#atEnd
 * @type {boolean}
 * @readonly
 * @example
 * import { modelList, withActive } from '@paychex/core/models';
 *
 * const list = withActive(modelList(1, 2, 3));
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
 */

/**
 * Returns `true` if the currently active item is the first item in the list.
 *
 * @member ModelList~ActiveModelList#atStart
 * @type {boolean}
 * @readonly
 * @example
 * import { modelList, withActive } from '@paychex/core/models';
 *
 * const list = withActive(modelList(1, 2, 3));
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
 */

/**
 * Adds "active item" tracking and navigation to an existing {@link ModelList} instance.
 *
 * @function
 * @param {ModelList} list The model list to add active item tracking and navigation to.
 * @returns {ModelList~ActiveModelList} A ModelList with active item tracking and navigation.
 * @example
 * import { modelList, withActive } from '@paychex/core/models';
 *
 * const list = withActive(modelList(1, 2, 3));
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
 */
export function withActive(list) {

    let item = null,
        lastIndex = -1,
        atStart = true,
        atEnd = true;

    function active(element) {
        const items = list.items();
        const index = items.indexOf(element);
        if (index >= 0) {
            const prev = item;
            item = element;
            lastIndex = index;
            list.fire('active-change', item, prev);
        }
        return item;
    }

    function next(wrap = false) {
        let index = lastIndex + 1;
        const items = list.items();
        if (index >= size(items)) {
            if (!wrap) return null;
            index = 0;
        }
        return active(items[index]);
    }

    function prev(wrap = false) {
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
        active
    }, {
        atEnd: readonly(() => atEnd),
        atStart: readonly(() => atStart)
    });

}

/**
 * Tracks which items within the wrapped {@link ModelList} instance
 * are selected at any given time. **NOTE:** Items which are not
 * available through the wrapped ModelList can not be selected.
 *
 * @interface ModelList~SelectionModelList
 * @mixes ModelList
 * @listens ModelList~event:items-remove
 * @listens ModelList~FilteredModelList~event:filter-change
 */

/**
 * Gets or sets the currently selected items within the list.
 * **NOTE:** Only currently available items can be selected. For example, if you
 * are using {@link module:models.withFiltering withFiltering} then items which
 * have been filtered out can not be selected.
 *
 * @method ModelList~SelectionModelList#selected
 * @param {...any} [items] The items to select. Must be present in the current list.
 * To retrieve the currently selected items, do not pass any arguments.
 * @returns {any[]} The currently selected items.
 * @fires ModelList~SelectionModelList~selection-change
 * @example
 * import { modelList, withSelection } from '@paychex/core/models';
 *
 * const list = withSelection(modelList(1, 2, 3));
 *
 * list.selected();  // []
 * list.selected(2); // [2]
 * list.selected(2, 3); // [2, 3]
 */

/**
 * Select all, none, or some of the ModelList items, depending on which
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
 * @method ModelList~SelectionModelList#toggle
 * @param {...any} [items] The items to select or deselect. Must be present
 * in the current list. To select or deselect all items, pass no arguments.
 * @returns {any[]} The currently selected items.
 * @fires ModelList~SelectionModelList~selection-change
 * @example
 * import { modelList, withSelection } from '@paychex/core/models';
 *
 * const list = withSelection(modelList(1, 2, 3));
 *
 * list.selected(); // []
 * list.toggle(); // [1, 2, 3]
 * list.toggle(2); // [1, 3]
 * list.toggle(); // [1, 2, 3]
 * list.toggle(1, 2); // [3]
 */

/**
 * Adds selection tracking to an existing {@link ModelList} instance.
 *
 * @function
 * @param {ModelList} list The model list to add selection tracking to.
 * @returns {ModelList~SelectionModelList} A ModelList with selection capabilities.
 * @example
 * import { modelList, withSelection } from '@paychex/core/models';
 *
 * const list = withSelection(modelList(1, 2, 3));
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
 */
export function withSelection(list) {

    let selection = [];

    const isNotOneOf = negate(isOneOf);

    function isOneOf(item) {
        return this.includes(item);
    }

    function selected(...elements) {
        let result = selection.slice();
        const intersection = list.items()
            .filter(isOneOf, elements);
        if (!isEmpty(intersection) || !isEmpty(elements)) {
            const prev = result;
            selection = intersection;
            result = selection.slice();
            list.fire('selection-change', result, prev);
        }
        return result;
    }

    function toggle(...elements) {
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
 * Provides paging functionality to the wrapped {@link ModelList} instance.
 *
 * **Order of Operations:** Typically, you should call `withPaging` _after_
 * applying any other decorators. This ensures the underling `items` collection
 * represents the correct set of items when calculating page counts.
 *
 * **Note on Active Items:** If you apply paging to a {@link ModelList~ActiveModelList ActiveModelList}
 * created using the {@link module:models.withActive withActive} decorator, the
 * current page index will update automatically as you change the active item.
 *
 * @interface ModelList~PagedModelList
 * @mixes ModelList
 * @listens ModelList~event:items-add
 * @listens ModelList~event:items-remove
 * @listens ModelList~ActiveModelList~event:active-change
 * @listens ModelList~FilteredModelList~event:filter-change
 */

/**
 * Gets or sets the current page size (the number of items that
 * should be visible on each page.)
 *
 * @method ModelList~PagedModelList#pageSize
 * @param {number} [size] The number of items to show on each page.
 * Pass no arguments to retrieve the current page size.
 * @returns {number} The current page size.
 * @example
 * import { modelList, withPaging } from '@paychex/core/models';
 *
 * const list = withPaging(modelList());
 *
 * list.pageSize(); // 50 (default page size)
 *
 * list.pageSize(5); // 5
 * list.add(1, 2, 3, 4, 5, 6, 7, 8);
 * list.items(); // [1, 2, 3, 4, 5]
 *
 * list.pageSize(3); // 3
 * list.items(); // [1, 2, 3]
 */

/**
 * Moves to the next page of items. Does nothing if called on the last page.
 *
 * @method ModelList~PagedModelList#nextPage
 * @returns {number} The new page index.
 * @fires ModelList~PagedModelList~page-change
 * @example
 * import { modelList, withPaging } from '@paychex/core/models';
 *
 * const list = withPaging(modelList(1, 2, 3, 4, 5));
 *
 * list.pageSize(2);
 * list.pageIndex(); // 0
 *
 * list.nextPage();  // 1
 * list.nextPage();  // 2
 * list.nextPage();  // 2 (stops on last page)
 */

/**
 * Moves to the previous page of items. Does nothing if called on the first page.
 *
 * @method ModelList~PagedModelList#prevPage
 * @returns {number} The new page index.
 * @fires ModelList~PagedModelList~page-change
 * @example
 * import { modelList, withPaging } from '@paychex/core/models';
 *
 * const list = withPaging(modelList(1, 2, 3, 4, 5));
 *
 * list.pageSize(2);
 * list.pageIndex(2); // start on last page
 *
 * list.prevPage();  // 1
 * list.prevPage();  // 0
 * list.prevPage();  // 0 (stops on first page)
 */

/**
 * Gets or sets the current page index (base 0). If outside the available bounds,
 * the given index will be clamped between 0 and {@link ModelList~PagedModelList#pageCount pageCount} - 1.
 *
 * @method ModelList~PagedModelList#pageIndex
 * @param {number} index The new page index.
 * @returns {number} The new page index.
 * @example
 * import { modelList, withPaging } from '@paychex/core/models';
 *
 * const list = withPaging(modelList(1, 2, 3, 4, 5));
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
 */

/**
 * Returns the number of pages based on the number of {@link ModelList#items items}
 * and the current {@link ModelList~PagedModelList#pageSize pageSize}.
 *
 * @member ModelList~PagedModelList#pageCount
 * @type {number}
 * @readonly
 * @example
 * import { modelList, withPaging } from '@paychex/core/models';
 *
 * const list = withPaging(modelList(1, 2, 3, 4));
 *
 * list.pageSize(10);
 * console.log(list.pageCount); // 1
 *
 * list.pageSize(2);
 * console.log(list.pageCount); // 2
 *
 * list.add(5);
 * console.log(list.pageCount); // 3
 * @example
 * // paging over a filtered list
 * import { modelList, withPaging, withFiltering } from '@paychex/core/models';
 *
 * // order matters! filter first, then page:
 * const list = withPaging(withFiltering(modelList()));
 *
 * list.pageSize(2);
 * list.add(1, 2, 3, 4, 5);
 * console.log(list.pageCount); // 3
 *
 * const isOdd = num => num % 2;
 * list.filterBy(isOdd);
 * console.log(list.pageCount); // 2
 */

/**
 * Adds paging to an existing {@link ModelList} instance.
 *
 * @function
 * @param {ModelList} list The model list to add paging to.
 * @param {number} [size=50] The number of items to show on each page.
 * @returns {ModelList~PagedModelList} A ModelList with paging capabilities.
 * @example
 * // paging over a filtered list
 * import { modelList, withPaging, withFiltering } from '@paychex/core/models';
 *
 * // order matters! filter first, then page:
 * const list = withPaging(withFiltering(modelList()));
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
 */
export function withPaging(list, num = 50) {

    let count = num,
        index = 0,
        numPages = 0;

    function pageSize(num) {
        if (isNumber(num)) {
            count = num;
            updatePageIndex();
        }
        return count;
    }

    function items() {
        const start = index * count;
        return list.items().slice(start, start + count);
    }

    function nextPage() {
        return pageIndex(index + 1);
    }

    function prevPage() {
        return pageIndex(index - 1);
    }

    function pageIndex(i) {
        if (!isNumber(i)) return index;
        const prev = index;
        index = Math.max(0, Math.min(i, numPages - 1));
        prev !== index && list.fire('page-change', index);
        return index;
    }

    function updatePageIndex() {
        numPages = Math.ceil(size(list.items()) / count);
        pageIndex(index);
    }

    function followActiveItem(active) {
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
    }, {
        pageCount: readonly(() => numPages)
    });

}

/**
 * Adds a uniqueness constraint to an existing {@link ModelList}'s items.
 *
 * @interface ModelList~UniqueModelList
 * @mixes ModelList
 */

/**
 * Applies a uniqueness constraint to the wrapped {@link ModelList} items.
 *
 * @method ModelList~UniqueModelList#uniqueBy
 * @param {iteratee} [iteratee=identity] Optional iteratee to use as a selector function.
 * @fires ModelList~UniqueModelList~unique-change
 * @example
 * import { modelList, withUnique } from '@paychex/core/models';
 *
 * const list = withUnique(modelList());
 *
 * list.add(1, 2, 3);
 * list.items(); // [1, 2, 3]
 *
 * list.add(1, 2, 2.5, 3, 4);
 * list.items(); // [1, 2, 2.5, 3, 4]
 *
 * list.uniqueBy(Math.floor);
 * list.items(); // [1, 2, 3, 4]
 */

/**
 * Applies a uniqueness constraint to the specified {@link ModelList}.
 *
 * @function
 * @param {ModelList} list The ModelList instance to apply the uniqueness constraint to.
 * @param {iteratee} [iteratee=identity] Optional key selector to use for uniqueness.
 * @returns {ModelList~UniqueModelList} A ModelList with a uniqueness constraint.
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#uniqBy _.uniqBy}
 * @example
 * import { modelList, withUnique } from '@paychex/core/models';
 * import { getUsers } from '../data/users';
 *
 * export async function getUsersList() {
 *   const users = await getUsers();
 *   const userList = modelList(...users);
 *   // NOTE: we can use lodash iteratee shortcuts for our selector; see
 *   // https://lodash.com/docs/4.17.11#iteratee for more information.
 *   return withUnique(userList, 'username');
 * }
 */
export function withUnique(list, selector = identity) {

    let unique = selector;

    function uniqueBy(fnUniqBy) {
        unique = fnUniqBy;
        list.fire('unique-change');
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
 * Adds methods to update a {@link ModelList}'s items based on a more current
 * collection of items.
 *
 * @interface ModelList~UpdatingModelList
 * @mixes ModelList~UniqueModelList
 */

/**
 * Adds or updates items in the underlying collection. Does _not_ remove any
 * existing items.
 *
 * @method ModelList~UpdatingModelList#upsert
 * @param {...any} [items] The items to add or update in the underlying collection.
 * @fires ModelList~items-add
 * @fires ModelList~UpdatingModelList~items-update
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee}
 * @example
 * import { modelList, withUpdating } from '@paychex/core/models';
 *
 * // our selector can use lodash iteratee
 * const list = withUpdating(modelList(), 'id');
 *
 * list.add({ id: 123, name: 'Alice' });
 * list.add({ id: 456, name: 'Bob' });
 *
 * // update the first entry, keeping the second entry
 * list.upsert({ id: 123, name: 'Alicia' });
 */

/**
 * Adds, updates, _and_ removes items in the underlying collection based on
 * the incoming items.
 *
 * @method ModelList~UpdatingModelList#merge
 * @param {...any} [items] The items to add or update in the underlying collection.
 * Any items in the existing collection that are _not_ in the incoming collection
 * will be removed.
 * @fires ModelList~items-add
 * @fires ModelList~items-remove
 * @fires ModelList~UpdatingModelList~items-update
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee}
 * @example
 * import { modelList, withUpdating } from '@paychex/core/models';
 *
 * // our selector can use lodash iteratee
 * const list = withUpdating(modelList(), 'id');
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
 */

/**
 * Adds methods to update the underlying collection based on a new collection.
 *
 * **NOTE:** This wrapper uses {@link module:models.withUnique withUnique}
 * to ensure that only 1 instance of an item is present in the underlying collection.
 *
 * @function
 * @param {ModelList} list The ModelList to add updating functionality to.
 * @param {iteratee} [selector=identity] The key selector to use to uniquely
 * identify elements in the collection.
 * @returns {ModelList~UpdatingModelList} A ModelList that has various methods
 * you can invoke to update the underlying collection based on a new collection.
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#uniqBy _.uniqBy}
 * @example
 * import { modelList, withUpdating } from '@paychex/core/models';
 * import { getUsers } from '../data/users';
 *
 * export async function getUsersList() {
 *   const users = await getUsers();
 *   const userList = modelList(...users);
 *   // NOTE: we can use lodash iteratee shortcuts for our selector; see
 *   // https://lodash.com/docs/4.17.11#iteratee for more information.
 *   return withUpdating(userList, 'username');
 * }
 *
 * // USAGE:
 * const list = await getUsersList();
 * const currentUsers = await getUsers(); // maybe on a poll
 * list.merge(...currentUsers);
 */
export function withUpdating(list, selector = identity) {

    function merge(...items) {
        const toRemove = differenceBy(list.items(), items, selector);
        list.remove(...toRemove);
        upsert(...items);
    }

    function upsert(...items) {
        const toAdd = differenceBy(items, list.items(), selector);
        const toUpdate = intersectionBy(list.items(), items, selector);
        list.add(...toAdd);
        if (!isEmpty(toUpdate)) {
            list.pause();
            const modified = intersectionBy(items, toUpdate, selector);
            list.remove(...toUpdate);
            list.add(...modified);
            list.resume();
            list.fire('items-update', modified);
        }
    }

    return {
        ...withUnique(list, selector),
        merge,
        upsert
    };

}
