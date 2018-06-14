const nestedUnload = (function getNestedUnload() {

    function isChild(c) {
        return c.contains(this);
    }

    function isTopLevelContainer(container) {
        return !this.some(isChild, container);
    }

    return function nestedUnload(child) {
        const containers = Array.from(child.querySelectorAll('payx-container'));
        return Promise.all(
            containers
                .filter(isTopLevelContainer, containers)
                .map(container => container.clear())
        );
    }

})();

export default class UnloadStrategy {

    constructor(container) {
        this.container = container;
    }

    static get DEFAULT() {
        return UnloadStrategy.ALL[0];
    }

    static get ALL() {
        return ['parallel', 'reverse'];
    }

    static isValid(strategy) {
        return UnloadStrategy.ALL.includes(strategy);
    }

    static create(strategy, container) {
        switch (strategy) {
            case 'parallel':
                return new ParallelUnload(container);
            case 'reverse':
                return new ReverseUnload(container);
        }
    }

    remove(child) {
        let promise = Promise.resolve(nestedUnload(child));
        if (child.shouldUnload) promise = promise.then(() => child.shouldUnload());
        if (child.unload) promise = promise.then(() => child.unload());
        return promise;
    }

    clear(children) {}

}

class ParallelUnload extends UnloadStrategy {

    constructor(container) {
        super(container);
    }

    clear(children) {
        return Promise.all(Array.from(children)
            .map(this.container.remove, this.container));
    }

}

class ReverseUnload extends UnloadStrategy {

    constructor(container) {
        super(container);
    }

    clear(children) {
        return Array.from(children)
            .reverse()
            .reduce((promise, child) =>
                promise.then(() =>
                    this.container.remove(child)),
                Promise.resolve());
    }

}