/**
 * @class
 * @global
 * @hideconstructor
 */
export class InvocationData extends Array {

    /**
     * The invocation context.
     *
     * @memberof InvocationData#
     */
    [0] = null

    /**
     * The arguments passed to this invocation.
     *
     * @memberof InvocationData#
     */
    [1] = []

}

/**
 * Provides publish/subscribe functionality.
 *
 * @global
 * @class
 * @hideconstructor
 * @example
 * import { eventBus } from '@paychex/core';
 * import { tracker } from '~/tracking';
 *
 * const bus = eventBus();
 *
 * bus.on('event', function handler(arg1, arg2) {
 *   console.log(`received ${arg1} and ${arg2}`);
 *   return arg1 + arg2;
 * });
 *
 * // subscribers can be asynchronous
 * bus.on('event', async function handler(arg1, arg2) {
 *   const result = await someAsyncMethod(arg1);
 *   await someOtherAsyncMethod(result, arg2);
 *   return 'abc';
 * });
 *
 * // fire and forget
 * bus.fire('event', 1, 2);
 *
 * // catch any rejected promises returned by
 * // handlers (or errors thrown by handlers)
 * await bus.fire('event', 1, 2).catch(tracker.error);
 *
 * // examine the return values of handlers
 * const results = await bus.fire('event', 1, 2);
 * console.log(results); // [3, 'abc']
 */
export class EventBus {

    /**
    * Notifies any subscribers registered through {@link EventBus#on on}
    * or {@link EventBus#on one} that the specified event has occurred. If
    * any subscribers throw an exception then the {@link EventBus#fire fire}
    * promise will be rejected, but any other subscribers will continue to be
    * notified of the initial event.
    *
    * @method EventBus#fire
    * @param {string} event The name of the event to fire.
    * @param {...any} [args] Optional arguments to pass to subscribers.
    * @returns {boolean|Promise} Returns `false` if the bus is stopped. Otherwise,
    * returns a Promise that will resolve with an array of values returned by
    * event subscribers, or reject with the first Promise rejection or thrown error.
    * @example
    * import { eventBus } from '@paychex/core';
    * import { tracker } from '~/tracking';
    *
    * const bus = eventBus();
    *
    * bus.on('event', async function handler(value1, value2) {
    *   return await someAsyncMethod(value1, value2);
    * });
    *
    * bus.fire('event', arg1, arg2);
    * const results = await bus.fire('event', arg1, arg2);
    * await bus.fire('event', arg1, arg2).catch(tracker.error);
    * @example
    * import { eventBus, sequence } from '@paychex/core';
    * import { error } from '@paychex/core/errors';
    *
    * const bus = eventBus();
    *
    * async function dirtyCheck(container, path) {
    *   if (container.dirty)
    *     throw error('save your changes');
    * }
    *
    * async function navigate(container, path) {
    *   // load new route
    * }
    *
    * bus.on('navigate', sequence(dirtyCheck, navigate));
    *
    * export async function navigate(container, path) {
    *   await bus.fire('navigate', container, path);
    * }
    *
    * // caller
    * function linkHandler(e) {
    *   e.preventDefault();
    *   e.stopPropagation();
    *   const route = e.target.getAttribute('route');
    *   const container = e.target.getAttribute('container');
    *   navigate(container, route).then(
    *     () => console.info('navigation complete'),
    *     (err) => console.log('navigation failed', err);
    *   );
    * }
    * @example
    * import { eventBus, sequence, parallel } from '@paychex/core';
    *
    * const bus1 = eventBus(null, sequence);
    * const bus2 = eventBus(null, parallel); // the default behavior
    *
    * function handler1() {
    *   return 1;
    * }
    *
    * function handler2() {
    *   return 2;
    * }
    *
    * bus1.on('event', handler1);
    * bus1.on('event', handler2);
    *
    * // sequence bus returns last subscriber's return value
    * await bus1.fire('event'); // 2
    *
    * bus2.on('event', handler1);
    * bus2.on('event', handler2);
    *
    * // parallel bus returns array
    * await bus2.fire('event'); // [1, 2]
    */
    fire() { }

    /**
     * Registers a subscriber for the given event. The subscriber will be invoked
     * in the context used to create the {@link EventBus} and passed any arguments
     * provided to the {@link EventBus#fire fire method}.
     *
     * @method EventBus#on
     * @param {string} event The name of the event to listen for.
     * @param {Function} subscriber The subscriber to invoke when the event is fired.
     * @returns {Function} Method to invoke to remove the subscriber.
     * @example
     * import { eventBus } from '@paychex/core';
     * import { createSomething } from '../someFactory';
     *
     * const obj = createSomething();
     * const bus = eventBus(obj); // subscriber context
     *
     * bus.one('initialize', function init() {
     *   // this only runs the first time
     *   // the 'initialize' event is fired;
     * });
     *
     * export const off = bus.on('some-event', function handler(arg) {
     *   console.log(this === obj); // true
     * });
     */
    on() { }

    /**
     * Similar to {@link EventBus#on on}, except the subscriber
     * will be removed as soon as it is invoked.
     *
     * @method EventBus#one
     * @param {string} event The name of the event to listen for.
     * @param {Function} subscriber The subscriber to invoke when the event is fired.
     * @returns {Function} Method to invoke to remove the subscriber.
     */
    one() { }

    /**
     * Resumes notifying subscribers after {@link EventBus#stop stop} was called. Any
     * events fired before resuming are dropped entirely.
     *
     * @method EventBus#resume
     * @example
     * import { eventBus } from '@paychex/core';
     *
     * const bus = eventBus();
     *
     * bus.on('add', function handler(value1, value2) {
     *   console.log(value1 + value2);
     * });
     *
     * bus.fire('add', 1, 2); // 3
     * bus.stop();
     * bus.fire('add', 1, 2); // does not invoke subscriber
     * bus.resume();
     * bus.fire('add', 1, 2); // 3
     */
    resume() { }

    /**
    * Stops notifying subscribers of fired events until {@link EventBus#resume resume} is called.
    *
    * @method EventBus#stop
    * @example
    * import { eventBus } from '@paychex/core';
    *
    * const bus = eventBus();
    *
    * bus.on('add', function handler(value1, value2) {
    *   console.log(value1 + value2);
    * });
    *
    * bus.fire('add', 1, 2); // 3
    * bus.stop();
    * bus.fire('add', 1, 2); // does not invoke subscriber
    */
    stop() { }

}
