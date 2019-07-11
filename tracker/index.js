import uuid from 'uuid/v4';
import noop from 'lodash/noop';
import invoke from 'lodash/invoke';
import isArray from 'lodash/isArray';
import isError from 'lodash/isError';
import mergeWith from 'lodash/mergeWith';
import isFunction from 'lodash/isFunction';
import defaultsDeep from 'lodash/defaultsDeep';

/**
 * Provides event, error, and performance logging for applications.
 *
 * @module tracker
 * @see {@link Tracker Tracker API}
 * @example
 * import createTracker from '@paychex/core/tracker';
 *
 * export const tracker = createTracker(console.log);
 *
 * export async function bootstrap(appId) {
 *   const child = tracker.child();
 *   try {
 *     child.context({ app: appId });
 *     const stop = child.start('bootstrap time');
 *     const scripts = await loadScripts();
 *     child.event('app bootstrapped');
 *     stop({
 *       tags: ['perf', 'ct-003'],
 *       scriptCount: scripts.length
 *     });
 *   } catch (e) {
 *     child.error(e);
 *   }
 * }
 */

function customizer(lhs, rhs) {
    if (isArray(lhs)) {
        return lhs.concat(rhs);
    }
}

function tryMark(label) {
    invoke(window, 'performance.mark', label)
}

function tryMeasure(label, start) {
    invoke(window, 'performance.measure', label, start);
}

/**
 * Encapsulates tracking information. The {@link TrackingSubscriber}
 * will be invoked with an instance for each {@link Tracker} (or child
 * Tracker) method invoked.
 *
 * @global
 * @typedef {Object} TrackingInfo
 * @property {string} id A random [RFC 4122 UUID]{@link https://tools.ietf.org/html/rfc4122#section-4.4}.
 * @property {'event'|'timer'|'error'} type The type of tracking information provided in this object.
 * @property {string} label The description of this tracking entry.
 * @property {number} start The number of milliseconds between January 1, 1970 00:00:00 UTC and when this entry was created.
 * @property {number} stop The number of milliseconds between January 1, 1970 00:00:00 UTC and when this entry was ended.
 * @property {number} duration The difference in milliseconds between start and stop.
 * @property {number} count The number of times this entry has been logged.
 * @property {object.<string, any>} data Optional additional data associated with this tracking entry.
 */

/**
 * Invoked each time a {@link Tracker} (or child Tracker) method produces
 * a new {@link TrackingInfo} instance.
 *
 * @global
 * @callback TrackingSubscriber
 * @param {TrackingInfo} info
 * @example
 * import createTracker from '@paychex/core/tracker';
 *
 * const tracker = createTracker((info) => {
 *   console.log(JSON.stringify(info));
 * });
 * @example
 * import createTracker from '@paychex/core/tracker';
 * import { store } from '~/path/to/actions';
 *
 * const tracker = createTracker((info) => {
 *   store.dispatch({
 *     type: `track:${info.type}`,
 *     payload: info
 *   });
 * });
 */

/**
 * Method to stop a running timer and create a timer entry.
 *
 * **NOTE:** This method also creates a [browser performance measure]{@link https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMeasure}
 * with the label that was passed to {@link Tracker#start start}.
 *
 * @global
 * @callback TimerStopFunction
 * @param {object.<string,any>} [data] Optional data to include in the timer entry.
 */

/**
 * Provides methods for logging events, errors, and performance.
 *
 * **Best Practices**
 *
 * - Combine {@link Tracker#child tracker.child()} with {@link Tracker#context tracker.context()}
 * to set cross-cutting information specific to your application and to each high-level business
 * process or transaction you have to track. You can create any number of child trackers that
 * inherit settings from their ancestors.
 *
 * @global
 * @interface Tracker
 * @example
 * // app/index.js
 *
 * import { createTracker } from '@paychex/core/tracker';
 *
 * export const tracker = createTracker();
 *
 * tracker.context({
 *   app: 'my-app'
 * });
 * @example
 * // app/components/search.js
 *
 * // import the root tracker with 'app' defined
 * import { tracker } from '../index';
 *
 * import { rest, createRequest } from '../data';
 * import { rethrow } from '@paychex/core/errors';
 * import { withOrdering, modelList } from '@paychex/core/models';
 *
 * // create a child tracker for use
 * // only within this file
 * const child = tracker.child();
 *
 * // all calls to child tracker methods
 * // will include this 'component', along
 * // with 'app' set by the root tracker
 * child.context({
 *   component: 'my-app-search'
 * });
 *
 * const operation = {
 *   base: 'my-app',
 *   path: '/search'
 * };
 *
 * export async function getSearchResults(query) {
 *
 *   // additional data for the child tracker
 *   child.context({ query });
 *
 *   // the following event will include 'query'
 *   // and 'component' from the child tracker
 *   // as well as 'app' from the root tracker
 *   child.event('search');
 *
 *   const params = { query };
 *   const stop = child.start('perform search');
 *   const request = createRequest(operation, params);
 *   const response = await rest(request).catch(rethrow(params));
 *   const results = response.data;
 *
 *   // the following timer will include 'query',
 *   // 'component', 'app', and -- only on this
 *   // timer -- a 'status' value
 *   stop({ status: results.length ? 'Found' : 'Not Found' });
 *
 *   return withOrdering(modelList(...results), ['priority'], ['desc']);
 * }
 */

/**
 * Creates a new {@link Tracker} instance. The specified subscriber will
 * be notified when new {@link TrackingInfo} entries are created.
 *
 * @function module:tracker.createTracker
 * @param {TrackingSubscriber} subscriber A method that will invoked
 * each time a {@link TrackingInfo} entry is created.
 * @returns {Tracker} The new Tracker instance.
 * @example
 * import createTracker from '@paychex/core/tracker';
 *
 * const tracker = createTracker((info) => {
 *   console.log(JSON.stringify(info));
 * });
 */
export default function createTracker(subscriber) {

    const context = {};

    function getContext(...args) {
        return mergeWith({}, context, ...args, customizer);
    }

    if (!isFunction(subscriber))
        subscriber = noop;

    return /** @lends Tracker.prototype */ {

        /**
         * Generates a random RFC 4122 UUID guaranteed to be unique.
         *
         * @function
         * @returns {string} A [RFC 4122 v4 UUID]{@link https://tools.ietf.org/html/rfc4122#section-4.4}
         * @example
         * import { tracker } from '~/tracking';
         * import { proxy } from '~/path/to/data';
         *
         * proxy.use({
         *   headers: {
         *     'x-session-id': tracker.uuid()
         *   },
         *   match: {
         *     base: '^my\-app' // can use regular expression syntax
         *   }
         * });
         */
        uuid,

        /**
         * Creates a child Tracker instance.
         *
         * @function
         * @returns {Tracker} A new Tracker instance that will notify the same
         * root subscriber of {@link TrackingInfo} entries, mixing in ancestor
         * contextual data as needed.
         * @example
         * import { tracker } from '~/tracking';
         *
         * // this tracker will inherit any context data
         * // set in landing's tracker while also mixing
         * // in any contextual data of its own
         * export const myAppTracker = tracker.child();
         *
         * myAppTracker.context({ app: 'my-app' });
         * myAppTracker.event('app tracker created');
         */
        child() {
            return createTracker((info) => {
                defaultsDeep(info.data, context);
                subscriber(info);
            });
        },

        /**
         * Sets contextual data to be mixed into each TrackingInfo created
         * by this Tracker or any child Trackers.
         *
         * @function
         * @param {object.<string, any>} data The data to merge into any
         * {@link TrackingInfo} instances created by this (or child) Tracker
         * methods.
         * @example
         * import get from 'lodash/get';
         * import { store, tracker } from '~/tracking';
         *
         * store.subscribe(() => {
         *   const state = store.getState();
         *   const app = get(state, 'routes.stage');
         *   const drawer = get(state, 'routes.drawer');
         *   tracker.context({ app, drawer });
         * });
         */
        context(data) {
            mergeWith(context, data, customizer);
        },

        /**
         * Logs an event. Events usually represent important points in an application's
         * lifecycle or user-initiated actions such as button clicks.
         *
         * **NOTE:** This method also creates a [browser performance mark]{@link https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark} with the given message name.
         *
         * @function
         * @param {string} message The name of the event to log.
         * @param {object.<string, any>} [data] Optional information to associate with this {@link TrackingInfo}.
         * @example
         * import { tracker } from '~/tracking';
         *
         * window.addEventListener('click', (e) => {
         *   if (e.target.matches('button, a')) {
         *     // could grab additional contextual data
         *     // by looking at ancestor elements' attributes
         *     const type = e.target.tagName.toLowerCase();
         *     tracker.event('click', {
         *       tags: ['ui', type],
         *       label: e.target.innerText
         *     });
         *   }
         * });
         */
        event(message, data) {
            const id = uuid();
            const now = Date.now();
            tryMark(message);
            subscriber(Object.freeze({
                id,
                type: 'event',
                label: message,
                start: now,
                stop: now,
                duration: 0,
                count: 1,
                data: getContext(data)
            }));
        },

        /**
         * Logs an [Error]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error}.
         *
         * @function
         * @param {Error} err The Error instance to log.
         * @example
         * import { tracker } from '~/tracking';
         * import { rethrow } from '@paychex/core/errors';
         *
         * export function doSomething(param) {
         *   somePromiseMethod()
         *     .catch(rethrow({ param }))
         *     .catch(tracker.error);
         * }
         */
        error(err) {
            const id = uuid();
            const now = Date.now();
            if (!isError(err))
                return console.warn('A non-Error was passed to tracker.error:', err);
            err.count = err.count || 0;
            subscriber(Object.freeze({
                id,
                type: 'error',
                label: err.message,
                start: now,
                stop: now,
                duration: 0,
                count: ++err.count,
                data: getContext(err, {
                    // non-enumerable properties
                    // we want to track should be
                    // explicitly retrieved here
                    stack: err.stack
                })
            }));
        },

        /**
         * Starts a timer to measure performance.
         *
         * @function
         * @param {string} label The name of the timer to create.
         * @returns {TimerStopFunction} Method to invoke to stop and log the timer.
         * @example
         * import { tracker } from '~/tracking';
         *
         * export async function doSomething(param) {
         *   const stop = tracker.start('doSomething');
         *   const results = await somePromiseMethod();
         *   stop({ count: results.length, param });
         *   return results;
         * }
         */
        start(label) {
            let count = 0;
            const id = uuid();
            const start = Date.now();
            tryMark(id);
            return function end(data) {
                const stop = Date.now();
                const duration = stop - start;
                tryMeasure(label, id);
                subscriber(Object.freeze({
                    id,
                    label,
                    start,
                    stop,
                    duration,
                    type: 'timer',
                    count: ++count,
                    data: getContext(data)
                }));
            };
        }

    };

}

/**
 * **NOTE:** The only difference between this class and the normal {@link Tracker}
 * is how the {@link NestedTimingTracker#start start} method works.
 *
 * @global
 * @interface NestedTimingTracker
 * @augments Tracker
 */

/**
 * Starts a timing tree. Unlike the normal {@link Tracker#start start} method, this
 * method does _not_ return a stop function. Instead, it returns an array. The first
 * value in the array is the stop function; the second argument is another start function
 * you can invoke to begin a new nested timing.
 *
 * @override
 * @function NestedTimingTracker#start
 * @returns {Array.<TimerStopFunction, NestedTimingTracker#start>} The `[stop, start]` methods you can use to
 * end the current timing or start a nested timing. The first function
 * is a normal {@link TimerStopFunction} and the second function is
 * another {@link NestedTimingTracker#start} function.
 * @example
 * import { tracker } from '~/tracking';
 * import { withNesting } from '@paychex/core/tracker';
 * import { someDataCall, someOtherDataCall } from '~/data/operations';
 *
 * const nested = withNesting(tracker);
 *
 * export async function loadData(id) {
 *   const child = nested.child();
 *   const [stop, start] = child.start('load data');
 *   const data = await someDataCall(id);
 *   const results = await loadNestedData(start, data);
 *   child.context({ id });
 *   stop({ results });
 *   return results;
 * }
 *
 * async function loadNestedData(start, data) {
 *   const [stop, ] = start('load nested data');
 *   const results = await someOtherDataCall(data);
 *   stop();
 *   return results;
 * }
 */

/**
 * Enables nested timings for the given Tracker instance.
 *
 * **NOTE:** Calling `stop()` multiple times will create multiple timing entries,
 * incrementing `count` for each one. See the example.
 *
 * **IMPORTANT:** Only completed timers will be included in the timing tree. This
 * means if you forget to stop a nested timer before stopping the root timer, the
 * nested timer will not appear at all in the tracked timing entry. See the example.
 *
 * @function
 * @param {Tracker} tracker The Tracker to wrap to enable nested timings.
 * @returns {NestedTimingTracker} A Tracker instance that can create nested timings.
 * @example
 * // calling stop() multiple times
 * //  - multiple sibling entries created
 * //  - increment `count` each time stop is called
 *
 * import { tracker } from '~/tracking';
 * import { withNesting } from '@paychex/core/tracker';
 *
 * const nested = withNesting(tracker);
 *
 * const [stop, startChild] = nested.start('root');
 * const [stop_child] = startChild('child');
 *
 * stop_child({ value: 'abc' });
 * stop_child({ value: 'def' });
 *
 * // timing entry:
 * {
 *   "id": "0598770e-2398-4173-a9a8-347244301cf6",
 *   "label": "root",
 *   "start": 1562871459063,
 *   "stop": 1562871459079,
 *   "duration": 16,
 *   "type": "timer",
 *   "count": 1,
 *   "data": {
 *     "children": [
 *       {
 *         "label": "child",
 *         "count": 1,
 *         "start": 1562871459063,
 *         "stop": 1562871459074,
 *         "duration": 11,
 *         "data": {
 *           "children": [],
 *           "value": "abc"
 *         }
 *       },
 *       {
 *         "label": "child",
 *         "count": 2,
 *         "start": 1562871459063,
 *         "stop": 1562871459079,
 *         "duration": 16,
 *         "data": {
 *           "children": [],
 *           "value": "def"
 *         }
 *       }
 *     ]
 *   }
 * }
 * @example
 * // forgetting to stop a nested timer will exclude
 * // it from the resulting timing tree
 *
 * import { tracker } from '~/tracking';
 * import { withNesting } from '@paychex/core/tracker';
 *
 * const nested = withNesting(tracker);
 *
 * const [stop, startChild] = nested.start('root');
 * const [stop_child1] = startChild('child 1');
 * const [stop_child2] = startChild('child 2'); // never invoked
 *
 * stop_child1();
 * stop(); // but child2 is still running...
 *
 * // ...so the timing entry will look like this:
 * {
 *   "id": "aac3a9da-fb33-436e-808e-ad0054121db7",
 *   "label": "root",
 *   "start": 1562871031757,
 *   "stop": 1562871031762,
 *   "duration": 5,
 *   "type": "timer",
 *   "count": 1,
 *   "data": {
 *     "children": [
 *       {
 *         "label": "child 1",
 *         "count": 1,
 *         "start": 1562871031757,
 *         "stop": 1562871031762,
 *         "duration": 5,
 *         "data": {
 *           "children": []
 *         }
 *       }
 *     ]
 *   }
 * }
 * @example
 * // nested timings
 *
 * import { tracker } from '~/tracking';
 * import { withNesting } from '@paychex/core/tracker';
 *
 * const nested = withNesting(tracker);
 *
 * async function loadSecurity(start, clientId) {
 *     const [stop] = start('load user roles');
 *     await fakeDataCall(clientId); // pretend data call
 *     stop({ role: 'admin' });
 * }
 *
 * async function loadFeatures(start, product) {
 *     const [stop] = start(`load ${product} features`);
 *     await fakeDataCall(product); // pretend data call
 *     stop({ features: [
 *         `${product}-feat-a`,
 *         `${product}-feat-b`
 *     ]});
 * }
 *
 * async function loadProducts(start, clientId) {
 *     const [stop, nest] = start('loading products');
 *     await fakeDataCall(clientId); // pretend data call
 *     await Promise.all([
 *         loadFeatures(nest, 'prod-a'),
 *         loadFeatures(nest, 'prod-b')
 *     ]);
 *     stop({ products: ['prod-a', 'prod-b'] });
 * }
 *
 * async function loadClientData(clientId) {
 *     const [stop, nest] = nested.start('load client data');
 *     await loadProducts(nest, clientId);
 *     await loadSecurity(nest, clientId);
 *     stop({ clientId });
 * }
 *
 * await loadClientData('client-123');
 *
 * // timing tree:
 * {
 *   "id": "dfc21f25-42da-439f-8fd4-23ab02b70668",
 *   "label": "load client data",
 *   "start": 1562872496161,
 *   "stop": 1562872496208,
 *   "duration": 47,
 *   "type": "timer",
 *   "count": 1,
 *   "data": {
 *     "children": [
 *       {
 *         "label": "loading products",
 *         "count": 1,
 *         "start": 1562872496161,
 *         "stop": 1562872496192,
 *         "duration": 31,
 *         "data": {
 *           "children": [
 *             {
 *               "label": "load prod-a features",
 *               "count": 1,
 *               "start": 1562872496176,
 *               "stop": 1562872496191,
 *               "duration": 15,
 *               "data": {
 *                 "children": [],
 *                 "features": [
 *                   "prod-a-feat-a",
 *                   "prod-a-feat-b"
 *                 ]
 *               }
 *             },
 *             {
 *               "label": "load prod-b features",
 *               "count": 1,
 *               "start": 1562872496176,
 *               "stop": 1562872496192,
 *               "duration": 16,
 *               "data": {
 *                 "children": [],
 *                 "features": [
 *                   "prod-b-feat-a",
 *                   "prod-b-feat-b"
 *                 ]
 *               }
 *             }
 *           ],
 *           "products": [
 *             "prod-a",
 *             "prod-b"
 *           ]
 *         }
 *       },
 *       {
 *         "label": "load user roles",
 *         "count": 1,
 *         "start": 1562872496192,
 *         "stop": 1562872496208,
 *         "duration": 16,
 *         "data": {
 *           "children": [],
 *           "role": "admin"
 *         }
 *       }
 *     ],
 *     "clientId": "client-123"
 *   }
 * }
 */
export function withNesting(tracker) {

    function startChild(label, children) {

        let count = 0;

        const info = {
            label,
            count: null,
            start: Date.now(),
            stop: null,
            duration: null,
            data: {
                children: []
            },
        };

        const start = label => startChild(label, info.data.children);

        function stop(data = {}) {
            const stop = Date.now();
            const copy = { ...info, data: {} };
            children.push(mergeWith(
                copy,
                info,
                {
                    data,
                    stop,
                    count: ++count,
                    duration: stop - info.start,
                },
                customizer
            ));
        }

        return [stop, start];

    }

    return {

        ...tracker,

        start(label) {
            const tree = { children: [] };
            const done = tracker.start(label);
            const start = label => startChild(label, tree.children);
            const stop = (data = {}) => done(mergeWith(tree, data, customizer));
            return [stop, start];
        }

    };

}