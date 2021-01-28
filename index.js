import iteratee from 'lodash/iteratee.js';
import identity from 'lodash/identity.js';
import { rethrow } from './errors/index.js';

import {
    EventBus,
    InvocationData,
} from './types/index.js';

import {
    Semaphore,
    CountdownSignal,
    AutoResetSignal,
    ManualResetSignal,
} from './types/signals.js';

class UnusedEventBus extends EventBus {}
class UnusedSemaphore extends Semaphore {}
class UnusedCountdown extends CountdownSignal {}
class UnusedAutoReset extends AutoResetSignal {}
class UnusedManualReset extends ManualResetSignal {}
class UnusedInvocationData extends InvocationData {}

const stubPromise = () => Promise.resolve();

/**
 * Contains utilities that do not fall under any of the other module categories.
 *
 * @module index
 * @example
 * // combining eventBus, sequence, and parallel
 *
 * import { eventBus, sequence, parallel } from '@paychex/core';
 * import { localStore } from '@paychex/core/stores';
 *
 * // allow users to register concurrent event handlers;
 * // if any of these handlers throw an exception, the
 * // fired event will be rejected
 * const interceptors = parallel();
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
 * async function internalHandler(...args, lastResult) {
 *   // lastResult is array of results from interceptors
 * }
 *
 * // all interceptors will have access to our context
 * // object (e.g. `this.store` inside the subscriber)
 * const context = {
 *   store: localStore(),
 * };
 *
 * // execute handlers sequentially
 * // instead of in parallel
 * const bus = eventBus(context, sequence);
 *
 * bus.on('event', interceptors);    // run first
 * bus.on('event', internalHandler); // run second
 *
 * // we could also have written:
 * // const bus = eventBus(context);
 * // bus.on('event', sequence(interceptors, internalHandler));
 *
 * export async function run(...args) {
 *   return await bus.fire('event', ...args);
 * }
 */

/**
 * Creates a new {@link EventBus} to enable publish/subscribe behavior.
 *
 * @function eventBus
 * @param {*} [context=undefined] An optional `this` context to use when invoking subscribers.
 * @param {function} [mode=parallel] Optional factory to create an execution processor. The
 * default is {@link module:index~parallel parallel}, but you could also pass {@link module:index~sequence sequence}
 * or your own factory method. See the examples.
 * @returns {EventBus} An EventBus that provides publish/subscribe functionality.
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
 * @example
 * // custom handler context
 *
 * import { eventBus } from '@paychex/core';
 *
 * const context = {
 *   key: 'value'
 * };
 *
 * const bus = eventBus(context); // subscriber context
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
 * const bus = eventBus(null, sequence);
 *
 * bus.on('event', handler1); // runs first
 * bus.on('event', handler2); // runs after
 *
 * export async function trigger(...args) {
 *   await bus.fire('event', ...args);
 * }
 */
export function eventBus(context, mode = parallel) {

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

/**
 * @async
 * @global
 * @callback ParallelFunction
 * @property {Function} add Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original ParallelFunction for chaining.
 * @property {Function} remove Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original ParallelFunction for chaining.
 * @property {Function} insert Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original ParallelFunction for chaining.
 * @property {Function} clone Creates and returns a new copy of the ParallelFunction. Methods can be added or removed
 * from this function without modifying the original.
 * @param {...any} args The arguments to pass to the original functions.
 * @returns {Promise} A Promise resolved with the array of settled return
 * values or else rejecting with the first rejection reason or thrown error.
 * @example
 * const isValidUserName = parallel(isNonEmpty, allCharactersValid);
 *
 * // add more functions to the collection:
 * isValidUserName.add(isNotTaken, passesProfanityFilter);
 *
 * export async function validate(username) {
 *   try {
 *     const results = await isValidUserName(username);
 *     return result.every(Boolean);
 *   } catch (e) {
 *     return false;
 *   }
 * }
 */

/**
 * @async
 * @global
 * @callback SequentialFunction
 * @property {Function} add Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original SequentialFunction for chaining.
 * @property {Function} remove Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original SequentialFunction for chaining.
 * @property {Function} insert Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original SequentialFunction for chaining.
 * @property {Function} clone Creates and returns a new copy of the SequentialFunction. Methods can be added or removed
 * from this function without modifying the original.
 * @param {...any} args The arguments to pass to the original functions.
 * @returns {Promise} A Promise resolved with the last function's settled
 * return value, or rejected if any function rejects or throws an error.
 * The functions will be passed the incoming arguments along with the value
 * returned by the previous function.
 * @example
 * // as a standalone function
 *
 * const process = sequence();
 *
 * async function handler1(...args, lastHandlerResult) {
 *   console.log(args, lastHandlerResult);
 *   await someAsyncMethod(...args);
 *   return 1;
 * }
 *
 * function handler2(...args, lastHandlerResult) {
 *   console.log(args, lastHandlerResult);
 *   return 2;
 * }
 *
 * process.add(handler1);
 * process.add(handler2);
 *
 * await process('abc', 'def'); // 2
 * // output from handler1: ['abc', 'def'], undefined
 * // output from handler2: ['abc', 'def'], 1
 * @example
 * // as a combination event handler
 *
 * function handler1(...args) {
 *   return 'some value';
 * }
 *
 * function handler2(...args, previousValue) {
 *   return previousValue === 'some value';
 * }
 *
 * const bus = eventBus();
 *
 * bus.on('event', sequence(handler1, handler2));
 * await bus.fire('event', 'arg1', 'arg2'); // [true]
 */

function getInvocationPattern(invoker) {
    return function pattern(...functions) {
        let set = new Set(functions);
        function invoke(...args) {
            const methods = Array.from(set);
            return invoker.call(this, methods, args);
        }
        invoke.add = (...fns) => {
            fns.forEach(set.add, set);
            return invoke;
        };
        invoke.remove = (...fns) => {
            fns.forEach(set.delete, set);
            return invoke;
        };
        invoke.insert = (index, ...fns) => {
            const methods = Array.from(set);
            methods.splice(index, 0, ...fns);
            set = new Set(methods);
            return invoke;
        };
        invoke.clone = () => getInvocationPattern(invoker)(...set);
        return invoke;
    };
}

/**
 * Invokes the specified functions in parallel, handling any
 * returned Promises correctly.
 *
 * @async
 * @function parallel
 * @param {...Function} fns The functions to invoke in parallel.
 * @returns {ParallelFunction} A function that will invoke the
 * given functions in parallel, waiting for any returned Promises
 * to settle, and either resolving with the array of settled return
 * values or else rejecting with the first rejection reason or
 * thrown error.
 * @example
 * const concurrent = parallel(fn1, fn2, fn3);
 * const results = await concurrent('abc', 123);
 * results.length; // 3
 * @example
 * // combining parallel() and sequence()
 *
 * const workflow = parallel(
 *   step1,
 *   sequence(step2a, step2b, step2c),
 *   sequence(step3a, step3b),
 *   step4,
 * );
 *
 * workflow.add(sequence(step5a, step5b));
 *
 * await workflow('some args');
 */
export const parallel = getInvocationPattern(function invoker(methods, args) {
    return Promise.all(methods.map(fn =>
        new Promise(resolve =>
            resolve(fn.apply(this, args)))));
});

/**
 * Invokes the specified functions in sequence, handling any
 * returned Promises correctly.
 *
 * @async
 * @function sequence
 * @param {...Function} fns The functions to invoke in sequence.
 * @returns {SequentialFunction} A function that will invoke the
 * given functions in sequence, waiting for any returned Promises
 * to settle, and either resolving with the last settled return
 * value or else rejecting with the first rejection reason or thrown
 * error.
 * @example
 * const bus = eventBus();
 * const checkDirty = parallel();
 *
 * bus.on('navigate', sequence(checkDirty, loadNewRoute));
 *
 * export function addDirtyChecker(fn) {
 *   checkDirty.add(fn);
 *   return function remove() {
 *     checkDirty.remove(fn);
 *   };
 * }
 *
 * export async function navigate(container, path) {
 *   await bus.fire('navigate', container, path);
 * }
 * @example
 * // combining parallel() and sequence()
 *
 * const workflow = parallel(
 *   step1,
 *   sequence(step2a, step2b, step2c),
 *   sequence(step3a, step3b),
 *   step4,
 * );
 *
 * workflow.add(sequence(step5a, step5b));
 *
 * await workflow('some args');
 */
export const sequence = getInvocationPattern(function invoker(methods, args){
    return methods.reduce((promise, fn) =>
        promise.then((result) => fn.call(this, ...args, result)),
            Promise.resolve());
});

/**
 * Function returned by {@link module:index~buffer buffer}.
 *
 * @async
 * @global
 * @callback BufferFunction
 * @param {...any} args The arguments to pass to the wrapped function.
 * @returns {Promise} A promise resolved when all the queued invocations
 * are complete, or rejected if any queued invocation throws an error or
 * returns a rejected Promise.
 */

/**
 * Filters the queued invocations when a {@link module:index~buffer buffer}'s
 * signals are ready.
 *
 * @global
 * @callback BufferFilter
 * @param {InvocationData[]} invocations The queued invocations.
 * @returns {InvocationData[]} A subset of queued invocations to invoke.
 * Filters can modify the invocation contexts and arguments.
 */

/**
 * Queues invocations of a function until the specified signals are ready.
 * Optionally, allows filtering the queued invocations or modifying their
 * arguments or `this` contexts.
 *
 * @function buffer
 * @param {Function} fn The function whose invocations should be buffered.
 * @param {Array.<AutoResetSignal|ManualResetSignal|CountdownSignal|Semaphore>} signals The signals to wait on before ending buffering.
 * @param {BufferFilter} [filter=identity] Provides optional manipulation of the
 * buffered invocations. Passed an array of invocations and should return an
 * array of invocations. See the example for details.
 * @returns {BufferFunction} A function that will queue invocations while any of
 * the given signals are in a blocked state.
 * @example
 * // pause or resume tracking without losing events
 *
 * const { parallel, buffer } = require('@paychex/core');
 * const createTracker = require('@paychex/core/tracker');
 * const { manualReset } = require('@paychex/core/signals');
 *
 * const ready = manualReset(false);
 * const collectors = parallel();
 * const buffered = buffer(collectors, [ready]);
 *
 * export const tracker = createTracker(buffered);
 *
 * export function add(collector) {
 *   collectors.add(collector);
 * };
 *
 * export function pause() {
 *   ready.reset();
 * }
 *
 * export function start() {
 *   ready.set();
 * }
 * @example
 * // only run most recent invocation of a function
 * // if invoked multiple times while queued
 *
 * const signal = manualReset(true);
 *
 * function onlyMostRecent(invocations) {
 *   return invocations.slice(-1);
 * }
 *
 * async function loadData(arg) {
 *   try {
 *     await signal.ready();
 *     // make data call here
 *   } finally {
 *     signal.set();
 *   }
 * }
 *
 * export const load = buffer(loadData, [signal], onlyMostRecent);
 *
 * // consumer:
 * load(...); // runs, queues future calls until finished
 * load(...); // will be queued, then dropped in favor of most recent call
 * load(...); // will be queued, then run after first load completes
 */
export function buffer(fn, signals, filter = identity) {
    const queue = [];
    const ready = (signal) => signal.ready();
    const invoke = ([ctx, args]) =>
        new Promise((resolve) =>
            resolve(fn.apply(ctx, args)));
    return async function buffered(...args) {
        queue.push([this, args]);
        await Promise.all(signals.map(ready));
        await Promise.all(filter(queue.splice(0)).map(invoke));
    };
}

/**
 * Conditionally invokes the supplied function if the given predicate returns `true`.
 *
 * @function invokeIf
 * @param {Function} fn The function to invoke conditionally.
 * @param {Function} predicate A predicate function that returns `true` or `false`
 * depending on whether the passed function should be invoked. Will be called with
 * the original set of arguments and context.
 * @returns {Function} A function that will invoke `fn` only if `predicate` returns `true`.
 * @example
 * const collectors = parallel();
 *
 * collectors.add(console.log);
 * collectors.add(gaCollector(window.ga));
 *
 * function isEvent(item) {
 *   return item.type === 'event';
 * }
 *
 * const tracker = createTracker(invokeIf(collectors, isEvent));
 *
 * // we could also use lodash iteratee syntax:
 * const tracker = createTracker(invokeIf(collectors, { type: 'event' }));
 * const tracker = createTracker(invokeIf(collectors, ['type', 'event']));
 */
export function invokeIf(fn, predicate) {
    const pred = iteratee(predicate);
    return function conditional(...args) {
        if (pred.apply(this, args)) {
            return fn.apply(this, args);
        }
    };
}