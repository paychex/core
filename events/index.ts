/**
 * Provides event publish/subscribe functionality.
 *
 * ```js
 * // esm
 * import { events } from '@paychex/core';
 *
 * // cjs
 * const { events } = require('@paychex/core');
 *
 * // iife
 * const { events } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ events }) { ... });
 * define(['@paychex/core'], function({ events }) { ... });
 * ```
 *
 * @module events
 */

import { rethrow } from '../errors/index';
import { parallel } from '../functions/index';
import { GroupedFunction } from '../functions';

/**
 * Provides publish/subscribe functionality.
 *
 * @example
 * ```js
 * import { tracker } from '~/tracking';
 *
 * const bus = events.bus();
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
 * ```
 */
export interface EventBus {

    /**
    * Notifies any subscribers registered through {@link on on}
    * or {@link on one} that the specified event has occurred. If
    * any subscribers throw an exception then the {@link fire fire}
    * promise will be rejected, but any other subscribers will continue to be
    * notified of the initial event.
    *
    * @param event The name of the event to fire.
    * @param args Optional arguments to pass to subscribers.
    * @returns Returns `false` if the bus is stopped. Otherwise,
    * returns a Promise that will resolve with an array of values returned by
    * event subscribers, or reject with the first Promise rejection or thrown error.
    * @example
    * ```js
    * import { tracker } from '~/tracking';
    *
    * const bus = events.bus();
    *
    * bus.on('event', async function handler(value1, value2) {
    *   return await someAsyncMethod(value1, value2);
    * });
    *
    * bus.fire('event', arg1, arg2);
    * const results = await bus.fire('event', arg1, arg2);
    * await bus.fire('event', arg1, arg2).catch(tracker.error);
    * ```
    * @example
    * ```js
    * const bus = events.bus();
    *
    * async function dirtyCheck(container, path) {
    *   if (container.dirty)
    *     throw errors.error('save your changes');
    * }
    *
    * async function navigate(container, path) {
    *   // load new route
    * }
    *
    * bus.on('navigate', functions.sequence(dirtyCheck, navigate));
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
    * ```
    * @example
    * ```js
    * const bus1 = events.bus(null, functions.sequence);
    * const bus2 = events.bus(null, functions.parallel); // the default behavior
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
    * ```
    */
    fire(event: string, ...args: any[]): Promise<any[]>

    /**
     * Registers a subscriber for the given event. The subscriber will be invoked
     * in the context used to create the {@link EventBus} and passed any arguments
     * provided to the {@link fire fire method}.
     *
     * @param event The name of the event to listen for.
     * @param subscriber The subscriber to invoke when the event is fired.
     * @returns Method to invoke to remove the subscriber.
     * @example
     * ```js
     * import { createSomething } from '../someFactory';
     *
     * const obj = createSomething();
     * const bus = events.bus(obj); // subscriber context
     *
     * bus.one('initialize', function init() {
     *   // this only runs the first time
     *   // the 'initialize' event is fired;
     * });
     *
     * export const off = bus.on('some-event', function handler(arg) {
     *   console.log(this === obj); // true
     * });
    * ```
     */
    on(event: string, subscriber: Function): VoidFunction

    /**
     * Similar to {@link on on}, except the subscriber
     * will be removed as soon as it is invoked.
     *
     * @param event The name of the event to listen for.
     * @param subscriber The subscriber to invoke when the event is fired.
     * @returns Method to invoke to remove the subscriber.
     */
    one(event: string, subscriber: Function): VoidFunction

    /**
     * Resumes notifying subscribers after {@link stop stop} was called. Any
     * events fired before resuming are dropped entirely.
     *
     * @example
     * ```js
     * const bus = events.bus();
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
     * ```
     */
    resume(): void

    /**
    * Stops notifying subscribers of fired events until {@link resume resume} is called.
    *
    * @example
    * ```js
    * const bus = events.bus();
    *
    * bus.on('add', function handler(value1, value2) {
    *   console.log(value1 + value2);
    * });
    *
    * bus.fire('add', 1, 2); // 3
    * bus.stop();
    * bus.fire('add', 1, 2); // does not invoke subscriber
    * ```
    */
    stop(): void

}

export interface ModeFunction {
    (): GroupedFunction<any>
}

const stubPromise = () => Promise.resolve();

/**
 * Creates a new {@link EventBus} to enable publish/subscribe behavior.
 *
 * @param context An optional `this` context to use when invoking subscribers.
 * @param mode Optional factory to create an execution processor. The
 * default is {@link parallel}, but you could also pass {@link sequence}
 * or your own factory method. See the examples.
 * @returns An EventBus that provides publish/subscribe functionality.
 * @example
 * ```js
 * import { tracker } from '~/tracking';
 *
 * const bus = events.bus();
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
 * ```
 * @example
 * ```js
 * // custom handler context
 *
 * const context = {
 *   key: 'value'
 * };
 *
 * const bus = events.bus(context); // subscriber context
 *
 * // NOTE: to access `this` in this handler
 * // we MUST use a real function and NOT the
 * // fat arrow syntax: () => {}
 * bus.on('custom-event', function handler() {
 *   console.log(this.key); // 'value'
 * });
 * ```
 * @example
 * ```js
 * // sequential mode
 *
 * const bus = events.bus(null, functions.sequence);
 *
 * bus.on('event', handler1); // runs first
 * bus.on('event', handler2); // runs after
 *
 * export async function trigger(...args) {
 *   await bus.fire('event', ...args);
 * }
 * ```
 * @example
 * ```js
 * // combining bus, sequence, and parallel
 *
 * // allow users to register concurrent event handlers;
 * // if any of these handlers throw an exception, the
 * // fired event will be rejected
 * const interceptors = functions.parallel();
 *
 * export function addInterceptor(fn) {
 *   interceptors.add(fn);
 *   return function remove() {
 *     interceptors.remove(fn);
 *   };
 * }
 *
 * // our internal event handler will run after any
 * // interceptors have run and be provided the results
 * // returned by all the interceptors
 * async function internalHandler(...args, results) {
 *   // results is array of values returned from interceptors
 * }
 *
 * // all interceptors will have access to our context
 * // object (e.g. `this.store` inside the subscriber)
 * const context = {
 *   store: stores.memoryStore(),
 * };
 *
 * // execute handlers sequentially
 * // instead of in parallel
 * const bus = events.bus(context, functions.sequence);
 *
 * bus.on('event', interceptors);    // run first
 * bus.on('event', internalHandler); // run second
 *
 * // we could also have written:
 * // const bus = events.bus(context);
 * // bus.on('event', functions.sequence(interceptors, internalHandler));
 *
 * export async function run(...args) {
 *   return await bus.fire('event', ...args);
 * }
 * ```
 */
export function bus(context?: any, mode: ModeFunction = parallel): EventBus {

    let stopped = false;
    const subscribers = new Map<string, GroupedFunction<any>>();

    function on(event: string, subscriber: Function): VoidFunction {
        const handler = subscriber.bind(context);
        const handlers = subscribers.get(event) || mode();
        handlers.add(handler);
        subscribers.set(event, handlers);
        return function off() {
            subscribers.get(event).remove(handler);
        };
    }

    function one(event: string, subscriber: Function): VoidFunction {
        function handler(...args: any[]) {
            off();
            subscriber.apply(this, args);
        }
        const off = on(event, handler);
        return off;
    }

    function stop() {
        stopped = true;
    }

    function resume() {
        stopped = false;
    }

    function fire(event: string, ...args: any[]): Promise<any[]> {
        const handlers = subscribers.get(event) || stubPromise;
        return !stopped && handlers(...args).catch(rethrow({ event, args }));
    }

    return {
        on,
        one,
        fire,
        stop,
        resume,
    };

}
