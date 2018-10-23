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

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(database, dbVersion);
            request.onupgradeneeded = createStore;
            request.onsuccess = (e) => {
                const db = e.target.result;
                db.onversionchange = closePreviousVersion;
                resolve(db);
            };
            request.onerror = (e) => {
                if (e.target.error.name === 'VersionError') {
                    increment().then(resolve, reject);
                } else {
                    reject(e.target.error);
                }
            };
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

    const ready = openDatabase()
        .then(upgradeIfStoreNotFound);

    return {

        async get(key) {
            await ready;
            const db = databases.get(database);
            const tx = db.transaction(table);
            const req = tx.objectStore(table).get(key);
            return new Promise((resolve, reject) => {
                tx.onerror = () => reject(tx.error);
                req.onsuccess = () => resolve(req.result);
            });
        },

        async set(key, value) {
            await ready;
            const db = databases.get(database);
            const tx = db.transaction(table, 'readwrite');
            const req = tx.objectStore(table).put(value, key);
            return new Promise((resolve, reject) => {
                tx.onerror = () => reject(tx.error);
                req.onsuccess = () => resolve();
            });
        },

        async delete(key) {
            await ready;
            const db = databases.get(database);
            const tx = db.transaction(table, 'readwrite');
            const req = tx.objectStore(table).delete(key);
            return new Promise((resolve, reject) => {
                tx.onerror = () => reject(tx.error);
                req.onsuccess = () => resolve();
            });
        }

    };

}