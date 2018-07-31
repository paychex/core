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

export default function indexedDB({
    database = '@paychex',
    version = 1,
    store
}) {

    // TODO:
    // if the store doesn't exist, create a new version of
    // the database, copy existing stores and values as-is,
    // and then delete the old database; if the store exists
    // at an earlier version, delete the older version and
    // start with an empty new version of the store
     
    return {
        async get(key) {},
        async set(key, value) {},
        async delete(key) {}
    };

}