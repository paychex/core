export function htmlStore(provider) {

    return {

        async get(key) {
            const value = provider.getItem(key);
            return typeof value === 'string' ? JSON.parse(value) : value;
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
 * A persistent store that keeps data between site visits.
 *
 * **NOTE**: Objects are serialized to JSON during storage to ensure
 * any modifications to the original object are not reflected in the
 * cached copy as a side-effect. Retrieving the cached version will
 * always reflect the object as it existed at the time of storage.
 * _However_, some property types cannot be serialized to JSON. For
 * more information, [read this](https://abdulapopoola.com/2017/02/27/what-you-didnt-know-about-json-stringify/).
 *
 * @function module:stores.localStore
 * @returns {Store} A Store backed by the browser's
 * localStorage Storage provider.
 * @example
 * import { withPrefix, localStore } from '@paychex/core/stores';
 * import { user } from '~/currentUser';
 *
 * const persistentData = withPrefix(localStore(), user.guid);
 *
 * export async function loadSomeData() {
 *   return await persistentData.get('some.key');
 * }
 */
export function localStore(provider = localStorage) {
    return htmlStore(provider);
}

/**
 * A persistent store whose data will be deleted when the browser
 * window is closed. However, the data will remain during normal
 * navigation and refreshes.
 *
 * **NOTE**: Objects are serialized to JSON during storage to ensure
 * any modifications to the original object are not reflected in the
 * cached copy as a side-effect. Retrieving the cached version will
 * always reflect the object as it existed at the time of storage.
 * _However_, some property types cannot be serialized to JSON. For
 * more information, [read this](https://abdulapopoola.com/2017/02/27/what-you-didnt-know-about-json-stringify/).
 *
 * @function module:stores.sessionStore
 * @returns {Store} A Store backed by the browser's
 * sessionStorage Storage provider.
 * @example
 * import { withPrefix, sessionStore } from '@paychex/core/stores';
 * import { user } from '~/currentUser';
 *
 * const store = sessionStore();
 * const data = withPrefix(store, user.guid);
 *
 * export async function loadSomeData() {
 *   return await data.get('some.key');
 * }
 */
export function sessionStore(provider = sessionStorage) {
    return htmlStore(provider);
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
 * import { memoryStore, asDataCache } from '@paychex/core/stores';
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
