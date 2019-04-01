import aesjs from 'aes-js'
import merge from 'lodash/merge';
import isEmpty from 'lodash/isEmpty'
import identity from 'lodash/identity'
import isFunction from 'lodash/isFunction'
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

import indexedDB from './indexedDB';
import localStore from './localStore';
import sessionStore from './sessionStore';
import { ifRequestMethod, ifResponseStatus } from '../data/utils';

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
 * import { withPrefix, localStore } from '@paychex/core/stores';
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
 * import { withPrefix, localStore } from '@paychex/core/stores';
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
 * import { withPrefix, localStore } from '@paychex/core/stores';
 * import { user } from '../data/user';
 *
 * const store = withPrefix(localStore(), user.guid);
 *
 * export async function resetTermsAndConditions() {
 *   return await store.delete('terms_accepted')
 *     .catch(rethrow({ tags: ['legal'] }));
 * }
 */

/**
 * Provides a subscription mechanism to watch for changes to the Store.
 *
 * @global
 * @interface ObservableStore
 * @extends Store
 */

/**
 * Provides change information to {@link ObservableStore} subscribers.
 *
 * @global
 * @typedef {object} ObservableStoreEvent
 * @property {string} key The key that was modified.
 * @property {'set'|'delete'} type The type of change that occurred.
 * @property {any} value The value modified (or `undefined`, if a
 * delete operation occurred).
 * @example
 * import { tracker } from '@paychex/landing';
 * import { combineLatest, filter, map } from 'rxjs/operators';
 * import { asObservable, indexedDB } from '@paychex/core/stores';
 * import { selectedClients } from '../data/clients';
 *
 * export const clients = asObservable(indexedDB({ store: 'clients' }));
 *
 * function isSelectedClient([e, selected]) {
 *   return selected.includes(e.key);
 * }
 *
 * function asClientId([e, _]) {
 *   return e.key;
 * }
 *
 * function trackClientChange(id) {
 *   tracker.event('client changed', { id, category: 'audit' });
 * }
 *
 * clients.observe()
 *   .pipe(
 *     combineLatest(selectedClients),
 *     filter(isSelectedClient),
 *     map(asClientId)
 *   )
 *   .subscribe(trackClientChange);
 */

/**
 * Provides manipulation and subscription to a stream whose emitted
 * values can change over time. [Read more...](https://rxjs-dev.firebaseapp.com/api/index/class/Observable)
 *
 * @global
 * @external Observable
 */

/**
 * @global
 * @typedef {Object} EncryptionConfiguration
 * @property {string|number[]} key The private key to use to encrypt
 * values in the store. The same key will need to be provided
 * on subsequent encrypted store instantiations, so a value
 * that is unique to the user (and unguessable by other users)
 * is recommended. The string should be base64-encoded; otherwise,
 * a byte array of length 32 can be provided directly.
 * @property {string|number[]} [salt] A fairly unique value that can
 * be used to generate an initialization vector. The same value
 * will need to be provided on subsequent store insantiations,
 * so a value that is unique to the user (such as a GUID) is
 * recommended. A normal UTF8 string is expected, but you can also
 * specify a byte array of length 16. Note: the salt is only
 * needed when the encryption method is 'cbc'.
 * @property {string} [method='cbc'] The encryption
 * method to use to encrypt values in the store. Currently,
 * only 'cbc' or 'ctr' is recommended.
 */

/**
 * Wraps a {@link Store} instance so values are encrypted and
 * decrypted transparently when get and set.
 *
 * @param {Store} store Underlying Store instance whose values will
 * be encrypted during `set` calls and decrypted during `get` calls.
 * @param {EncryptionConfiguration} config Indicates which encryption
 * method and encryption key to use.
 * @returns {Store} A Store instance that will encrypt and decrypt
 * values in the underlying store transparently.
 * @example
 * import { proxy } from 'path/to/proxy';
 * import { indexedDB, withEncryption } from '@paychex/core/stores'
 * import { getUserPrivateKey } from '../data/user';
 *
 * export async function loadData(id) {
 *   const salt = String(id);
 *   const key = await getUserPrivateKey();
 *   const database = indexedDB({ store: 'my-store' });
 *   const encrypted = withEncryption(database, { key, salt });
 *   try {
 *     return await encrypted.get(id);
 *   } catch (e) {
 *     return await someDataCall(...)
 *       .then(value => {
 *          encrypted.set(id, value);
 *          return value;
 *       });
 *   }
 * }
 */
export function withEncryption(store, { key, salt = undefined, method = 'cbc' }) {

    function byteArrayFromBase64(b64) {
        const chars = Array.from(b64).map(c => c.charCodeAt(0)).slice(-32);
        const array = new Uint8Array(chars.length);
        array.set(chars);
        return array;
    }

    const k = typeof key === 'string'
        ? byteArrayFromBase64(key)
        : key;

    const iv = method === 'cbc'
        ? typeof salt === 'string'
            ? aesjs.utils.utf8.toBytes(new Array(16).join(salt)).slice(-16)
            : salt
        : new aesjs.Counter(5);

    async function encrypt(value) {
        const aes = new aesjs.ModeOfOperation[method](k, iv);
        const json = JSON.stringify(value);
        const bytes = aesjs.utils.utf8.toBytes(json);
        const final = aesjs.padding.pkcs7.pad(bytes);
        return aesjs.utils.hex.fromBytes(aes.encrypt(final));
    }

    async function decrypt(value) {
        const aes = new aesjs.ModeOfOperation[method](k, iv);
        const bytes = aes.decrypt(aesjs.utils.hex.toBytes(value));
        const unpadded = aesjs.padding.pkcs7.strip(bytes);
        const json = aesjs.utils.utf8.fromBytes(unpadded);
        return JSON.parse(json);
    }

    return {

        async get(key) {
            return await store.get(key).then(decrypt);
        },

        async set(key, value) {
            const setInStore = data => store.set(key, data);
            return await encrypt(value).then(setInStore);
        },

        async delete(key) {
            return await store.delete(key);
        }

    };

}

/**
 * Method used to modify a key for use in a Store. Used primarily by
 * {@link module:stores.withPrefix|withPrefix}.
 *
 * @global
 * @callback Prefixer
 * @param {string} key The key to modify before passing to a Store.
 * @returns {string} The modified key to use in a Store.
 * @example
 * import { localStore, withPrefix } from '@paychex/core/stores';
 * import { user } from '../data/user';
 *
 * const store = withPrefix(localStore(), function(key) {
 *   return `${key}|${user.guid}`;
 * });
 */

/**
 * Wraps a Store so any keys are transparently modified before access.
 * This can be useful when storing data on a machine that will have
 * more than 1 user, to ensure different users don't access each other's
 * stored information.
 *
 * @param {Store} store The store whose keys should be modified before access.
 * @param {string|Prefixer} prefix A string to prepend to any keys _or_ a
 * function that will modify a key.
 * @example
 * import { localStore, withPrefix } from '@paychex/core/stores';
 * import { user } from '../data/user';
 *
 * const store = withPrefix(localStore(), user.guid);
 * @example
 * import { localStore, withPrefix } from '@paychex/core/stores';
 * import { user } from '../data/user';
 *
 * const store = withPrefix(localStore(), function(key) {
 *   return `${key}|${user.guid}`;
 * });
 */
export function withPrefix(store, prefix) {

    const prefixer = isFunction(prefix) ?
        prefix : isEmpty(prefix) ?
        identity : (key) => `${prefix}:${key}`;

    return {

        async get(key) {
            return store.get(prefixer(key));
        },

        async set(key, value) {
            return store.set(prefixer(key), value);
        },

        async delete(key) {
            return store.delete(prefixer(key));
        }

    };

}

/**
 * Utility method to wrap a {@link Store} implementation as a {@link Cache}
 * instance. Only caches {@link Response}s with HTTP status 200, and
 * only returns cached Responses for GET requests. Uses the {@link Request}
 * url and version (generated by the configured {@link Proxy}) as the
 * cache key.
 *
 * @param {Store} store The Store implementation to use as the Cache backing.
 * @returns {Cache} A Cache implementation backed by the specified Store.
 * @example
 * import { rethrow } from '@paychex/core/errors';
 * import { createRequest, fetch } from '@paychex/landing/data';
 * import { indexedDB, asResponseCache } from '@paychex/core/stores';
 *
 * const store = indexedDB({ store: 'myDataValues' });
 * // NOTE: you should wrap your store using withEncryption(store, options)
 * // if the response might contain sensitive or personally identifying
 * // information (PII)
 *
 * const dataCall = {
 *     method: 'GET',
 *     base: 'server',
 *     path: '/values/:key',
 *     cache: asResponseCache(store)
 * };
 *
 * export async function loadData(key) {
 *     const request = createRequest(dataCall, { key });
 *     return await fetch(request).catch(rethrow({ key }));
 * }
 */
export function asResponseCache(store) {

    return {

        get: ifRequestMethod('GET', async function get(request) {
            const response = await store.get(request.url);
            merge(response, { meta: { cached: true } });
            return response;
        }),

        set: ifResponseStatus(200, async function set(request, response) {
            return await store.set(request.url, response);
        })

    };

}

/**
 * Utility method to add observation to a {@link Store} implementation. When
 * the returned Store implementation's `set` and `delete` methods are invoked,
 * any observers subscribed to those keys will be notified.
 *
 * @param {Store} store The Store implementation to wrap.
 * @returns {ObservableStore} A Store implementation with a new `observe` method.
 * @example
 * import { filter } from 'rxjs/operators';
 * import { tracker } from '@paychex/landing';
 * import { rethrow } from '@paychex/core/errors';
 * import { asObservable, indexedDB } from '@paychex/core/stores';
 * import { user } from '../data/user';
 *
 * const userInfo = asObservable(indexedDB({ store: 'users' }));
 *
 * export async function updateUserInfo(guid, userData) {
 *   return await userInfo.set(guid, userData)
 *     .catch(rethrow({ guid }));
 * }
 *
 * function userModified(e) {
 *   return e.type === 'set' && e.key === String(this);
 * }
 *
 * userInfo.observe()
 *   .pipe(filter(userModified, user.guid))
 *   .subscribe(function audit(e) {
 *     tracker.event('user modified', {
 *       guid: e.key,
 *       category: 'audit',
 *     });
 *   });
 */
export function asObservable(store) {

    const subject = new Subject();

    function event(type, key, value) {
        return { type, key, value };
    }

    function matches(e) {
        return this === undefined || e.key === String(this);
    }

    return {

        ...store,

        set(key, value) {
            return store.set(key, value)
                .then((result) => {
                    subject.next(event('set', key, value));
                    return result;
                });
        },

        delete(key) {
            return store.delete(key)
                .then((result) => {
                    subject.next(event('delete', key));
                    return result;
                });
        },

        /**
         * Notifies subscribers of changes to the specified key.
         *
         * @function ObservableStore#observe
         * @param {string} [key] Key to watch for changes. If not specified,
         * observers will be notified of changes to all keys.
         * @returns {external:Observable<ObservableStoreEvent>} A new Observable instance.
         * @example
         * import { filter } from 'rxjs/operators';
         * import { tracker } from '@paychex/landing';
         * import { rethrow } from '@paychex/core/errors';
         * import { asObservable, indexedDB } from '@paychex/core/stores';
         * import { user } from '../data/user';
         *
         * const userInfo = asObservable(indexedDB({ store: 'users' }));
         *
         * export async function updateUserInfo(guid, userData) {
         *   return await userInfo.set(guid, userData)
         *     .catch(rethrow({ guid }));
         * }
         *
         * function userModified(e) {
         *   return e.type === 'set' && e.key === String(this);
         * }
         *
         * userInfo.observe()
         *   .pipe(filter(userModified, user.guid))
         *   .subscribe(function audit(e) {
         *     tracker.event('user modified', {
         *       guid: e.key,
         *       category: 'audit',
         *     });
         *   });
         */
        observe(key) {
            return subject.asObservable()
                .pipe(filter(matches, key));
        }

    };

}

export {

    /**
     * @function
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
    indexedDB,

    /**
     * @function
     * @returns {Store} A Store backed by the browser's
     * sessionStorage Storage provider.
     * @example
     * import { withPrefix, sessionStore } from '@paychex/core/stores';
     * import { user } from '@paychex/landing';
     *
     * const sessionData = withPrefix(sessionStore(), user.guid);
     *
     * export async function loadSomeData() {
     *   return await sessionData.get('some.key');
     * }
     */
    sessionStore,

    /**
     * @function
     * @returns {Store} A Store backed by the browser's
     * localStorage Storage provider.
     * @example
     * import { withPrefix, localStore } from '@paychex/core/stores';
     * import { user } from '@paychex/landing';
     *
     * const persistentData = withPrefix(localStore(), user.guid);
     *
     * export async function loadSomeData() {
     *   return await persistentData.get('some.key');
     * }
     */
    localStore


}