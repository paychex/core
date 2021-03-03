import { isString } from 'lodash-es';

export * as utils from './utils.mjs';

/**
 * Provides methods for storing information on the client's
 * machine. The persistence period will vary based on the
 * storage type and configuration.
 *
 * ```js
 * // esm
 * import { stores } from '@paychex/core';
 *
 * // cjs
 * const { stores } = require('@paychex/core');
 *
 * // iife
 * const { stores } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ stores }) { ... });
 * define(['@paychex/core'], function({ stores }) { ... });
 * ```
 *
 * @module stores
 */

export function htmlStore(provider) {

    return {

        async get(key) {
            const value = provider.getItem(key);
            return isString(value) ? JSON.parse(value) : value;
        },

        async set(key, value) {
            provider.setItem(key, JSON.stringify(value));
            return key;
        },

        async delete(key) {
            provider.removeItem(key);
        }

    };
}

/**
 * An in-memory store whose contents will be cleared each time the
 * user navigates away from the page or refreshes their browser.
 *
 * **NOTE**: Objects are serialized to JSON during storage to ensure
 * any modifications to the original object are not reflected in the
 * cached copy as a side-effect. Retrieving the cached version will
 * always reflect the object as it existed at the time of storage.
 * _However_, some property types cannot be serialized to JSON. For
 * more information, [read this](https://abdulapopoola.com/2017/02/27/what-you-didnt-know-about-json-stringify/).
 *
 * @function
 * @returns {Store} A Store that is not persisted. The store will
 * be cleared when the site is refreshed or navigated away from.
 * @example
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const operation = {
 *   base: 'reports',
 *   path: 'jobs/:id'
 * };
 *
 * const store = stores.memoryStore();
 * const cache = stores.utils.asDataCache(store);
 * const pipeline = data.utils.withCache(fetch, cache);
 *
 * export async function loadData(id) {
 *   const params = { id };
 *   const request = createRequest(operation, params);
 *   const response = await pipeline(request).catch(errors.rethrow(params));
 *   return response.data;
 * }
 */
export function memoryStore(cache = new Map()) {

    const provider = {
        getItem: (key) => cache.get(key),
        setItem: (key, value) => cache.set(key, value),
        removeItem: (key) => cache.delete(key)
    };

    // NOTE: we wrap the Map in an htmlStore so we
    // are forced to store a JSON serialized copy of
    // the data rather than an object reference; this
    // ensures stored values cannot be modified as
    // side effects of other code

    return htmlStore(provider);

}
