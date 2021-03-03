/**
 * @class
 * @global
 * @hideconstructor
 * @example
 * const iv = window.crypto.getRandomBytes(new UintArray(16));
 * const key = window.crypto.getRandomBytes(new UintArray(8));
 *
 * export const lockbox = stores.utils.withEncryption(stores.memoryStore(), { key, iv });
 */
export class EncryptionConfiguration {

    /**
     * The private key to use to encrypt
     * values in the store. The same key will need to be provided
     * on subsequent encrypted store instantiations, so a value
     * that is unique to the user (and unguessable by other users)
     * is recommended. Any string of any length can be used.
     *
     * @type {string}
     * @memberof EncryptionConfiguration
     */
    key = ''

    /**
     * The initialization vector to use when
     * encrypting. Must be at least 7 characters long. The same value
     * should be provided on subsequent store instantiations, so a
     * value that is unique to the user (such as a GUID) is recommended.
     *
     * @type {string}
     * @memberof EncryptionConfiguration
     */
    iv = ''

}

/**
 * Provides asynchronous data storage.
 *
 * @class
 * @global
 * @hideconstructor
 */
export class Store {

    /**
     * Retrieves data from the Store.
     *
     * @async
     * @function Store#get
     * @param {string} key The item to retrieve from storage.
     * @returns {Promise<*>} A promise that will be resolved
     * with the value of the item in storage (or undefined, if
     * the item does not exist), or rejected if an error occurs.
     * @example
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
     */
    get() { }

    /**
     * Puts data into the Store.
     *
     * @async
     * @function Store#set
     * @param {string} key The key that uniquely identifies the item to store.
     * @param {*} value The value to store under the associated key.
     * @returns {Promise} A Promise that will be resolved with the key when the
     * item is stored, or rejected if the storage operation fails.
     * @example
     * import { user } from '../data/user';
     *
     * const store = stores.utils.withPrefix(stores.localStore(), user.guid);
     *
     * export async function markTermsAndConditionsRead() {
     *   return await store.set('terms_accepted', true)
     *     .catch(errors.rethrow({ tags: ['legal'] }));
     * }
     */
    set() { }

    /**
     * Removes an item from the Store.
     *
     * @async
     * @function Store#delete
     * @param {string} key The item to remove.
     * @returns {Promise} A Promise that will be resolved when the item
     * is removed from storage successfully _or_ if the item is not found.
     * This promise should only be rejected if the delete operation fails.
     * @example
     * import { user } from '../data/user';
     *
     * const store = stores.utils.withPrefix(stores.localStore(), user.guid);
     *
     * export async function resetTermsAndConditions() {
     *   return await store.delete('terms_accepted')
     *     .catch(errors.rethrow({ tags: ['legal'] }));
     * }
     */
    delete() { }

}

/**
 * Stores and retrieves Response objects.
 *
 * @global
 * @class
 * @hideconstructor
 * @see {@link module:stores/utils.asDataCache asDataCache()} in @paychex/core/stores/utils
 * @see {@link module:data/utils.withCache withCache()} in @paychex/core/data/utils
 * @example
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
 */
export class Cache {

    /**
    * Retrieves a Response object from the cache. You should resolve
    * with `undefined` if the cached value is not found, expired, or
    * invalid. Do NOT reject the returned Promise.
    *
    * @async
    * @method Cache#get
    * @param {Request} request Contains information you can use to create
    * a cache key. Typically, the `url` is unique enough to act as a key.
    * See the example code.
    * @returns {Promise<?Response>} Promise resolved with `undefined` if
    * the key could not be found in the cache or is invalid; otherwise,
    * resolved with the {@link Response} object passed to {@link Cache#set}.
    * @example
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
    */
    get() { }

    /**
     * Stores a Response object in the cache. Resolve the returned promise
     * when the object has been cached OR if the caching operation fails. Do
     * NOT reject the returned Promise.
     *
     * @async
     * @method Cache#set
     * @param {Request} request Contains information you can use to create
     * a cache key. Typically, the `url` is unique enough to act as a key.
     * See the example code.
     * @param {Response} response The Response to cache. This is the value
     * that should be returned from {@link Cache#get}.
     * @returns {Promise} A promise resolved when the value is cached.
     * @example
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
     */
    set() { }

}
