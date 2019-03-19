import QS from 'query-string';

/**
 * Connects URL behaviors with component lifecycles.
 *
 * @module router
 */

const promise = Promise.resolve();

function debounce(fn) {
    let called = false;
    const wrapper = () => {
        called = false;
        fn();
    };
    return async () => {
        if (!called) {
            called = true;
            return await promise.then(wrapper);
        }
    };
}

function equals(key) {
    return key in this.rhs && deep_equals(this.lhs[key], this.rhs[key]);
}

function deep_equals(lhs, rhs) {
    if (lhs === rhs)
        return true;
    else if (typeof lhs !== 'object' || typeof rhs !== 'object')
        return lhs === rhs;
    else {
        const context = { lhs, rhs };
        const lhsKeys = Object.keys(lhs);
        return lhsKeys.every(equals, context);
    }
}

function hasChanged(params) {
    return params && params[1].changed;
}

function spread(fn) {
    return (args) => fn(...args);
}

const rxParseRoute = /(.+?)\:\/\/([^\?]*)\??(.*)/;

/**
 * Provides URL-based navigation and component creation.
 *
 * @global
 * @interface Router
 */

/**
 * Customizes the {@link Router} instance.
 *
 * @global
 * @typedef {object} RouterOptions
 * @property {string} [prefix='#!'] The hash prefix to use.
 * @property {string} [separator='||'] The separator to show between routes.
 */

/**
 * Creates a new {@link Router} instance.
 *
 * @param {RouterOptions} [options] Customizes the returned {@link Router} instance.
 * @returns {Router} A new Router instance.
 * @example
 * import { createRouter } from '@paychex/core/router';
 *
 * const router = createRouter();
 * router.navigate('drawer', 'help/main', { suggestions: true });
 * @example
 * import { createRouter } from '@paychex/core/router';
 *
 * const router = createRouter({
 *   prefix: '#/',
 *   separator: '&&'
 * });
 */
export function createRouter(options, globals = window) {

    options = Object.assign({
        prefix: '#!',
        separator: '||'
    }, options);

    if (typeof options.dispatch !== 'function')
        throw new Error('createRouter options must include a `dispatch` method.');

    let lastHash = '';

    const routeData = {};
    const rxValidHash = /./; // TODO: use options prefix and separator in regex
    const spreadSync = spread(synchronize);
    const debouncedUpdateHashString = debounce(updateHashString);

    function onHashChanged() {
        const hash = globals.document.location.hash.substring(options.prefix.length);
        if (hash === lastHash) return;
        if (hash && !rxValidHash.test(hash))
            return globals.history.replaceState(
                null,
                globals.document.title,
                globals.document.location.pathname + globals.document.location.search
            );
        populateRouteData();
        synchronizeAll();
        lastHash = hash;
    }

    function updateRouteDataMap(route) {
        const [_, id, path, data] = rxParseRoute.exec(route);
        const params = QS.parse(data);
        const existing = routeData[id];
        const proposed = { path, params };
        Object.defineProperty(proposed, 'changed', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: !existing || !deep_equals(existing, proposed)
        });
        routeData[id] = proposed;
    }

    function populateRouteData() {
        globals.document.location.hash.substring(options.prefix.length)
            .split(options.separator)
            .filter(Boolean)
            .forEach(updateRouteDataMap);
    }

    function asHashData(key) {
        return [key, routeData[key]];
    }

    function createHashString(hash, [container, route], index) {
        const path = route.path || '';
        const sep = (index > 0 && hash !== options.prefix) ? options.separator : '';
        const qs = route.params && QS.stringify(route.params) || '';
        return `${hash}${sep}${container}://${path}${qs ? '?' + qs : ''}`;
    }

    function updateHashString() {
        globals.document.location.hash = Object.keys(routeData)
            .sort()
            .map(asHashData)
            .reduce(createHashString, options.prefix);
    }

    function synchronizeAll() {
        Object.keys(routeData)
            .map(asHashData)
            .filter(hasChanged)
            .forEach(spreadSync);
    }

    function synchronize(container, route) {
        options.dispatch({
            type: 'navigate',
            data: {
                container,
                ...route
            }
        });
    }

    globals.addEventListener('hashchange', onHashChanged);
    populateRouteData();
    synchronizeAll();

    return /** @lends Router.prototype */ {

        /**
         * Changes the specified container's path.
         *
         * **NOTE:** The hash will not be changed until the end of the current stack frame.
         * This allows each call to `navigate` within the same frame to execute at the same
         * time. See the example code for details.
         *
         * @function
         * @param {string} container The name of the container whose path will change.
         * @param {string} path The path to change in the target container.
         * @param {object} [params] Optional key-value pairs to pass along with the route path.
         * @example
         * import { router } from '@paychex/landing';
         * router.navigate('panel', 'notifications');
         * router.navigate('stage', 'help/topics', { context: 'notifications' });
         * // #!panel://notifications||stage://help/topics?context=notifications
         */
        navigate(container, path, params = {}) {
            const proposed = { path, params };
            const existing = routeData[container] || {};
            routeData[container] = Object.assign(existing, proposed);
            debouncedUpdateHashString();
        }

    };

};