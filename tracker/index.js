import uuid from 'uuid/v4';
import noop from 'lodash/noop';
import once from 'lodash/once';
import invoke from 'lodash/invoke';
import isEmpty from 'lodash/isEmpty';
import isArray from 'lodash/isArray';
import mergeWith from 'lodash/mergeWith';
import isFunction from 'lodash/isFunction';
import defaultsDeep from 'lodash/defaultsDeep';

/**
 * Provides event, error, and performance logging for applications.
 *
 * @module tracker
 */

function customizer(lhs, rhs) {
    if (isArray(lhs)) {
        return lhs.concat(rhs);
    }
}

function tryMark(label) {
    invoke(global, 'window.performance.mark', label)
}

function tryMeasure(label, start) {
    invoke(global, 'window.performance.measure', label, start);
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
 * import { store } from '@paychex/landing/actions';
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
 * @global
 * @interface Tracker
 * @example
 * import createTracker from '@paychex/core/tracker';
 *
 * const tracker = createTracker(console.log);
 *
 * export async function bootstrap(appId) {
 *   try {
 *     const stop = tracker.start('bootstrap time');
 *     const scripts = await loadScripts();
 *     tracker.event('app bootstrapped', { appId });
 *     stop({
 *       appId,
 *       tags: ['perf', 'ct-003'],
 *       scriptCount: scripts.length
 *     });
 *   } catch (e) {
 *     tracker.error(e);
 *   }
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
         * import { tracker } from '@paychex/landing';
         * import { proxy } from '@paychex/landing/data';
         *
         * proxy.use({
         *   headers: {
         *     'x-session-id': tracker.uuid()
         *   },
         *   match: {
         *     adapter: '^@paychex'
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
         * import { tracker } from '@paychex/landing';
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
         * import { store, tracker } from '@paychex/landing';
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
         * import { tracker } from '@paychex/landing';
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
            subscriber({
                id,
                type: 'event',
                label: message,
                start: now,
                stop: now,
                duration: 0,
                count: 1,
                data: getContext(data)
            });
        },

        /**
         * Logs an [Error]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error}.
         *
         * @function
         * @param {Error} err The Error instance to log.
         * @example
         * import { tracker } from '@paychex/landing';
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
            err.count = err.count || 0;
            subscriber({
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
            });
        },

        /**
         * Starts a timer to measure performance.
         *
         * @function
         * @param {string} label The name of the timer to create.
         * @returns {TimerStopFunction} Method to invoke to stop and log the timer.
         * @example
         * import { tracker } from '@paychex/landing';
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
                subscriber({
                    id,
                    label,
                    start,
                    stop,
                    duration,
                    type: 'timer',
                    count: ++count,
                    data: getContext(data)
                });
            };
        }

    };

}

/**
 * Enables nested timings for the given Tracker instance.
 *
 * **NOTE:** With a nested tracker, calling stop() multiple times will be
 * ignored. However, forgetting to stop a nested timing before stopping the
 * root timing will result in an invalid timing. See the examples for details.
 *
 * @function
 * @param {Tracker} tracker The Tracker to wrap to enable nested timings.
 * @returns {Tracker} A Tracker instance that will create a nested timing
 * tree for each time start() is invoked.
 * @example
 * // invalid timing entry
 *
 * import { tracker } from '@paychex/landing';
 * import { withNesting } from '@paychex/core/tracking';
 *
 * const nested = withNesting(tracker);
 * const stop = nested.start('root timing');
 * nested.start('child timing #1'); // notice that we aren't invoking
 * nested.start('child timing #2'); // the stop methods returned by start()
 * stop();
 * // because we called start 3 times and stop 1 time, the timing
 * // entry created for this operation will look like the following:
 * {
 *   "id": "80f3fccb-e0fd-4320-bae5-a0bc2077a0d2",
 *   "label": "root",
 *   "start": 1553783595834,
 *   "stop": 1553783595834,
 *   "duration": 0,
 *   "type": "timer",
 *   "count": 1,
 *   "data": {
 *     "invalid": true,
 *     "message": "Some nested timers were not stopped.",
 *     "timers": ["child timing #1", "child timing #2"]
 *   }
 * }
 * @example
 * // nested timings
 *
 * import { tracker } from '@paychex/landing';
 * import { withNesting } from '@paychex/core/tracking';
 *
 * const nested = withNesting(tracker);
 *
 * async function loadSecurity(clientId) {
 *   const security = {};
 *   const stop = nested.start('load client security');
 *   // ... data operation
 *   stop();
 *   return security;
 * }
 *
 * async function loadFeatures(product) {
 *   product.features = [];
 *   const stop = nested.start('load product features');
 *   // ... data operation
 *   stop();
 * }
 *
 * async function loadProducts(clientId) {
 *   const products = [];
 *   const stop = nested.start('load client products');
 *   // ... data operation
 *   await Promise.all(products.map(loadFeatures));
 *   stop();
 *   return products;
 * }
 *
 * export async function loadClientData(clientId) {
 *   const result = {};
 *   const stop = nested.start('load client data');
 *   result.security = await loadSecurity(clientId);
 *   result.products = await loadProducts(clientId);
 *   stop({ clientId });
 *   return result;
 * }
 *
 * // the above function produces a TrackingInfo entry like this:
 * // note that parallel calls produce nested timings but sequential
 * // calls produce sibling timings
 * {
 *  "id": "44a61275-a331-47eb-a214-f455bae00f87",
 *  "label": "load client data",
 *  "start": 1553783025026,
 *  "stop": 1553783025398,
 *  "duration": 372,
 *  "type": "timer",
 *  "count": 1,
 *  "data": {
 *    "children": [
 *      {
 *        "label": "load client security",
 *        "children": [],
 *        "start": 1553783025026,
 *        "end": 1553783025226,
 *        "duration": 200
 *      },
 *      {
 *        "label": "load client products",
 *        "children": [
 *          {
 *            "label": "load product features",
 *            "children": [
 *              {
 *                "label": "load product features",
 *                "children": [],
 *                "start": 1553783025348,
 *                "end": 1553783025398,
 *                "duration": 50,
 *                "id": "prod-b",
 *                "features": []
 *              }
 *            ],
 *            "start": 1553783025348,
 *            "end": 1553783025398,
 *            "duration": 50,
 *            "id": "prod-a",
 *            "features": []
 *          }
 *        ],
 *        "start": 1553783025226,
 *        "end": 1553783025398,
 *        "duration": 172
 *      }
 *    ],
 *    "clientId": "abc123"
 *  }
 * }
 */
export function withNesting(tracker) {

    let ref,
        tree = {};

    function getUnstopped(node = tree, arr = []) {
        if (!('end' in node)) arr.push(node.label);
        node.children.forEach(child => getUnstopped(child, arr));
        return arr;
    }

    return {

        ...tracker,

        start(label) {
            if (isEmpty(tree)) {
                ref = tree.children = [];
                const end = tracker.start(label);
                return function stop(data = {}) {
                    const unstopped = getUnstopped().filter(Boolean);
                    if (!isEmpty(unstopped)) {
                        tree = {};
                        data.invalid = true;
                        data.message = 'Some nested timers were not stopped.';
                        data.timers = unstopped;
                    }
                    end(mergeWith(tree, data, customizer));
                    tree = {};
                };
            }
            const info = {
                label,
                parent: ref,
                children: [],
                start: Date.now(),
            };
            ref.push(info);
            ref = info.children;
            return once(function stop(data) {
                ref = info.parent;
                delete info.parent;
                info.end = Date.now();
                info.duration = info.end - info.start;
                mergeWith(info, data, customizer);
            });
        }

    };

}