function getIterator(items) {
    return function* iterator() {
        for (let item of items()) {
            yield item;
        }
    };
}

export function mixin(items) {
    return {
        items,
        [Symbol.iterator]: getIterator(items)
    };
}
