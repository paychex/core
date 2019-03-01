/**
 * @global
 * @typedef {Object} SessionStorageConfiguration
 * @property {string} [prefix=''] The optional prefix to prepend to any keys. This
 * can be used to distinguish values set on a machine shared by multiple users.
 */

export default function sessionStore({ prefix = '' } = {}, provider = sessionStorage) {

    function fix(key) {
        return prefix ? `${prefix}:${key}` : key;
    }

    return {

        async get(key) {
            const value = provider.getItem(fix(key));
            return typeof value === 'string' ? JSON.parse(value) : value;
        },

        async set(key, value) {
            provider.setItem(fix(key), JSON.stringify(value));
            return key;
        },

        async delete(key) {
            provider.removeItem(fix(key));
        }

    };

}
