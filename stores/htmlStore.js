export default function createHtmlStore(provider) {

    return {

        async get(key) {
            const value = provider.getItem(key);
            return typeof value === 'string' ? JSON.parse(value) : value;
        },

        async set(key, value) {
            provider.setItem(key, JSON.stringify(value));
            return key;
        },

        async delete(key) {
            provider.removeItem(key);
        }

    };
}