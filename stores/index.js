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
 * import { localStore } from '@paychex/core/stores';
 * import { withPrefix } from '@paychex/core/stores/utils';
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
 * import { sessionStore } from '@paychex/core/stores';
 * import { withPrefix } from '@paychex/core/stores/utils';
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

/**
 * @global
 * @typedef {Object} IndexedDBConfiguration
 * @property {string} [database='@paychex'] The database to
 * open. Will be created if it doesn't exist.
 * @property {number} [version=1] The version of the store
 * to access. You can overwrite a previously created store
 * by increasing the version number.
 * @property {string} store The store name to use. Will be
 * created if it doesn't exist in the database.
 */

function promisify(object, success, error) {
    return new Promise((resolve, reject) => {
        object[error] = reject;
        object[success] = resolve;
    });
}

const dbs = new Map();

/**
 * A persistent store whose objects are retained between visits.
 *
 * **NOTE**: Objects are serialized to JSON during storage to ensure
 * any modifications to the original object are not reflected in the
 * cached copy as a side-effect. Retrieving the cached version will
 * always reflect the object as it existed at the time of storage.
 * _However_, some property types cannot be serialized to JSON. For
 * more information, [read this](https://abdulapopoola.com/2017/02/27/what-you-didnt-know-about-json-stringify/).
 *
 * @function module:stores.indexedDB
 * @param {IndexedDBConfiguration} config Configures
 * the IndexedDB store to be used.
 * @returns {Store} A Store backed by IndexedDB.
 * @example
 * import { indexedDB } from '@paychex/core/stores'
 *
 * const reports = indexedDB({store: 'reports'});
 *
 * export async function loadReport(id) {
 *   const result = await someDataCall(id);
 *   await reports.set(id, result);
 *   return result;
 * }
 */
export function indexedDB({
    database = '@paychex',
    version = 1,
    store
}, databases = dbs) {

    let dbVersion = 1;
    const prefix = `${store}@`;
    const table = `${prefix}${version}`;

    function closePreviousVersion(e) {
        e.currentTarget.close()
    }

    function isLowerVersion(storeName) {
        return storeName.startsWith(prefix) &&
            Number(storeName.replace(prefix, '')) < version;
    }

    function increment() {
        dbVersion++;
        return openDatabase();
    }

    function handleVersionChange(e) {
        const db = e.target.result;
        db.onversionchange = closePreviousVersion;
        return db;
    }

    function handleOpenError(e) {
        if (e.target.error.name === 'VersionError') {
            return increment();
        }
        throw e.target.error;
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(database, dbVersion);
            request.onupgradeneeded = createStore;
            promisify(request, 'onsuccess', 'onerror')
                .then(handleVersionChange, handleOpenError)
                .then(resolve, reject);
        });
    }

    function createStore(e) {
        const db = e.target.result;
        db.createObjectStore(table);
        const stores = db.objectStoreNames;
        Array.prototype.filter.call(stores, isLowerVersion)
            .forEach(db.deleteObjectStore, db);
    }

    function upgradeIfStoreNotFound(db) {
        const stores = db.objectStoreNames;
        if (Array.prototype.includes.call(stores, table)) {
            databases.set(database, db);
        } else {
            return increment().then(upgradeIfStoreNotFound);
        }
    }

    async function performOperation(operation, args, mode = 'readonly') {
        await ready;
        const db = databases.get(database);
        const tx = db.transaction(table, mode);
        const os = tx.objectStore(table);
        const req = os[operation].apply(os, args);
        return new Promise((resolve, reject) => {
            tx.onerror = () => reject(tx.error);
            req.onsuccess = () => resolve(req.result);
        });
    }

    const ready = openDatabase()
        .then(upgradeIfStoreNotFound);

    return {

        async get(key) {
            return performOperation('get', [key]);
        },

        async set(key, value) {
            return performOperation('put', [value, key], 'readwrite');
        },

        async delete(key) {
            return performOperation('delete', [key], 'readwrite');
        }

    };

}
