import { isEmpty } from 'lodash-es';

import { mixin } from './shared.mjs';
import * as events from '../events/index.mjs';

export * as utils from './utils.mjs';

/**
 * Provides utilities for working with collections of structured data.
 * Simplifies and standardizes support for common UI and business logic
 * surrounding data collections. You can easily extend functionality by
 * combining existing wrappers or by writing your own.
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
 * @module models
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

function removeFrom(element) {
    const { elements, removed } = this;
    const included = elements.includes(element);
    included && removed.push(element);
    return !included;
}

/**
 * Fired when items are added to the ModelCollection.
 *
 * @event ModelCollection~items-add
 * @type {any[]}
 * @example
 * const list = models.collection();
 *
 * list.on('items-add', (items) => {
 *   console.log('new items added:', items);
 * });
 *
 * list.add(1, 2, 3); // "new items added: [1, 2, 3]"
 */

/**
 * Fired when items are removed from the ModelCollection.
 *
 * @event ModelCollection~items-remove
 * @type {any[]}
 * @example
 * const list = models.collection(1, 2, 3);
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
 * @event UniqueModelCollection~unique-change
 * @type {undefined}
 * @example
 * const list = models.utils.withUnique(models.collection(1.0, 1.5, 2.0));
 *
 * list.on('unique-change', () => {
 *   console.log('items:', list.items());
 * });
 *
 * list.uniqueBy(Math.floor); // "items: [1.0, 2.0]"
 */

/**
 * Fired when {@link OrderedModelCollection#orderBy orderBy} is invoked.
 *
 * @event OrderedModelCollection~order-change
 * @type {undefined}
 * @example
 * const list = models.utils.withOrdering(models.collection());
 *
 * list.on('order-change', () => {
 *   console.log('order changed');
 * });
 *
 * list.add(1, 2, 3);
 * list.orderBy([], ['desc']); // "order changed"
 */

/**
 * Fired when {@link FilteredModelCollection#filterBy filterBy} is invoked.
 *
 * @event FilteredModelCollection~filter-change
 * @type {undefined}
 * @example
 * const list = models.utils.withFiltering(models.collection());
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
 * Fired when {@link GroupedModelCollection#groupBy groupBy} is invoked.
 *
 * @event GroupedModelCollection~group-change
 * @type {undefined}
 * @example
 * import { users } from '../data/users';
 *
 * const list = models.utils.withGrouping(models.collection());
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
 * @event ActiveModelCollection~active-change
 * @type {any}
 * @example
 * import { users } from '../data/users';
 *
 * const list = models.utils.withActive(models.collection());
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
 * @event SelectionModelCollection~selection-change
 * @type {any[]}
 * @example
 * import { users } from '../data/users';
 *
 * const list = models.utils.withSelection(models.collection());
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
 * @event PagedModelCollection~page-change
 * @type {number}
 * @example
 * import { users } from '../data/users';
 *
 * const list = models.utils.withPaging(models.collection(), 2);
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
 * updated during an {@link UpdatingModelCollection#upsert upsert}
 * or {@link UpdatingModelCollection#merge merge} operation.
 *
 * @event UpdatingModelCollection~items-update
 * @type {any[]}
 * @example
 * import { newUsers, allUsers, activeUsers } from '../data/users';
 *
 * const list = models.utils.withUpdating(models.collection(), 'username');
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
 * Creates a new {@link ModelCollection} instance.
 *
 * @function
 * @param {...any} [items] Optional items to add to the collection.
 * @returns {ModelCollection} A new ModelCollection instance
 * @example
 * export const emptyModel = models.collection();
 * export const filledModel = models.collection(1, 2, 3);
 * @example
 * import { createRequest, fetch } from '~/path/to/data';
 * import { loadClientData } from '../data';
 *
 * export async function createClientDataModel(client) {
 *   const request = createRequest(loadClientData, { client });
 *   const response = await fetch(request);
 *   return models.collection(...response.data); // spread values
 * }
 */
export function collection(...elements) {

    let _items = [];

    const list = {};
    const bus = events.bus(list);

    function items() {
        return _items.slice();
    }

    function add(...arr) {
        _items = _items.concat(arr);
        isEmpty(arr) || bus.fire('items-add', arr);
    }

    function remove(...arr) {
        const removed = [];
        _items = _items.filter(removeFrom, { elements: arr, removed });
        isEmpty(removed) || bus.fire('items-remove', removed);
    }

    function clear() {
        const removed = items();
        _items.length = 0;
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
