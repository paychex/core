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

import { isString } from 'lodash';
import { Request, Response } from "../data";

export * as utils from './utils';

/**
 * @example
 * ```js
 * const iv = window.crypto.getRandomBytes(new UintArray(16));
 * const key = window.crypto.getRandomBytes(new UintArray(8));
 *
 * export const lockbox = stores.utils.withEncryption(stores.memoryStore(), { key, iv });
 * ```
 */
export interface EncryptionConfiguration {

    /**
     * The private key to use to encrypt
     * values in the store. The same key will need to be provided
     * on subsequent encrypted store instantiations, so a value
     * that is unique to the user (and unguessable by other users)
     * is recommended. Any string of any length can be used.
     */
    key: string

    /**
     * The initialization vector to use when
     * encrypting. Must be at least 7 characters long. The same value
     * should be provided on subsequent store instantiations, so a
     * value that is unique to the user (such as a GUID) is recommended.
     */
    iv: string

}

/**
 * Provides asynchronous data storage.
 */
export interface Store {

    /**
     * Retrieves data from the Store.
     *
     * @param key The item to retrieve from storage.
     * @returns A promise that will be resolved
     * with the value of the item in storage (or undefined, if
     * the item does not exist), or rejected if an error occurs.
     * @example
     * ```js
     * import { user } from '../data/user';
     *
     * const store = stores.utils.withPrefix(stores.localStore(), user.guid);
     *
     * function defaultFalse(result) {
     *   return (result === undefined) ? false : result;
     * }
     *
     * export async function termsAccepted() {
     *   return await store.get('terms_accepted')
     *     .then(defaultFalse)
     *     .catch(errors.rethrow({ tags: ['legal'] }));
     * }
     * ```
     */
    get(key: string): Promise<any>

    /**
     * Puts data into the Store.
     *
     * @param key The key that uniquely identifies the item to store.
     * @param value The value to store under the associated key.
     * @returns A Promise that will be resolved with the key when the
     * item is stored, or rejected if the storage operation fails.
     * @example
     * ```js
     * import { user } from '../data/user';
     *
     * const store = stores.utils.withPrefix(stores.localStore(), user.guid);
     *
     * export async function markTermsAndConditionsRead() {
     *   return await store.set('terms_accepted', true)
     *     .catch(errors.rethrow({ tags: ['legal'] }));
     * }
     * ```
     */
    set(key: string, value: any): Promise<any>

    /**
     * Removes an item from the Store.
     *
     * @param key The item to remove.
     * @returns A Promise that will be resolved when the item
     * is removed from storage successfully _or_ if the item is not found.
     * This promise should only be rejected if the delete operation fails.
     * @example
     * ```js
     * import { user } from '../data/user';
     *
     * const store = stores.utils.withPrefix(stores.localStore(), user.guid);
     *
     * export async function resetTermsAndConditions() {
     *   return await store.delete('terms_accepted')
     *     .catch(errors.rethrow({ tags: ['legal'] }));
     * }
     * ```
     */
    delete(key: string): Promise<void>

}

/**
 * Stores and retrieves Response objects.
 *
 * @see {@link withCache withCache()}
 * @see {@link asDataCache asDataCache()}
 * @example
 * ```js
 * const store = stores.indexedDB({store: 'my-objects'});
 * const ignore = () => {};
 *
 * export const cache = {
 *   async get(request) {
 *     return await store.get(request.url).catch(ignore);
 *   },
 *   async set(request, response) {
 *     return await store.set(request.url, response).catch(ignore);
 *   }
 * }
 * ```
 */
export interface Cache {

    /**
    * Retrieves a Response object from the cache. You should resolve
    * with `undefined` if the cached value is not found, expired, or
    * invalid. Do NOT reject the returned Promise.
    *
    * @param request Contains information you can use to create
    * a cache key. Typically, the `url` is unique enough to act as a key.
    * See the example code.
    * @returns Promise resolved with `undefined` if
    * the key could not be found in the cache or is invalid; otherwise,
    * resolved with the {@link Response} object passed to {@link Cache.set}.
    * @example
    * ```js
    * const store = stores.indexedDB({store: 'my-objects'});
    * const ignore = () => {};
    *
    * export const cache = {
    *   async get(request) {
    *     return await store.get(request.url).catch(ignore);
    *   },
    *   async set(request, response) {
    *     return await store.set(request.url, response).catch(ignore);
    *   }
    * }
    * ```
    */
    get(request: Request): Promise<Response>

    /**
     * Stores a Response object in the cache. Resolve the returned promise
     * when the object has been cached OR if the caching operation fails. Do
     * NOT reject the returned Promise.
     *
     * @param request Contains information you can use to create
     * a cache key. Typically, the `url` is unique enough to act as a key.
     * See the example code.
     * @param response The Response to cache. This is the value
     * that should be returned from {@link Cache.get}.
     * @returns A promise resolved when the value is cached.
     * @example
     * ```js
     * const store = stores.indexedDB({store: 'my-objects'});
     * const ignore = () => {};
     *
     * export const cache = {
     *   async get(request) {
     *     return await store.get(request.url).catch(ignore);
     *   },
     *   async set(request, response) {
     *     return await store.set(request.url, response).catch(ignore);
     *   }
     * }
     * ```
     */
    set(request: Request, response: Response): Promise<void>

}

/**
 * Method used to modify a key for use in a Store. Used primarily by
 * {@link withPrefix}.
 *
 * @param key The key to modify before passing to a Store.
 * @returns The modified key to use in a Store.
 * @example
 * ```js
 * import { user } from '../data/user';
 *
 * const store = stores.utils.withPrefix(stores.localStore(), function(key) {
 *   return `${key}|${user.guid}`;
 * });
 * ```
 */
export interface Prefixer { (key: string): string }

/**
 * Factory method that returns a new Date instance on each invocation.
 *
 * @returns A Date object.
 * @see {@link withExpiration}
 * @example
 * ```js
 * export const store = stores.utils.withExpiration(stores.localStore(), function sevenDays() {
 *   const now = Date.now();
 *   const days = 24 * 60 * 60 * 1000;
 *   return new Date(now + 7 * days);
 * });
 * ```
 */
export interface DateFactory { (...args: any[]): Date }

/** @ignore */
export type Provider = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** @ignore */
export function htmlStore(provider: Provider): Store {

    return {

        async get(key: string): Promise<any> {
            const value = provider.getItem(key);
            return isString(value) ? JSON.parse(value) : value;
        },

        async set(key: string, value: any): Promise<string> {
            provider.setItem(key, JSON.stringify(value));
            return key;
        },

        async delete(key: string): Promise<void> {
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
 * @returns A Store that is not persisted. The store will
 * be cleared when the site is refreshed or navigated away from.
 * @example
 * ```js
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
 * ```
 */
export function memoryStore(): Store {

    const cache: Map<string, any> = arguments[0] || new Map();

    const provider: Provider = {
        getItem: (key: string) => cache.get(key),
        setItem: (key: string, value: any) => cache.set(key, value),
        removeItem: (key: string) => cache.delete(key)
    };

    // NOTE: we wrap the Map in an htmlStore so we
    // are forced to store a JSON serialized copy of
    // the data rather than an object reference; this
    // ensures stored values cannot be modified as
    // side effects of other code

    return htmlStore(provider);

}
