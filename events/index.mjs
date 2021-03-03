import { rethrow } from '../errors/index.mjs';
import { parallel } from '../functions/index.mjs';

/**
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
 * Provides event publish/subscribe functionality.
 *
 * @module events
 */

const stubPromise = () => Promise.resolve();

/**
 * Creates a new {@link EventBus} to enable publish/subscribe behavior.
 *
 * @function
 * @param {*} [context=undefined] An optional `this` context to use when invoking subscribers.
 * @param {Parallel} [mode=parallel] Optional factory to create an execution processor. The
 * default is {@link module:functions~parallel parallel}, but you could also pass {@link module:functions~sequence sequence}
 * or your own factory method. See the examples.
 * @returns {EventBus} An EventBus that provides publish/subscribe functionality.
 * @example
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
 * @example
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
 * @example
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
 * @example
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
 */
export function bus(context, mode = parallel) {

    let stopped = false;
    const subscribers = new Map();

    function on(event, subscriber) {
        const handler = subscriber.bind(context);
        const handlers = subscribers.get(event) || mode();
        handlers.add(handler);
        subscribers.set(event, handlers);
        return function off() {
            subscribers.get(event).remove(handler);
        };
    }

    function one(event, subscriber) {
        function handler(...args) {
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

    function fire(event, ...args) {
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
