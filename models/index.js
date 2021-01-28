import head from 'lodash/head.js';
import size from 'lodash/size.js';
import orderBy from 'lodash/orderBy.js';
import groupBy from 'lodash/groupBy.js';
import filter from 'lodash/filter.js';
import isEmpty from 'lodash/isEmpty.js';
import isNumber from 'lodash/isNumber.js';
import identity from 'lodash/identity.js';
import uniqBy from 'lodash/uniqBy.js';
import differenceBy from 'lodash/differenceBy.js';
import intersectionBy from 'lodash/intersectionBy.js';
import negate from 'lodash/negate.js';

import { eventBus } from '../index.js';

import {
    ModelList,
    ActiveModelList,
    OrderedModelList,
    FilteredModelList,
    GroupedModelList,
    SelectionModelList,
    PagedModelList,
    UniqueModelList,
    UpdatingModelList
} from '../types/models.js';

class UnusedModelList extends ModelList {}
class UnusedActiveModelList extends ActiveModelList {}
class UnusedOrderedModelList extends OrderedModelList {}
class UnusedFilteredModelList extends FilteredModelList {}
class UnusedGroupedModelList extends GroupedModelList {}
class UnusedSelectionModelList extends SelectionModelList {}
class UnusedPagedModelList extends PagedModelList {}
class UnusedUniqueModelList extends UniqueModelList {}
class UnusedUpdatingModelList extends UpdatingModelList {}

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
 * @event UniqueModelList~unique-change
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
 * Fired when {@link OrderedModelList#orderBy orderBy} is invoked.
 *
 * @event OrderedModelList~order-change
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
 * Fired when {@link FilteredModelList#filterBy filterBy} is invoked.
 *
 * @event FilteredModelList~filter-change
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
 * Fired when {@link GroupedModelList#groupBy groupBy} is invoked.
 *
 * @event GroupedModelList~group-change
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
 * @event ActiveModelList~active-change
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
 * @event SelectionModelList~selection-change
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
 * @event PagedModelList~page-change
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
 * updated during an {@link UpdatingModelList#upsert upsert}
 * or {@link UpdatingModelList#merge merge} operation.
 *
 * @event UpdatingModelList~items-update
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
 * Creates a new {@link ModelList} instance.
 *
 * @function
 * @param {...any} [items] Optional items to add to the collection.
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

    function add(...arr) {
        collection = collection.concat(arr);
        isEmpty(arr) || bus.fire('items-add', arr);
    }

    function remove(...arr) {
        const removed = [];
        collection = collection.filter(removeFrom, { elements: arr, removed });
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
 * Orders the specified {@link ModelList} items. You can order
 * using multiple selector functions and specify a different sort
 * order for each selector.
 *
 * @function
 * @param {ModelList} list The ModelList instance to adapt.
 * @param {...any} [args] Optional arguments to pass to lodash's orderBy method.
 * @returns {OrderedModelList} A ModelList with ordering functionality.
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

    function setOrderBy(...params) {
        orderArgs = params;
        list.fire('order-change');
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
 * Returns a boolean value given the specified inputs.
 *
 * @global
 * @callback ModelListPredicate
 * @param {any} value The incoming value.
 * @param {number|string} key The key or index of the value in the collection.
 * @param {Array} collection The collection the value came from.
 * @returns {boolean} true or false
 * @see {@link FilteredModelList#filterBy ModelList filterBy example}
 */

/**
 * Filters the specified ModelList's items.
 *
 * @function
 * @param {ModelList} list The ModelList instance to adapt.
 * @param {ModelListPredicate} [filterer=identity] The filter logic to apply.
 * @returns {FilteredModelList} A ModelList with added filtering logic.
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
 * Applies grouping logic to the specified ModelList's items.
 *
 * @function
 * @param {ModelList} list The ModelList instance to adapt.
 * @param {Function} [grouper=identity] The grouping logic to apply.
 * @returns {GroupedModelList} A ModelList with added filtering logic.
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

    function setGroupBy(fn) {
        groupFn = fn;
        list.fire('group-change');
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
 * Adds "active item" tracking and navigation to an existing {@link ModelList} instance.
 *
 * @function
 * @param {ModelList} list The model list to add active item tracking and navigation to.
 * @returns {ActiveModelList} A ModelList with active item tracking and navigation.
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
 * Adds selection tracking to an existing {@link ModelList} instance.
 *
 * @function
 * @param {ModelList} list The model list to add selection tracking to.
 * @returns {SelectionModelList} A ModelList with selection capabilities.
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
 * Adds paging to an existing {@link ModelList} instance.
 *
 * @function
 * @param {ModelList} list The model list to add paging to.
 * @param {number} [size=50] The number of items to show on each page.
 * @returns {PagedModelList} A ModelList with paging capabilities.
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
 * Applies a uniqueness constraint to the specified {@link ModelList}.
 *
 * @function
 * @param {ModelList} list The ModelList instance to apply the uniqueness constraint to.
 * @param {iteratee} [iteratee=identity] Optional key selector to use for uniqueness.
 * @returns {UniqueModelList} A ModelList with a uniqueness constraint.
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
 * Adds methods to update the underlying collection based on a new collection.
 *
 * **NOTE:** This wrapper uses {@link module:models.withUnique withUnique}
 * to ensure that only 1 instance of an item is present in the underlying collection.
 *
 * @function
 * @param {ModelList} list The ModelList to add updating functionality to.
 * @param {iteratee} [selector=identity] The key selector to use to uniquely
 * identify elements in the collection.
 * @returns {UpdatingModelList} A ModelList that has various methods
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

    const inner = withUnique(list, selector);

    function merge(...items) {
        const toRemove = differenceBy(inner.items(), items, selector);
        inner.remove(...toRemove);
        upsert(...items);
    }

    function upsert(...items) {
        const toAdd = differenceBy(items, inner.items(), selector);
        const toUpdate = intersectionBy(inner.items(), items, selector);
        inner.add(...toAdd);
        if (!isEmpty(toUpdate)) {
            inner.stop();
            const modified = intersectionBy(items, toUpdate, selector);
            inner.remove(...toUpdate);
            inner.add(...modified);
            inner.resume();
            inner.fire('items-update', modified);
        }
    }

    return {
        ...inner,
        merge,
        upsert
    };

}
