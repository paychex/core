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
} from 'lodash-es';

import {
    ModelCollection,
    ActiveModelCollection,
    OrderedModelCollection,
    FilteredModelCollection,
    GroupedModelCollection,
    SelectionModelCollection,
    PagedModelCollection,
    UniqueModelCollection,
    UpdatingModelCollection,
} from '../types/models.mjs';

import { mixin } from './shared.mjs';

class UnusedModelCollection extends ModelCollection { }
class UnusedActiveModelCollection extends ActiveModelCollection { }
class UnusedOrderedModelCollection extends OrderedModelCollection { }
class UnusedFilteredModelCollection extends FilteredModelCollection { }
class UnusedGroupedModelCollection extends GroupedModelCollection { }
class UnusedSelectionModelCollection extends SelectionModelCollection { }
class UnusedPagedModelCollection extends PagedModelCollection { }
class UnusedUniqueModelCollection extends UniqueModelCollection { }
class UnusedUpdatingModelCollection extends UpdatingModelCollection { }

function readonly(getter) {
    return {
        get: getter,
        enumerable: true,
    };
}

/**
 * Orders the specified {@link ModelCollection} items. You can order
 * using multiple selector functions and specify a different sort
 * order for each selector.
 *
 * @function
 * @param {ModelCollection} list The ModelCollection instance to adapt.
 * @param {...any} [args] Optional arguments to pass to lodash's orderBy method.
 * @returns {OrderedModelCollection} A ModelCollection with ordering functionality.
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#orderBy _.orderBy}
 * @example
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
 * @callback ModelCollectionPredicate
 * @param {any} value The incoming value.
 * @param {number|string} key The key or index of the value in the collection.
 * @param {Array} collection The collection the value came from.
 * @returns {boolean} true or false
 * @see {@link FilteredModelCollection#filterBy ModelCollection filterBy example}
 */

/**
 * Filters the specified ModelCollection's items.
 *
 * @function
 * @param {ModelCollection} list The ModelCollection instance to adapt.
 * @param {ModelCollectionPredicate} [filterer=identity] The filter logic to apply.
 * @returns {FilteredModelCollection} A ModelCollection with added filtering logic.
 * @example
 * import { getNotificationsList } from '../models/notifications';
 *
 * export async function getUnreadNotifications() {
 *   // wrap an existing ModelCollection
 *   const list = await getNotificationsList();
 *   return models.utils.withFiltering(list, ['unread']);
 * }
 * @example
 * const isOdd = num => num % 2;
 * const list = models.utils.withFiltering(models.collection(), isOdd);
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
 * Applies grouping logic to the specified ModelCollection's items.
 *
 * @function
 * @param {ModelCollection} list The ModelCollection instance to adapt.
 * @param {any} [grouper=identity] Optional arguments to pass to lodash's groupBy
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#groupBy _.groupBy}
 * @returns {GroupedModelCollection} A ModelCollection with added grouping logic.
 * @example
 * import { getNotificationsList } from '../models/notifications';
 *
 * export async function groupNotifications() {
 *   // wrap an existing ModelCollection
 *   const list = await getNotificationsList();
 *   return models.utils.withGrouping(list, ['status']);
 * }
 * @example
 * import { cond, conforms, constant, stubTrue } from 'lodash-es';
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
 * Adds "active item" tracking and navigation to an existing {@link ModelCollection} instance.
 *
 * @function
 * @param {ModelCollection} list The model list to add active item tracking and navigation to.
 * @returns {ActiveModelCollection} A ModelCollection with active item tracking and navigation.
 * @example
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
            const curr = item;
            item = element;
            lastIndex = index;
            list.fire('active-change', item, curr);
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
 * Adds selection tracking to an existing {@link ModelCollection} instance.
 *
 * @function
 * @param {ModelCollection} list The model list to add selection tracking to.
 * @returns {SelectionModelCollection} A ModelCollection with selection capabilities.
 * @example
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
 * Adds paging to an existing {@link ModelCollection} instance.
 *
 * @function
 * @param {ModelCollection} list The model list to add paging to.
 * @param {number} [size=50] The number of items to show on each page.
 * @returns {PagedModelCollection} A ModelCollection with paging capabilities.
 * @example
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
 */
export function withPaging(list, num = 50) {

    let count = num,
        index = 0,
        numPages = 0;

    function pageSize(number) {
        if (isNumber(number)) {
            count = number;
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
 * Applies a uniqueness constraint to the specified {@link ModelCollection}.
 *
 * @function
 * @param {ModelCollection} list The ModelCollection instance to apply the uniqueness constraint to.
 * @param {any} [iteratee=identity] Optional key selector to use for uniqueness.
 * @returns {UniqueModelCollection} A ModelCollection with a uniqueness constraint.
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#uniqBy _.uniqBy}
 * @example
 * import { getUsers } from '../data/users';
 *
 * export async function getUsersList() {
 *   const users = await getUsers();
 *   const userList = models.collection(...users);
 *   // NOTE: we can use lodash iteratee shortcuts for our selector; see
 *   // https://lodash.com/docs/4.17.11#iteratee for more information.
 *   return models.utils.withUnique(userList, 'username');
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
 * @param {ModelCollection} list The ModelCollection to add updating functionality to.
 * @param {any} [selector=identity] The key selector to use to uniquely
 * identify elements in the collection.
 * @returns {UpdatingModelCollection} A ModelCollection that has various methods
 * you can invoke to update the underlying collection based on a new collection.
 * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee} and {@link https://lodash.com/docs/4.17.11#uniqBy _.uniqBy}
 * @example
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
