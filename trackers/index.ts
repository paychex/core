/**
 * Provides event, error, and performance logging for applications.
 *
 * ```js
 * // esm
 * import { trackers } from '@paychex/core';
 *
 * // cjs
 * const { trackers } = require('@paychex/core');
 *
 * // iife
 * const { trackers } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ trackers }) { ... });
 * define(['@paychex/core'], function({ trackers }) { ... });
 * ```
 *
 * @module trackers
 * @example
 * ```js
 * export const tracker = trackers.create(console.log);
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
 * ```
 */

import { v4 as uuid } from 'uuid';

import {
    get,
    set,
    noop,
    invoke,
    isError,
    mergeWith,
    isFunction,
    defaultsDeep,
} from 'lodash';

import { customizer } from './shared';

export * as utils from './utils';

/** @ignore */
export interface BaseTrackingInfo {

    /**
     * The description of this tracking entry.
     */
    label: string

    /**
     * The number of milliseconds between January 1, 1970 00:00:00 UTC and when this entry was created.
     */
    start: number

    /**
     * The number of milliseconds between January 1, 1970 00:00:00 UTC and when this entry was ended.
     */
    stop: number

    /**
     * The difference in milliseconds between start and stop.
     */
    duration: number

    /**
     * The number of times this entry has been logged.
     */
    count: number

    /**
     * Optional additional data associated with this tracking entry.
     */
    data: Record<string, any>

}

/**
 * Encapsulates tracking information. The {@link TrackingSubscriber}
 * will be invoked with an instance for each {@link Tracker} (or child
 * Tracker) method invoked.
 */
export interface TrackingInfo extends BaseTrackingInfo {

    /**
     * A random [RFC 4122 UUID]{@link https://tools.ietf.org/html/rfc4122#section-4.4}.
     */
    id: string

    /**
     * The type of tracking information provided in this object. Either `'event'`, `'timer'`, or `'error'`.
     */
    type: string

}

/**
 * Method to stop a running timer and create a timer entry.
 *
 * **NOTE:** This method also creates a [browser performance measure]{@link https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMeasure}
 * with the label that was passed to {@link Tracker.start start}.
 *
 * @param data Optional data to include in the timer entry.
 */
export interface TimerStopFunction { (data?: Record<string, any>): void }

/**
 * Starts a timing tree. Unlike the normal {@link Tracker.start start} method, this
 * method does _not_ return a stop function. Instead, it returns an array. The first
 * value in the array is the stop function; the second argument is another start function
 * you can invoke to begin a new nested timing.
 *
 * @param label The label of the nested timer to create.
 * @returns The `[stop, start]` methods you can use to
 * end the current timing or start a nested timing. The first function
 * is a normal {@link TimerStopFunction} and the second function is
 * another {@link NestedTimingTracker.start} function.
 * @example
 * ```js
 * import { tracker } from '~/tracking';
 * import { someDataCall, someOtherDataCall } from '~/data/operations';
 *
 * const child = tracker.child();
 * const logger = trackers.utils.withNesting(child);
 *
 * export async function loadData(id) {
 *   try {
 *     const [stop, start] = logger.start('load data');
 *     const data = await someDataCall(id);
 *     const results = await loadNestedData(start, data);
 *     stop({ id, results });
 *     return results;
 *   } catch (e) {
 *     logger.error(e);
 *   }
 * }
 *
 * async function loadNestedData(start, data) {
 *   const [stop, ] = start('load nested data');
 *   const results = await someOtherDataCall(data);
 *   stop();
 *   return results;
 * }
 * ```
 */
export interface NestedStart { (label: string): NestedStartResult }

/**
 * Array of functions returned by calling {@link NestedTimingTracker.start start}
 * on a {@link NestedTimingTracker} instance. The first function stops the current
 * timer. The second function starts a new nested timer.
 */
export type NestedStartResult = [TimerStopFunction, NestedStart];

/**
 * Represents the functionality common to all Tracker sub-types.
 */
export interface BaseTracker {

    /**
     * Generates a random RFC 4122 UUID guaranteed to be unique.
     *
     * @returns A [RFC 4122 v4 UUID]{@link https://tools.ietf.org/html/rfc4122#section-4.4}
     * @example
     * ```js
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
     * ```
     */
    uuid(): string

    /**
    * Creates a child Tracker instance.
    *
    * @returns A new Tracker instance that will notify the same
    * root subscriber of {@link TrackingInfo} entries, mixing in ancestor
    * contextual data as needed.
    * @example
    * ```js
    * import { tracker } from '~/tracking';
    *
    * // this tracker will inherit any context data
    * // set in landing's tracker while also mixing
    * // in any contextual data of its own
    * export const myAppTracker = tracker.child();
    *
    * myAppTracker.context({ app: 'my-app' });
    * myAppTracker.event('app tracker created');
     * ```
    */
    child(): Tracker

    /**
    * Sets contextual data to be mixed into each TrackingInfo created
    * by this Tracker or any child Trackers.
    *
    * @param data The data to merge into any
    * {@link TrackingInfo} instances created by this (or child) Tracker
    * methods.
    * @example
    * ```js
    * import { get } from 'lodash';
    * import { store, tracker } from '~/tracking';
    *
    * store.subscribe(() => {
    *   const state = store.getState();
    *   const app = get(state, 'routes.stage');
    *   const drawer = get(state, 'routes.drawer');
    *   tracker.context({ app, drawer });
    * });
     * ```
    */
    context(data: Record<string, any>): void

    /**
     * Logs an event. Events usually represent important points in an application's
     * lifecycle or user-initiated actions such as button clicks.
     *
     * **NOTE:** This method also creates a [browser performance mark]{@link https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark} with the given message name.
     *
     * @param label The name of the event to log.
     * @param data Optional information to associate with this {@link TrackingInfo}.
     * @example
     * ```js
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
     * ```
     */
    event(label: string, data?: Record<string, any>): void

    /**
    * Logs an [Error]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error}.
    *
    * @param err The Error instance to log.
    * @example
    * ```js
    * import { tracker } from '~/tracking';
    *
    * export function doSomething(param) {
    *   somePromiseMethod()
    *     .catch(errors.rethrow({ param }))
    *     .catch(tracker.error);
    * }
     * ```
    */
    error(err: Error): void

}

/**
 * Provides methods for logging events, errors, and performance.
 *
 * **Best Practices**
 *
 * - Combine {@link Tracker.child tracker.child()} with {@link Tracker.context tracker.context()}
 * to set cross-cutting information specific to your application and to each high-level business
 * process or transaction you have to track. You can create any number of child trackers that
 * inherit settings from their ancestors.
 *
 * @example
 * ```js
 * // app/index.js
 *
 * export const tracker = trackers.create();
 *
 * tracker.context({
 *   app: 'my-app'
 * });
 * ```
 * @example
 * ```js
 * // app/components/search.js
 *
 * // import the root tracker with 'app' defined
 * import { tracker } from '../index';
 * import { fetch, createRequest } from '../data';
 *
 * // create a child tracker for use
 * // only within this file
 * const fileTracker = tracker.child();
 *
 * // all calls to child tracker methods
 * // will include this 'component', along
 * // with 'app' set by the root tracker
 * fileTracker.context({
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
 *   // create a child tracker for use only within
 *   // the lifetime of this function (ensures each
 *   // call to this function gets its own context)
 *   const methodTracker = fileTracker.child();
 *
 *   // set data specific to this invocation
 *   methodTracker.context({ query });
 *
 *   // the following event will include 'query'
 *   // and 'component' from ancestor trackers
 *   // as well as 'app' from the root tracker
 *   methodTracker.event('search');
 *
 *   const params = { query };
 *   const stop = methodTracker.start('perform search');
 *   const request = createRequest(operation, params);
 *   const response = await fetch(request).catch(errors.rethrow(params));
 *   const results = response.data;
 *
 *   // the following timer will include 'query',
 *   // 'component', 'app', and -- only on this
 *   // timer -- a 'status' value
 *   stop({ status: results.length ? 'Found' : 'Not Found' });
 *
 *   return models.utils.withOrdering(models.collection(...results), ['priority'], ['desc']);
 * }
 * ```
 */
export interface Tracker extends BaseTracker {

    /**
    * Starts a timer to measure performance.
    *
    * @returns Method to invoke to stop and log the timer.
    * @example
    * ```js
    * import { tracker } from '~/tracking';
    *
    * export async function doSomething(param) {
    *   const stop = tracker.start('doSomething');
    *   const results = await somePromiseMethod();
    *   stop({ count: results.length, param });
    *   return results;
    * }
    * ```
    */
    start(label: string): TimerStopFunction

}

/**
 * **NOTE:** The only difference between this interface and the normal {@link Tracker}
 * is how the {@link NestedTimingTracker.start start} method works. Creating nested
 * timings introduces new edge cases that are important for you to understand:
 *
 * ### Edge Cases
 *
 * #### Calling stop() Multiple Times
 *
 * Normally, invoking the `stop()` function returned from `start()` multiple times
 * will create a separate timing entry for each invocation and increase the entry's
 * `count` property.
 *
 * With a nested timer, that only holds true for the root timing. For _nested_ timings,
 * calling `stop()` multiple times creates _sibling_ entries, incrementing `count`
 * with each invocation:
 *
 * ```js
 * import { tracker } from '~/tracker';
 *
 * const logger = trackers.utils.withNesting(tracker);
 *
 * async function makeParallelDataCalls(start) {
 *     const [stop] = start('parallel calls');
 *     await Promise.all([
 *         someDataCall().then(() => stop()),
 *         someOtherDataCall().then(() => stop()),
 *         someLastDataCall().then(() => stop())
 *     ]);
 * }
 *
 * export async function loadData() {
 *     const [stop, start] = logger.start('load data');
 *     await makeParallelDataCalls(start);
 *     stop();
 * }
 * ```
 *
 * #### timing tree:
 *
 * ```json
 * {
 *   "id": "9c6f8a25-5003-4b17-b3d6-838144c54a7d",
 *   "label": "load data",
 *   "start": 1562933463457,
 *   "stop": 1562933463490,
 *   "duration": 33,
 *   "type": "timer",
 *   "count": 1,
 *   "data": {
 *     "children": [
 *       {
 *         "label": "parallel calls",
 *         "count": 1,
 *         "start": 1562933463458,
 *         "stop": 1562933463488,
 *         "duration": 30,
 *         "data": {
 *           "children": []
 *         }
 *       },
 *       {
 *         "label": "parallel calls",
 *         "count": 2,
 *         "start": 1562933463458,
 *         "stop": 1562933463490,
 *         "duration": 32,
 *         "data": {
 *           "children": []
 *         }
 *       },
 *       {
 *         "label": "parallel calls",
 *         "count": 3,
 *         "start": 1562933463458,
 *         "stop": 1562933463490,
 *         "duration": 32,
 *         "data": {
 *           "children": []
 *         }
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * #### Stopping Parents Before Children
 *
 * It is okay for nested timings to stop _after_ an ancestor timing stops. However,
 * when the _root_ timing is stopped, only completed timings will appear in the timing
 * tree. In other words, any nested timings that are still running will _not_ appear
 * in the timing tree.
 *
 * ```js
 * import { tracker } from '~/tracker';
 *
 * const logger = trackers.utils.withNesting(tracker);
 *
 * async function childData(start) {
 *     const [stop] = start('child timing');
 *     await someDataCall();
 *     stop();
 * }
 *
 * export async function loadData() {
 *     const [stop, start] = logger.start('load data');
 *     childData(start); // BUG! we forgot to await this async function!
 *     // because we didn't wait for childData to complete, the next line
 *     // will invoke stop WHILE the async function is still running...
 *     stop();
 * }
 * ```
 *
 * #### timing tree:
 *
 * ```json
 * {
 *   "id": "ca0f72ad-eb9a-4b07-96ec-6292b8d2317f",
 *   "label": "load data",
 *   "start": 1562936590429,
 *   "stop": 1562936590440,
 *   "duration": 11,
 *   "type": "timer",
 *   "count": 1,
 *   "data": {
 *     "children": []
 *   }
 * }
 * ```
 * #### Creating Child Trackers
 *
 * Even on a NestedTimingTracker, calling {@link Tracker.child child()} creates
 * a normal {@link Tracker} instance. So, if you call `start()` on a child Tracker,
 * it will not use nested timings. If you want to combine child Trackers with
 * nested timings, you should change your call order:
 *
 * ```js
 * import { tracker } from '~/tracker';
 *
 * // INCORRECT ✘
 * const logger = trackers.utils.withNesting(tracker);
 * const child = logger.child();
 *
 * // CORRECT ✓
 * const child = tracker.child();
 * const logger = trackers.utils.withNesting(child);
 * ```
 *
 * ### Best Practices
 *
 * If you need to create a nested timing, that is a good indication that the
 * code should exist in a separate function. When you call this function, you
 * should pass the nested `start` function so that function can continue the
 * pattern by creating any nested timings it needs (now or in the future):
 *
 * ```js
 * import { tracker } from '~/tracker';
 *
 * const logger = trackers.utils.withNesting(tracker);
 *
 * // INCORRECT ✘
 * export async function loadData() {
 *   const [stop, start] = logger.start('load data');
 *   start('nested timing');
 *   await someDataCall();
 *   stop();
 * }
 *
 * // CORRECT ✓
 * export async function loadData() {
 *   const [stop, start] = logger.start('load data');
 *   await loadChildData(start);
 *   stop();
 * }
 *
 * async function loadChildData(start) {
 *   const [stop, nest] = start('nested timing');
 *   // now we can pass `nest` to another function to
 *   // continue our pattern of creating nested timings
 *   await someDataCall();
 *   stop();
 * }
 * ```
 */
export interface NestedTimingTracker extends BaseTracker {

    /**
     * Starts a timing tree. Unlike the normal {@link Tracker.start start} method, this
     * method does _not_ return a stop function. Instead, it returns an array. The first
     * value in the array is the stop function; the second argument is another start function
     * you can invoke to begin a new nested timing.
     *
     * @param label The label of the nested timer to create.
     * @returns The `[stop, start]` methods you can use to
     * end the current timing or start a nested timing. The first function
     * is a normal {@link TimerStopFunction} and the second function is
     * another {@link NestedTimingTracker.start} function.
     * @example
     * ```js
     * import { tracker } from '~/tracking';
     * import { someDataCall, someOtherDataCall } from '~/data/operations';
     *
     * const child = tracker.child();
     * const logger = trackers.utils.withNesting(child);
     *
     * export async function loadData(id) {
     *   try {
     *     const [stop, start] = logger.start('load data');
     *     const data = await someDataCall(id);
     *     const results = await loadNestedData(start, data);
     *     stop({ id, results });
     *     return results;
     *   } catch (e) {
     *     logger.error(e);
     *   }
     * }
     *
     * async function loadNestedData(start, data) {
     *   const [stop, ] = start('load nested data');
     *   const results = await someOtherDataCall(data);
     *   stop();
     *   return results;
     * }
     * ```
     */
    start(label: string): NestedStartResult

}

/**
 * Invoked each time a {@link Tracker} (or child Tracker) method produces
 * a new {@link TrackingInfo} instance.
 *
 * @param info
 * @example
 * ```js
 * const tracker = trackers.create((info) => {
 *   console.log(JSON.stringify(info));
 * });
 * ```
 * @example
 * ```js
 * // delegating tracking entries to a Redux store
 *
 * import { store } from '~/path/to/actions';
 *
 * const tracker = trackers.create((info) => {
 *   store.dispatch({
 *     type: `track:${info.type}`,
 *     payload: info
 *   });
 * });
 * ```
 */
export interface TrackingSubscriber { (info: TrackingInfo): void }

function tryMark(label: string) {
    invoke(globalThis, 'performance.mark', label)
}

function tryMeasure(label: string, start: string) {
    invoke(globalThis, 'performance.measure', label, start);
}

function systemNow(): number {
    return invoke(Date, 'now') || new Date().getTime();
}

function absoluteNow(): number {
    const epoch = systemNow();
    const fallback = get(globalThis, 'performance.timing.navigationStart', loadTime);
    const base = get(globalThis, 'performance.timeOrigin', fallback);
    const offset = invoke(globalThis, 'performance.now') || epoch - loadTime;
    return base + offset;
}

const loadTime = systemNow();

/**
 * Creates a new {@link Tracker} instance. The specified subscriber will
 * be notified when new {@link TrackingInfo} entries are created.
 *
 * @param subscriber A method that will invoked
 * each time a {@link TrackingInfo} entry is created.
 * @returns The new Tracker instance.
 * @example
 * ```js
 * const tracker = trackers.create((info) => {
 *   console.log(JSON.stringify(info));
 * });
 * ```
 */
export function create(subscriber?: TrackingSubscriber): Tracker {

    const context = {};

    function getContext(...args: object[]) {
        return mergeWith({}, context, ...args, customizer);
    }

    if (!isFunction(subscriber))
        subscriber = noop;

    return {

        uuid,

        child() {
            return create((info) => {
                defaultsDeep(info.data, context);
                subscriber(info);
            });
        },

        context(data: object) {
            mergeWith(context, data, customizer);
        },

        event(message: string, data: object) {
            const id = uuid();
            const now = absoluteNow();
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

        error(err: Error) {
            const id = uuid();
            const now = absoluteNow();
            if (!isError(err))
                return console.warn('A non-Error was passed to tracker.error:', err);
            set(err, 'count', get(err, 'count', 0) + 1);
            subscriber(Object.freeze({
                id,
                type: 'error',
                label: err.message,
                start: now,
                stop: now,
                duration: 0,
                count: get(err, 'count'),
                data: getContext(err, {
                    // non-enumerable properties
                    // we want to track should be
                    // explicitly retrieved here
                    name: err.name,
                    stack: err.stack
                })
            }));
        },

        start(label: string): TimerStopFunction {
            let count = 0;
            const id = uuid();
            const start = absoluteNow();
            tryMark(id);
            return function end(data) {
                const stop = absoluteNow();
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
