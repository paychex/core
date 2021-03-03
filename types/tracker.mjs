/**
 * Encapsulates tracking information. The {@link TrackingSubscriber}
 * will be invoked with an instance for each {@link Tracker} (or child
 * Tracker) method invoked.
 *
 * @class
 * @global
 * @hideconstructor
 */
export class TrackingInfo {

    /**
     * A random [RFC 4122 UUID]{@link https://tools.ietf.org/html/rfc4122#section-4.4}.
     *
     * @type {string}
     * @memberof TrackingInfo#
     */
    id = ''

    /**
     * The type of tracking information provided in this object. Either `'event'`, `'timer'`, or `'error'`.
     *
     * @type {string}
     * @memberof TrackingInfo#
     */
    type = ''

    /**
     * The description of this tracking entry.
     *
     * @type {string}
     * @memberof TrackingInfo#
     */
    label = ''

    /**
     * The number of milliseconds between January 1, 1970 00:00:00 UTC and when this entry was created.
     *
     * @type {number}
     * @memberof TrackingInfo#
     */
    start = 0

    /**
     * The number of milliseconds between January 1, 1970 00:00:00 UTC and when this entry was ended.
     *
     * @type {number}
     * @memberof TrackingInfo#
     */
    stop = 0

    /**
     * The difference in milliseconds between start and stop.
     *
     * @type {number}
     * @memberof TrackingInfo#
     */
    duration = 0

    /**
     * The number of times this entry has been logged.
     *
     * @type {number}
     * @memberof TrackingInfo#
     */
    count = 0

    /**
     * Optional additional data associated with this tracking entry.
     *
     * @memberof TrackingInfo#
     * @type {Object.<string, any>}
     */
    data = {}

}

/**
 * Method to stop a running timer and create a timer entry.
 *
 * **NOTE:** This method also creates a [browser performance measure]{@link https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMeasure}
 * with the label that was passed to {@link Tracker#start start}.
 *
 * @global
 * @ignore
 * @callback TimerStopFunction
 * @param {Object.<string, any>} [data] Optional data to include in the timer entry.
 */
function TimerStopFunction(data) {}

/**
 * Starts a timing tree. Unlike the normal {@link Tracker#start start} method, this
 * method does _not_ return a stop function. Instead, it returns an array. The first
 * value in the array is the stop function; the second argument is another start function
 * you can invoke to begin a new nested timing.
 *
 * @ignore
 * @callback NestedStart
 * @param {string} label The label of the nested timer to create.
 * @returns {NestedStartResult} The `[stop, start]` methods you can use to
 * end the current timing or start a nested timing. The first function
 * is a normal {@link TimerStopFunction} and the second function is
 * another {@link NestedTimingTracker#start} function.
 * @example
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
 */
function NestedStart(label) {}

/**
 * Array of functions returned by calling {@link NestedTimingTracker#start start}
 * on a {@link NestedTimingTracker} instance. The first function stops the current
 * timer. The second function starts a new nested timer.
 *
 * @class
 * @global
 * @hideconstructor
 */
class NestedStartResult extends Array {

    /**
     * Stops the nested timer.
     *
     * @memberof NestedStartResult#
     * @type {TimerStopFunction}
     */
    [0]

    /**
     * Start a new nested timer.
     *
     * @memberof NestedStartResult#
     * @type {NestedStart}
     */
    [1]

}

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
 * @class
 * @global
 * @hideconstructor
 * @example
 * // app/index.js
 *
 * export const tracker = trackers.create();
 *
 * tracker.context({
 *   app: 'my-app'
 * });
 * @example
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
 */
export class Tracker {

    /**
     * Generates a random RFC 4122 UUID guaranteed to be unique.
     *
     * @method Tracker#uuid
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
    uuid() { }

    /**
    * Creates a child Tracker instance.
    *
    * @method Tracker#child
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
    child() { }

    /**
    * Sets contextual data to be mixed into each TrackingInfo created
    * by this Tracker or any child Trackers.
    *
    * @method Tracker#context
    * @param {Object.<string, any>} data The data to merge into any
    * {@link TrackingInfo} instances created by this (or child) Tracker
    * methods.
    * @example
    * import { get } from 'lodash-es';
    * import { store, tracker } from '~/tracking';
    *
    * store.subscribe(() => {
    *   const state = store.getState();
    *   const app = get(state, 'routes.stage');
    *   const drawer = get(state, 'routes.drawer');
    *   tracker.context({ app, drawer });
    * });
    */
    context(data) { }

    /**
     * Logs an event. Events usually represent important points in an application's
     * lifecycle or user-initiated actions such as button clicks.
     *
     * **NOTE:** This method also creates a [browser performance mark]{@link https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark} with the given message name.
     *
     * @method Tracker#event
     * @param {string} label The name of the event to log.
     * @param {Object.<string, any>} [data] Optional information to associate with this {@link TrackingInfo}.
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
    event(label, data) { }

    /**
    * Logs an [Error]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error}.
    *
    * @method Tracker#error
    * @param {Error} err The Error instance to log.
    * @example
    * import { tracker } from '~/tracking';
    *
    * export function doSomething(param) {
    *   somePromiseMethod()
    *     .catch(errors.rethrow({ param }))
    *     .catch(tracker.error);
    * }
    */
    error(err) { }

    /**
    * Starts a timer to measure performance.
    *
    * @method Tracker#start
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
    start(label) { }

}

/**
 * **NOTE:** The only difference between this class and the normal {@link Tracker}
 * is how the {@link NestedTimingTracker#start start} method works. Creating nested
 * timings introduces new edge cases that are important for you to understand:
 *
 * ### Edge Cases
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
 * ```javascript
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
 *
 * // timing tree:
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
 * ```javascript
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
 *
 * // timing tree:
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
 * Even on a NestedTimingTracker, calling {@link Tracker#child child()} creates
 * a normal {@link Tracker} instance. So, if you call `start()` on a child Tracker,
 * it will not use nested timings. If you want to combine child Trackers with
 * nested timings, you should change your call order:
 *
 * ```javascript
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
 * ```javascript
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
 *
 * @class
 * @global
 * @hideconstructor
 * @augments Tracker
 */
export class NestedTimingTracker extends Tracker {

    /**
     * Starts a timing tree. Unlike the normal {@link Tracker#start start} method, this
     * method does _not_ return a stop function. Instead, it returns an array. The first
     * value in the array is the stop function; the second argument is another start function
     * you can invoke to begin a new nested timing.
     *
     * @override
     * @method NestedTimingTracker#start
     * @param {string} label The label of the nested timer to create.
     * @returns {NestedStartResult} The `[stop, start]` methods you can use to
     * end the current timing or start a nested timing. The first function
     * is a normal {@link TimerStopFunction} and the second function is
     * another {@link NestedTimingTracker#start} function.
     * @example
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
     */
    start(label) { }

}

/**
 * Invoked each time a {@link Tracker} (or child Tracker) method produces
 * a new {@link TrackingInfo} instance.
 *
 * @global
 * @callback TrackingSubscriber
 * @param {TrackingInfo} info
 * @example
 * const tracker = trackers.create((info) => {
 *   console.log(JSON.stringify(info));
 * });
 * @example
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
 */
function TrackingSubscriber(info) {}
