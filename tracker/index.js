import uuid from 'uuid/v4';
import noop from 'lodash/noop';
import invoke from 'lodash/invoke';
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
         * **NOTE:** This method also creates a [browser performance measure]{@link https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMeasure} with the given message name.
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
            return function stop(data) {
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