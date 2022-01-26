type Items = () => any[];

function getIterator(items: Items) {
    return function* iterator() {
        for (let item of items()) {
            yield item;
        }
    };
}

export function mixin(items: Items) {
    return {
        items,
        [Symbol.iterator]: getIterator(items)
    };
}

export function readonly(getter: () => any): PropertyDescriptor {
    return {
        get: getter,
        enumerable: true,
    };
}