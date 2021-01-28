import sjcl from 'sjcl';
import memoize from 'lodash/memoize.js';
import identity from 'lodash/identity.js';
import isEmpty from 'lodash/isEmpty.js';
import isFunction from 'lodash/isFunction.js';
import conforms from 'lodash/conforms.js';
import stubTrue from 'lodash/stubTrue.js';
import cond from 'lodash/cond.js';

import {
    Cache,
    Store,
    EncryptionConfiguration,
} from '../types/stores.js';

class Unused extends Cache {}
class UnusedStore extends Store {}
class Configuration extends EncryptionConfiguration {}

/**
 * Contains utility methods for working with Stores.
 *
 * @module stores/utils
 */

/**
 * Wraps a {@link Store} instance so values are encrypted and
 * decrypted transparently when get and set. For increased security,
 * the key used to store a value will also be used to salt the given
 * private key, ensuring each object is stored with a unique key.
 *
 * @param {Store} store Underlying Store instance whose values will
 * be encrypted during `set` calls and decrypted during `get` calls.
 * @param {EncryptionConfiguration} config Indicates which encryption
 * method and encryption key to use.
 * @returns {Store} A Store instance that will encrypt and decrypt
 * values in the underlying store transparently.
 * @example
 * // random private key and initialization vector
 *
 * import { memoryStore } from '@paychex/core/stores';
 * import { withEncryption } from '@paychex/core/stores/utils';
 *
 * const iv = window.crypto.getRandomBytes(new UintArray(16));
 * const key = window.crypto.getRandomBytes(new UintArray(8));
 *
 * export const lockbox = withEncryption(memoryStore(), { key, iv });
 * @example
 * // user-specific private key and initialization vector
 *
 * import { proxy } from 'path/to/proxy';
 * import { indexedDB } from '@paychex/core/stores'
 * import { withEncryption } from '@paychex/core/stores/utils';
 * import { getUserPrivateKey, getUserGUID } from '../data/user';
 *
 * const database = indexedDB({ store: 'my-store' });
 *
 * export async function loadData(id) {
 *   const iv = await getUserGUID();
 *   const key = await getUserPrivateKey();
 *   const encrypted = withEncryption(database, { key, iv });
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
export function withEncryption(store, { key, iv }) {

    const vector = sjcl.codec.utf8String.toBits(iv);
    const secret = memoize(function generateKey(salt) {
        return sjcl.misc.pbkdf2(key, salt);
    });

    async function encrypt(value, salt) {
        const json = JSON.stringify(value);
        const bits = sjcl.codec.utf8String.toBits(json);
        const aes = new sjcl.cipher.aes(secret(salt));
        const bytes = sjcl.mode.ccm.encrypt(aes, bits, vector);
        return sjcl.codec.hex.fromBits(bytes);
    }

    async function decrypt(value, salt) {
        const bytes = sjcl.codec.hex.toBits(value);
        const aes = new sjcl.cipher.aes(secret(salt));
        const bits = sjcl.mode.ccm.decrypt(aes, bytes, vector);
        const json = sjcl.codec.utf8String.fromBits(bits);
        return JSON.parse(json);
    }

    return {

        async get(item) {
            const cleartext = data => decrypt(data, item);
            return await store.get(item).then(cleartext);
        },

        async set(item, value) {
            const setInStore = data => store.set(item, data);
            return await encrypt(value, item).then(setInStore);
        },

        async delete(item) {
            return await store.delete(item);
        }

    };

}

const getPrefixer = cond([
    [isFunction, identity],
    [isEmpty, () => identity],
    [stubTrue, (prefix) => (key) => `${prefix}:${key}`],
]);

/**
 * Method used to modify a key for use in a Store. Used primarily by
 * {@link module:stores/utils.withPrefix withPrefix}.
 *
 * @global
 * @callback Prefixer
 * @param {string} key The key to modify before passing to a Store.
 * @returns {string} The modified key to use in a Store.
 * @example
 * import { localStore } from '@paychex/core/stores';
 * import { withPrefix } from '@paychex/core/stores/utils';
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
 * import { localStore } from '@paychex/core/stores';
 * import { withPrefix } from '@paychex/core/stores/utils';
 * import { user } from '../data/user';
 *
 * const store = withPrefix(localStore(), user.guid);
 * @example
 * import { localStore } from '@paychex/core/stores';
 * import { withPrefix } from '@paychex/core/stores/utils';
 * import { user } from '../data/user';
 *
 * const store = withPrefix(localStore(), function(key) {
 *   return `${key}|${user.guid}`;
 * });
 */
export function withPrefix(store, prefix) {

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
 * Factory method that returns a new Date instance on each invocation.
 *
 * @global
 * @callback DateFactory
 * @returns {Date} A Date object.
 * @see {@link module:stores/utils.withExpiration withExpiration}
 * @example
 * import { localStore } from '@paychex/core/stores';
 * import { withExpiration } from '@paychex/core/stores/utils';
 *
 * export const store = withExpiration(localStore(), function sevenDays() {
 *   const now = Date.now();
 *   const days = 24 * 60 * 60 * 1000;
 *   return new Date(now + 7 * days);
 * });
 */

/**
 * Creates a {@link DateFactory} that returns a Date the specified number of
 * weeks in the future.
 *
 * @function
 * @param {number} count The number of weeks in the future the Date should be.
 * @returns {DateFactory} A function that returns a Date.
 * @see {@link module:stores/utils.withExpiration withExpiration}
 * @example
 * import { localStore } from '@paychex/core/stores';
 * import { withExpiration, weeks } from '@paychex/core/stores/utils';
 *
 * export const store = withExpiration(localStore(), weeks(2));
 */
export function weeks(count) {
    return days(count * 7);
}

/**
 * Creates a {@link DateFactory} that returns a Date the specified number of
 * days in the future.
 *
 * @function
 * @param {number} count The number of days in the future the Date should be.
 * @returns {DateFactory} A function that returns a Date.
 * @see {@link module:stores/utils.withExpiration withExpiration}
 * @example
 * import { localStore } from '@paychex/core/stores';
 * import { withExpiration, days } from '@paychex/core/stores/utils';
 *
 * export const store = withExpiration(localStore(), days(1));
 */
export function days(count) {
    return hours(count * 24);
}

/**
 * Creates a {@link DateFactory} that returns a Date the specified number of
 * hours in the future.
 *
 * @function
 * @param {number} count The number of hours in the future the Date should be.
 * @returns {DateFactory} A function that returns a Date.
 * @see {@link module:stores/utils.withExpiration withExpiration}
 * @example
 * import { localStore } from '@paychex/core/stores';
 * import { withExpiration, hours } from '@paychex/core/stores/utils';
 *
 * export const store = withExpiration(localStore(), hours(8));
 */
export function hours(count) {
    return minutes(count * 60);
}

/**
 * Creates a {@link DateFactory} that returns a Date the specified number of
 * minutes in the future.
 *
 * @function
 * @param {number} count The number of minutes in the future the Date should be.
 * @returns {DateFactory} A function that returns a Date.
 * @see {@link module:stores/utils.withExpiration withExpiration}
 * @example
 * import { localStore } from '@paychex/core/stores';
 * import { withExpiration, minutes } from '@paychex/core/stores/utils';
 *
 * export const store = withExpiration(localStore(), minutes(90));
 */
export function minutes(count) {
    return function dateFactory() {
        const now = Date.now();
        const offset = count * 60 * 1000;
        return new Date(now + offset);
    };
}

function afterNow(date) {
    return date > new Date();
}

const isNotExpired = conforms({ expires: afterNow });

/**
 * Wraps a Store so values expire after a specified Date. Any attempts to
 * retrieve a value after it has expired will return `undefined`.
 *
 * @function
 * @param {Store} store The store to wrap.
 * @param {DateFactory} dateFactory Function to create expiration Dates.
 * @returns {Store} A Store that returns `undefined` if a value has expired.
 * @example
 * import { localStore } from '@paychex/core/stores';
 * import { withExpiration, minutes } from '@paychex/core/stores/utils';
 *
 * export const store = withExpiration(localStore(), minutes(90));
 * @example
 * import { indexedDB } from '@paychex/core/stores';
 * import { withCache } from '@paychex/core/data/utils';
 * import { asDataCache, withEncryption, withExpiration, days } from '@paychex/core/stores/utils';
 *
 * import { user } from '../path/to/user';
 * import { fetch, createRequest } from '../path/to/datalayer';
 *
 * const reports = indexedDB({ store: 'reports' });
 * const expires = withExpiration(reports, days(30));
 * const encrypted = withEncryption(expires, {
 *   iv: user.id,
 *   key: user.privateKey,
 * });
 *
 * const operation = {
 *   base: 'reports',
 *   path: '/reports/:id'
 * };
 *
 * const pipeline = withCache(fetch, asDataCache(encrypted));
 *
 * export async function getReportById(id) {
 *   const request = createRequest(operation, { id });
 *   const response = await pipeline(request);
 *   return response.data;
 * }
 */
export function withExpiration(store, dateFactory) {

    return {

        ...store,

        async get(key) {
            const entry = await store.get(key);
            if (isNotExpired(entry))
                return entry.value;
        },

        async set(key, value) {
            return await store.set(key, {
                value,
                expires: dateFactory()
            });
        }

    };

}

/**
 * Utility method to wrap a {@link Store} implementation as a {@link Cache}
 * instance. Uses the {@link Request} url as the cache key.
 *
 * @param {Store} store The Store implementation to use as the Cache backing.
 * @returns {Cache} A Cache implementation backed by the specified Store.
 * @example
 * import { rethrow } from '@paychex/core/errors';
 * import { withCache } from '@paychex/core/data/utils';
 * import { indexedDB } from '@paychex/core/stores';
 * import { asDataCache } from '@paychex/core/stores/utils';
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
 * const store = indexedDB({ store: 'myDataValues' });
 * const attempt = withCache(fetch, asDataCache(store));
 *
 * export async function loadData(key) {
 *   const params = { key };
 *   const request = createRequest(dataCall, params);
 *   const response = await attempt(request).catch(rethrow(params));
 *   return response.data;
 * }
 */
export function asDataCache(store) {

    return {

        async get(request) {
            return await store.get(request.url);
        },

        async set(request, response) {
            return await store.set(request.url, response);
        }

    };

}
