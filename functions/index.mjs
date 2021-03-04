import { iteratee, identity } from 'lodash-es';

/**
 * ```js
 * // esm
 * import { functions } from '@paychex/core';
 *
 * // cjs
 * const { functions } = require('@paychex/core');
 *
 * // iife
 * const { functions } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ functions }) { ... });
 * define(['@paychex/core'], function({ functions }) { ... });
 * ```
 *
 * Contains utilities to wrap one or more functions.
 *
 * @module functions
 */

/**
* @ignore
* @param {function():T} invoker
* @returns {T}
* @template T
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
 * @ignore
 * @param {function[]} methods The methods to invoke.
 * @param {Array.<*>} args The args to provide.
 * @returns {Parallel}
 */
function inParallel(methods, args) {
    return Promise.all(methods.map(fn =>
        new Promise(resolve =>
            resolve(fn.apply(this, args)))));
}

/**
 * @ignore
 * @param {function[]} methods The methods to invoke.
 * @param {Array.<*>} args The args to provide.
 * @returns {Sequence}
 */
function inSequence(methods, args) {
    return methods.reduce((promise, fn) =>
        promise.then((result) => fn.call(this, ...args, result)),
        Promise.resolve());
}

/**
 * Invokes the specified functions in parallel, handling any
 * returned Promises correctly.
 *
 * @static
 * @function parallel
 * @param {...Function} fns The functions to invoke in parallel.
 * @returns {ParallelFunction} A function that will invoke the
 * given functions in parallel, waiting for any returned Promises
 * to settle, and either resolving with the array of settled return
 * values or else rejecting with the first rejection reason or
 * thrown error.
 * @example
 * const concurrent = functions.parallel(fn1, fn2, fn3);
 * const results = await concurrent('abc', 123);
 * results.length; // 3
 * @example
 * // combining parallel() and sequence()
 *
 * const workflow = functions.parallel(
 *   step1,
 *   functions.sequence(step2a, step2b, step2c),
 *   functions.sequence(step3a, step3b),
 *   step4,
 * );
 *
 * workflow.add(functions.sequence(step5a, step5b));
 *
 * await workflow('some args');
 */
function Parallel(...fns) { }

export const parallel = getInvocationPattern(inParallel);

/**
 * Invokes the specified functions in sequence, handling any
 * returned Promises correctly.
 *
 * @static
 * @function sequence
 * @param {...Function} fns The functions to invoke in sequence.
 * @returns {SequentialFunction} A function that will invoke the
 * given functions in sequence, waiting for any returned Promises
 * to settle, and either resolving with the last settled return
 * value or else rejecting with the first rejection reason or thrown
 * error.
 * @example
 * const bus = events.bus();
 * const checkDirty = functions.parallel();
 *
 * bus.on('navigate', functions.sequence(checkDirty, loadNewRoute));
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
 * const workflow = functions.parallel(
 *   step1,
 *   functions.sequence(step2a, step2b, step2c),
 *   functions.sequence(step3a, step3b),
 *   step4,
 * );
 *
 * workflow.add(functions.sequence(step5a, step5b));
 *
 * await workflow('some args');
 */
function Sequence(...fns) { }

export const sequence = getInvocationPattern(inSequence);

/**
 * Queues invocations of a function until the specified signals are ready.
 * Optionally, allows filtering the queued invocations or modifying their
 * arguments or `this` contexts.
 *
 * @function
 * @param {Function} fn The function whose invocations should be buffered.
 * @param {Array.<Signal>} signals The signals to wait on before ending buffering.
 * @param {BufferFilter} [filter=identity] Provides optional manipulation of the
 * buffered invocations. Passed an array of invocations and should return an
 * array of invocations. See the example for details.
 * @returns {BufferFunction} A function that will queue invocations while any of
 * the given signals are in a blocked state.
 * @example
 * // pause or resume tracking without losing events
 *
 * const ready = signals.manualReset(false);
 * const collectors = functions.parallel();
 * const buffered = functions.buffer(collectors, [ready]);
 *
 * export const tracker = trackers.create(buffered);
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
 * const signal = signals.manualReset(true);
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
 * export const load = functions.buffer(loadData, [signal], onlyMostRecent);
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
 * @function
 * @template T
 * @param {function(...any):T} fn The function to invoke conditionally.
 * @param {function(...any):boolean} predicate A predicate function that returns `true` or `false`
 * depending on whether the passed function should be invoked. Will be called with
 * the original set of arguments and context.
 * @returns {function(...any):T?} A function that will invoke `fn` only if `predicate` returns `true`.
 * @example
 * const collectors = functions.parallel();
 *
 * collectors.add(console.log);
 * collectors.add(gaCollector(window.ga));
 *
 * function isEvent(item) {
 *   return item.type === 'event';
 * }
 *
 * const tracker = trackers.create(functions.invokeIf(collectors, isEvent));
 *
 * // we could also use lodash iteratee syntax:
 * const tracker = trackers.create(functions.invokeIf(collectors, { type: 'event' }));
 * const tracker = trackers.create(functions.invokeIf(collectors, ['type', 'event']));
 */
export function invokeIf(fn, predicate) {
    const pred = iteratee(predicate);
    return function conditional(...args) {
        if (pred.apply(this, args)) {
            return fn.apply(this, args);
        }
    };
}