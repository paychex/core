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

export default function indexedDB({
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