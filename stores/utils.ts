/**
 * Contains utility methods for working with Stores.
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
 * @module stores/utils
 */

import * as sjcl from 'sjcl';

import {
    memoize,
    identity,
    isEmpty,
    isFunction,
    conforms,
    stubTrue,
    cond,
} from 'lodash';

import { EncryptionConfiguration, Store, Prefixer, DateFactory, Cache } from './index';
import { Request, Response } from '../data';

const {
    codec,
    misc,
    cipher,
    mode,
} = sjcl;

/**
 * Wraps a {@link Store} instance so values are encrypted and
 * decrypted transparently when get and set. For increased security,
 * the key used to store a value will also be used to salt the given
 * private key, ensuring each object is stored with a unique key.
 *
 * @param store Underlying Store instance whose values will
 * be encrypted during `set` calls and decrypted during `get` calls.
 * @param config Indicates which encryption
 * method and encryption key to use.
 * @returns A Store instance that will encrypt and decrypt
 * values in the underlying store transparently.
 * @example
 * ```js
 * // random private key and initialization vector
 *
 * const iv = window.crypto.getRandomBytes(new UintArray(16));
 * const key = window.crypto.getRandomBytes(new UintArray(8));
 *
 * export const lockbox = stores.utils.withEncryption(stores.memoryStore(), { key, iv });
 * ```
 * @example
 * ```js
 * // user-specific private key and initialization vector
 *
 * import { proxy } from 'path/to/proxy';
 * import { getUserPrivateKey, getUserGUID } from '../data/user';
 *
 * const database = stores.indexedDB({ store: 'my-store' });
 *
 * export async function loadData(id) {
 *   const iv = await getUserGUID();
 *   const key = await getUserPrivateKey();
 *   const encrypted = stores.utils.withEncryption(database, { key, iv });
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
 * ```
 */
export function withEncryption(store: Store, { key, iv }: EncryptionConfiguration): Store {

    const vector = codec.utf8String.toBits(iv);
    const secret = memoize(function generateKey(salt: string) {
        return misc.pbkdf2(key, salt);
    });

    async function encrypt(value: any, salt: string) {
        const json = JSON.stringify(value);
        const bits = codec.utf8String.toBits(json);
        const aes = new cipher.aes(secret(salt));
        const bytes = mode.ccm.encrypt(aes, bits, vector);
        return codec.hex.fromBits(bytes);
    }

    async function decrypt(value: any, salt: any) {
        const bytes = codec.hex.toBits(value);
        const aes = new cipher.aes(secret(salt));
        const bits = mode.ccm.decrypt(aes, bytes, vector);
        const json = codec.utf8String.fromBits(bits);
        return JSON.parse(json);
    }

    return {

        async get(item: string) {
            const cleartext = (data: any) => decrypt(data, item);
            return await store.get(item).then(cleartext);
        },

        async set(item: string, value: any) {
            const setInStore = (data: any) => store.set(item, data);
            return await encrypt(value, item).then(setInStore);
        },

        async delete(item: string) {
            return await store.delete(item);
        }

    };

}

const getPrefixer = cond([
    [isFunction, identity],
    [isEmpty, () => identity],
    [stubTrue, (prefix: string) => (key: string) => `${prefix}:${key}`],
]);

/**
 * Wraps a Store so any keys are transparently modified before access.
 * This can be useful when storing data on a machine that will have
 * more than 1 user, to ensure different users don't access each other's
 * stored information.
 *
 * @param store The store whose keys should be modified before access.
 * @param prefix A string to prepend to any keys _or_ a
 * function that will modify a key.
 * @example
 * ```js
 * import { user } from '../data/user';
 *
 * const store = stores.utils.withPrefix(stores.localStore(), user.guid);
 * ```
 * @example
 * ```js
 * import { user } from '../data/user';
 *
 * const store = stores.utils.withPrefix(stores.localStore(), function(key) {
 *   return `${key}|${user.guid}`;
 * });
 * ```
 */
export function withPrefix(store: Store, prefix: string|Prefixer): Store {

    const prefixer = getPrefixer(prefix);

    return {

        async get(key) {
            return await store.get(prefixer(key));
        },

        async set(key, value) {
            return await store.set(prefixer(key), value);
        },

        async delete(key) {
            return await store.delete(prefixer(key));
        }

    };

}

/**
 * Creates a {@link DateFactory} that returns a Date the specified number of
 * weeks in the future.
 *
 * @param count The number of weeks in the future the Date should be.
 * @returns A function that returns a Date.
 * @see {@link withExpiration}
 * @example
 * ```js
 * export const store = stores.utils.withExpiration(
 *   stores.localStore(),
 *   stores.utils.weeks(2)
 * );
 * ```
 */
export function weeks(count: number): DateFactory {
    return days(count * 7);
}

/**
 * Creates a {@link DateFactory} that returns a Date the specified number of
 * days in the future.
 *
 * @param count The number of days in the future the Date should be.
 * @returns A function that returns a Date.
 * @see {@link withExpiration}
 * @example
 * ```js
 * export const store = stores.utils.withExpiration(
 *   stores.localStore(),
 *   stores.utils.days(1)
 * );
 * ```
 */
export function days(count: number): DateFactory {
    return hours(count * 24);
}

/**
 * Creates a {@link DateFactory} that returns a Date the specified number of
 * hours in the future.
 *
 * @param count The number of hours in the future the Date should be.
 * @returns A function that returns a Date.
 * @see {@link withExpiration}
 * @example
 * ```js
 * export const store = stores.utils.withExpiration(
 *   stores.localStore(),
 *   stores.utils.hours(8)
 * );
 * ```
 */
export function hours(count: number): DateFactory {
    return minutes(count * 60);
}

/**
 * Creates a {@link DateFactory} that returns a Date the specified number of
 * minutes in the future.
 *
 * @param count The number of minutes in the future the Date should be.
 * @returns A function that returns a Date.
 * @see {@link withExpiration}
 * @example
 * ```js
 * export const store = stores.utils.withExpiration(
 *   stores.localStore(),
 *   stores.utils.minutes(90)
 * );
 * ```
 */
export function minutes(count: number): DateFactory {
    return function dateFactory() {
        const now = Date.now();
        const offset = count * 60 * 1000;
        return new Date(now + offset);
    };
}

function afterNow(date: Date): boolean {
    return date > new Date();
}

const isNotExpired = conforms({ expires: afterNow });

/**
 * Wraps a Store so values expire after a specified Date. Any attempts to
 * retrieve a value after it has expired will return `undefined`.
 *
 * @param store The store to wrap.
 * @param dateFactory Function to create expiration Dates.
 * @returns A Store that returns `undefined` if a value has expired.
 * @example
 * ```js
 * export const store = stores.utils.withExpiration(
 *   stores.localStore(),
 *   stores.utils.minutes(90)
 * );
 * ```
 * @example
 * ```js
 * import { user } from '../path/to/user';
 * import { fetch, createRequest } from '../path/to/datalayer';
 *
 * const reports = stores.indexedDB({ store: 'reports' });
 * const expires = stores.utils.withExpiration(reports, stores.utils.days(30));
 * const encrypted = stores.utils.withEncryption(expires, {
 *   iv: user.id,
 *   key: user.privateKey,
 * });
 *
 * const operation = {
 *   base: 'reports',
 *   path: '/reports/:id'
 * };
 *
 * const pipeline = data.utils.withCache(fetch, stores.utils.asDataCache(encrypted));
 *
 * export async function getReportById(id) {
 *   const request = createRequest(operation, { id });
 *   const response = await pipeline(request);
 *   return response.data;
 * }
 * ```
 */
export function withExpiration(store: Store, dateFactory: DateFactory): Store {

    return {

        ...store,

        async get(key: string): Promise<any> {
            const entry = await store.get(key);
            if (isNotExpired(entry))
                return entry.value;
        },

        async set(key: string, value: any): Promise<any> {
            return await store.set(key, {
                value,
                expires: dateFactory()
            });
        }

    } as unknown as Store;

}

/**
 * Utility method to wrap a {@link Store} implementation as a {@link Cache}
 * instance. Uses the {@link Request} url as the cache key.
 *
 * @param store The Store implementation to use as the Cache backing.
 * @returns A Cache implementation backed by the specified Store.
 * @example
 * ```js
 * import { createRequest, fetch } from '~/path/to/datalayer';
 *
 * const dataCall = {
 *   method: 'GET',
 *   base: 'server',
 *   path: '/values/:key'
 * };
 *
 * // NOTE: use withEncryption(store, options) if the response
 * // might contain personal or sensitive information that you
 * // wish to keep secret
 * const store = stores.indexedDB({ store: 'myDataValues' });
 * const attempt = data.utils.withCache(fetch, stores.utils.asDataCache(store));
 *
 * export async function loadData(key) {
 *   const params = { key };
 *   const request = createRequest(dataCall, params);
 *   const response = await attempt(request).catch(errors.rethrow(params));
 *   return response.data;
 * }
 * ```
 */
export function asDataCache(store: Store): Cache {

    return {

        async get(request: Request): Promise<Response> {
            return await store.get(request.url);
        },

        async set(request: Request, response: Response): Promise<void> {
            return await store.set(request.url, response);
        }

    };

}
