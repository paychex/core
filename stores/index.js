import aesjs from 'aes-js'
import { merge } from 'lodash';

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
     * @param {HTMLStorageConfiguration} [config] Optional
     * configuration for the session storage instance.
     * @returns {Store} A Store backed by the browser's
     * sessionStorage Storage provider.
     * @example
     * import { sessionStore } from '@paychex/core/stores';
     * import { user } from '@paychex/landing';
     *
     * const sessionData = sessionStore({ prefix: user.guid });
     *
     * export async function loadSomeData() {
     *   return await sessionData.get('some.key');
     * }
     */
    sessionStore,

    /**
     * @function
     * @param {HTMLStorageConfiguration} [config] Optional
     * configuration for the session storage instance.
     * @returns {Store} A Store backed by the browser's
     * localStorage Storage provider.
     * @example
     * import { localStore } from '@paychex/core/stores';
     * import { user } from '@paychex/landing';
     *
     * const persistentData = localStore({ prefix: user.guid });
     *
     * export async function loadSomeData() {
     *   return await persistentData.get('some.key');
     * }
     */
    localStore


}