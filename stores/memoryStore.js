import htmlStore from './htmlStore';

export default function memoryStore(cache = new Map()) {

    const provider = {
        getItem: (key) => cache.get(key),
        setItem: (key, value) => cache.set(key, value),
        removeItem: (key) => cache.delete(key)
    };

    // NOTE: we wrap the Map in an htmlStore so we
    // are forced to store a JSON serialized copy of
    // the data rather than an object reference; this
    // ensures stored values cannot be modified as
    // side effects of other code

    return htmlStore(provider);

}