import isString from 'lodash/isString.js';

/**
 * Provides methods for storing information on the client's
 * machine. The persistence period will vary based on the
 * storage type and configuration.
 *
 * @module stores
 */

/**
 * Provides asynchronous storage on the client's machine.
 * Stores are created indirectly through methods such as
 * {@link module:stores.indexedDB} and {@link module:stores.sessionStore}.
 *
 * @global
 * @interface Store
 */

/**
 * Retrieves data stored on the client's machine.
 *
 * @async
 * @function Store#get
 * @param {string} key The item to retrieve from storage.
 * @returns {Promise<*>} A promise that will be resolved
 * with the value of the item in storage (or undefined, if
 * the item does not exist), or rejected if an error occurs.
 * @example
 * import { rethrow } from '@paychex/core/errors';
 * import { localStore } from '@paychex/core/stores';
 * import { withPrefix } from '@paychex/core/stores/utils';
 * import { user } from '../data/user';
 *
 * const store = withPrefix(localStore(), user.guid);
 *
 * function defaultFalse(result) {
 *   return (result === undefined) ? false : result;
 * }
 *
 * export async function termsAccepted() {
 *   return await store.get('terms_accepted')
 *     .then(defaultFalse)
 *     .catch(rethrow({ tags: ['legal'] }));
 * }
 */

/**
 * Stores data on the client's machine.
 *
 * @async
 * @function Store#set
 * @param {string} key The key that uniquely identifies the item to store.
 * @param {*} value The value to store under the associated key.
 * @returns {Promise} A Promise that will be resolved with the key when the
 * item is stored, or rejected if the storage operation fails.
 * @example
 * import { rethrow } from '@paychex/core/errors';
 * import { localStore } from '@paychex/core/stores';
 * import { withPrefix } from '@paychex/core/stores/utils';
 * import { user } from '../data/user';
 *
 * const store = withPrefix(localStore(), user.guid);
 *
 * export async function markTermsAndConditionsRead() {
 *   return await store.set('terms_accepted', true)
 *     .catch(rethrow({ tags: ['legal'] }));
 * }
 */

/**
 * Removes an item from storage.
 *
 * @async
 * @function Store#delete
 * @param {string} key The item to remove.
 * @returns {Promise} A Promise that will be resolved when the item
 * is removed from storage successfully _or_ if the item is not found.
 * This promise should only be rejected if the delete operation fails.
 * @example
 * import { rethrow } from '@paychex/core/errors';
 * import { localStore } from '@paychex/core/stores';
 * import { withPrefix } from '@paychex/core/stores/utils';
 * import { user } from '../data/user';
 *
 * const store = withPrefix(localStore(), user.guid);
 *
 * export async function resetTermsAndConditions() {
 *   return await store.delete('terms_accepted')
 *     .catch(rethrow({ tags: ['legal'] }));
 * }
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
 * @function module:stores.memoryStore
 * @returns {Store} A Store that is not persisted. The store will
 * be cleared when the site is refreshed or navigated away from.
 * @example
 * import { rethrow } from '@paychex/core/errors';
 * import { fetch, createRequest } from '~/path/to/datalayer';
 * import { memoryStore } from '@paychex/core/stores';
 * import { asDataCache } from '@paychex/core/stores/utils';
 *
 * const operation = {
 *   base: 'reports',
 *   path: 'jobs/:id'
 * };
 *
 * const store = memoryStore();
 * const cache = asDataCache(store);
 * const pipeline = withCache(fetch, cache);
 *
 * export async function loadData(id) {
 *   const params = { id };
 *   const request = createRequest(operation, params);
 *   const response = await pipeline(request).catch(rethrow(params));
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
