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
 * {@link module:stores.indexedDB}.
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
 * with the value of the item in storage, or rejected if
 * the item could not be found.
 */

/**
 * Stores data on the client's machine.
 * 
 * @async
 * @function Store#set
 * @param {string} key The key that uniquely identifies the item to store.
 * @param {*} value The value to store under the associated key.
 * @returns {Promise} A Promise that will be resolved when the item
 * is stored, or rejected if the storage operation fails.
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

import indexedDB from './stores/indexedDB';

/**
 * @global
 * @typedef {Object} EncryptionConfiguration
 * @property {string} key The private key to use to encrypt
 * values in the store.
 * @property {string} [method='AES-CBC'] The encryption
 * method to use to encrypt values in the store. Currently,
 * only AES-CBC is supported.
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
 * import { indexedDB, withEncryption } from '@paychex/core/stores'
 * 
 * const database = indexedDB({store: 'my-store'});
 * const encrypted = withEncryption(database);
 * 
 * export async function loadData(id) {
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
export function withEncryption(store, { key, method='AES-CBC' }) {

    // TODO:
    async function encrypt(value) {/* encrypt using method and key */}
    async function decrypt(value) {/* decrypt using method and key*/}
     
    return {
        async get(key) {
            return await store.get(key).then(decrypt);
        },
        async set(key, value) {
            return await encrypt(value).then(enc => store.set(key, enc));
        },
        async delete(key) {
            return await store.delete(key);
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
    indexedDB
    
}