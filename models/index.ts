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
 * ```
 */

import { isEmpty } from 'lodash';
import { bus } from '../events';
import { mixin } from './shared';

import type { EventBus } from '../events';

export * as utils from './utils';

export interface EventCollection extends Readonly<Record<string, string>> {

    /**
     * Fired when items are added to the ModelCollection.
     *
     * @event
     * @example
     * ```js
     * const list = models.collection();
     *
     * list.on(Events.ADDED, (items) => {
     *   console.log('new items added:', items);
     * });
     *
     * list.add(1, 2, 3); // "new items added: [1, 2, 3]"
     * ```
     */
    ADDED: 'items-add'

    /**
     * Fired when items are removed from the ModelCollection.
     *
     * @event
     * @example
     * ```js
     * const list = models.collection(1, 2, 3);
     *
     * list.on(Events.REMOVED, (items) => {
     *   console.log('items removed:', items);
     * });
     *
     * list.remove(2, 3); // "items removed: [2, 3]"
     * ```
     */
    REMOVED: 'items-remove'

}

export const Events: EventCollection = Object.freeze({
    ADDED: 'items-add',
    REMOVED: 'items-remove',
});

/**
 * @extends EventBus
 * @example
 * ```js
 * import { loadClientData } from '../data';
 * import { createRequest, fetch } from '~/path/to/data';
 *
 * export async function createClientDataModel(client) {
 *   const request = createRequest(loadClientData, { client });
 *   const response = await fetch(request);
 *   return models.collection(...response.data); // spread values
 * }
 * ```
 */
export interface ModelCollection extends EventBus, Iterable<any> {

    /**
    * Adds items to the ModelCollection.
    *
    * @param items The items to add to the ModelCollection.
    * @fires {@link Events.ADDED}
    * @example
    * ```js
    * const list = models.collection(1, 2, 3);
    * list.add(4, 5, 6);
    * console.log(list.items()); // [1, 2, 3, 4, 5, 6]
    * ```
    */
    add(...items: any[]): void

    /**
     * Removes items from the ModelCollection.
     *
     * @param items The items to remove from the ModelCollection.
     * @fires {@link Events.REMOVED}
     * @example
     * ```js
     * const list = models.collection(1, 2, 3);
     * list.add(4, 5, 6);
     * list.remove(5, 1);
     * console.log(list.items()); // [2, 3, 4, 6]
    * ```
     */
    remove(...items: any[]): void

    /**
     * Removes all items from the ModelCollection.
     *
     * @fires {@link Events.REMOVED}
     * @example
     * ```js
     * const list = models.collection(1, 2, 3);
     * list.add(4, 5, 6);
     * console.log(list.items()); // [1, 2, 3, 4, 5, 6]
     * list.clear();
     * console.log(list.items()); // []
    * ```
     */
    clear(): void

    /**
     * The set of items in the ModelCollection.
     *
     * **NOTE:** Returns a shallow copy of the underlying collection. That
     * means the array returned can be mutated without affecting the real
     * ModelCollection, but all the items in the array are the same by reference,
     * so mutating an object in the collection will also mutate the object
     * stored in the ModelCollection.
     *
     * @example
     * ```js
     * let list = models.collection(1, 2, 3);
     * list.add(4, 5, 6);
     * console.log(list.items()); // [1, 2, 3, 4, 5, 6]
     * list = models.utils.withOrdering(list, [], ['desc']);
     * console.log(list.items()); // [6, 5, 4, 3, 2, 1]
    * ```
     */
    items(): any[]

}

function removeFrom(element: any) {
    const { elements, removed } = this;
    const included = elements.includes(element);
    included && removed.push(element);
    return !included;
}

/**
 * Creates a new {@link ModelCollection} instance.
 *
 * @param items Optional items to add to the collection.
 * @returns A new ModelCollection instance
 * @example
 * ```js
 * export const emptyModel = models.collection();
 * export const filledModel = models.collection(1, 2, 3);
 * ```
 * @example
 * ```js
 * import { createRequest, fetch } from '~/path/to/data';
 * import { loadClientData } from '../data';
 *
 * export async function createClientDataModel(client) {
 *   const request = createRequest(loadClientData, { client });
 *   const response = await fetch(request);
 *   return models.collection(...response.data); // spread values
 * }
 * ```
 */
export function collection(...elements: any[]): ModelCollection {

    let _items: any[] = [];

    const list = {};
    const inner = bus(list);

    function items() {
        return _items.slice();
    }

    function add(...arr: any[]) {
        _items = _items.concat(arr);
        isEmpty(arr) || inner.fire(Events.ADDED, arr);
    }

    function remove(...arr: any[]) {
        const removed: any[] = [];
        _items = _items.filter(removeFrom, { elements: arr, removed });
        isEmpty(removed) || inner.fire(Events.REMOVED, removed);
    }

    function clear() {
        const removed = items();
        _items.length = 0;
        isEmpty(removed) || inner.fire(Events.REMOVED, removed);
    }


    add(...elements);

    return Object.assign(list, {
        add,
        remove,
        clear,
        ...mixin(items),
        ...inner
    }) as unknown as ModelCollection;

}
