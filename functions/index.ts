/**
 * Contains utilities to wrap one or more functions.
 *
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
 * @module functions
 */

import { iteratee, identity } from 'lodash';
import { Signal } from '../signals';

/**
 * Array containing the invocation context (the `this` value) and
 * any parameters passed to the invocation.
 */
export type InvocationData = [any, any[]];

/**
 * Provides functionality common to {@link SequentialFunction}s and {@link ParallelFunction}s.
 *
 * @async
 */
export interface GroupedFunction<T> {

    (...args: any[]): Promise<any>

    /**
     * Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original grouped function for chaining.
     *
     * @param fns One or more functions to add to the underlying collection.
     * @returns The original grouped function instance.
     */
    add(...fns: Function[]): T

    /**
     * Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original grouped function for chaining.
     *
     * @param fns One or more functions to remove from the underlying Set.
     * @returns The original grouped function instance.
     */
    remove(...fns: Function[]): T

    /**
     * Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original grouped function for chaining.
     *
     * @param index The position at which to begin inserting functions.
     * @param fns One or more functions to insert into the underlying Set.
     * @returns The original grouped function instance.
     */
    insert(index: number, ...fns: Function[]): T

    /**
     * Creates and returns a new copy of the grouped function. Methods can be added or removed
     * from this function without modifying the original.
     *
     * @returns A new copy of the original grouped function that can be
     * modified without affecting the original.
     */
    clone(): T

}

/**
 * Invokes the specified functions in parallel, handling any returned Promises correctly.
 *
 * @param args The arguments to pass to the original functions.
 * @returns A Promise resolved with the array of settled return
 * values or else rejecting with the first rejection reason or thrown error.
 * @example
 * ```js
 * const isValidUserName = functions.parallel(isNonEmpty, allCharactersValid);
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
 * ```
 */
export interface ParallelFunction extends GroupedFunction<ParallelFunction> { }

/**
 * @async
 * @param args The arguments to pass to the original functions.
 * @returns A Promise resolved with the last function's settled
 * return value, or rejected if any function rejects or throws an error.
 * The functions will be passed the incoming arguments along with the value
 * returned by the previous function.
 * @example
 * ```js
 * // as a standalone function
 *
 * const process = functions.sequence();
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
 * ```
 * @example
 * ```js
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
 * const bus = events.bus();
 *
 * bus.on('event', functions.sequence(handler1, handler2));
 * await bus.fire('event', 'arg1', 'arg2'); // [true]
 * ```
 */
export interface SequentialFunction extends GroupedFunction<SequentialFunction> { }

/**
 * Function returned by {@link module:index~buffer buffer}.
 *
 * @async
 * @param args The arguments to pass to the wrapped function.
 * @returns A promise resolved when all the queued invocations
 * are complete, or rejected if any queued invocation throws an error or
 * returns a rejected Promise.
 */
export interface BufferFunction { (...args: any[]): Promise<any> }

/**
 * Filters the queued invocations when a {@link module:index~buffer buffer}'s
 * signals are ready.
 *
 * @param invocations The queued invocations.
 * @returns A subset of queued invocations to invoke.
 * Filters can modify the invocation contexts and arguments.
 */
export interface BufferFilter { (invocations: InvocationData[]): InvocationData[] }

/**
 * Represents a callable function.
 *
 * @template T the type of arguments this function expects
 * @template R the return type of this function
 */
export interface Invocable<T, R> {
    (...args: T[]): R
}

/** @ignore */
export interface Factory<T> {
    (...functions: Function[]): GroupedFunction<T>
}

/**
* @ignore
*/
function getInvocationPattern<T>(invoker: Function): Factory<T> {
    return function pattern(...functions: Function[]): GroupedFunction<any> {
        let set = new Set(functions);
        function invoke(...args: any[]) {
            const methods = Array.from(set);
            return invoker.call(this, methods, args);
        }
        invoke.add = (...fns: Function[]) => {
            fns.forEach(set.add, set);
            return invoke;
        };
        invoke.remove = (...fns: Function[]) => {
            fns.forEach(set.delete, set);
            return invoke;
        };
        invoke.insert = (index: number, ...fns: Function[]) => {
            const methods = Array.from(set);
            methods.splice(index, 0, ...fns);
            set = new Set(methods);
            return invoke;
        };
        invoke.clone = () => getInvocationPattern(invoker)(...Array.from(set));
        return invoke;
    };
}

/**
 * @ignore
 */
function inParallel(methods: Function[], args: any[]): Promise<any[]> {
    return Promise.all(methods.map(fn =>
        new Promise(resolve =>
            resolve(fn.apply(this, args)))));
}

/**
 * @ignore
 */
function inSequence(methods: Function[], args: any[]): Promise<any> {
    return methods.reduce((promise, fn) =>
        promise.then((result) => fn.call(this, ...args, result)),
        Promise.resolve());
}

/**
 * Invokes the specified functions in parallel, handling any
 * returned Promises correctly.
 *
 * @param fns The functions to invoke in parallel.
 * @returns A function that will invoke the
 * given functions in parallel, waiting for any returned Promises
 * to settle, and either resolving with the array of settled return
 * values or else rejecting with the first rejection reason or
 * thrown error.
 * @example
 * ```js
 * const concurrent = functions.parallel(fn1, fn2, fn3);
 * const results = await concurrent('abc', 123);
 * results.length; // 3
 * ```
 * @example
 * ```js
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
 * ```
 */
export const parallel: Factory<ParallelFunction> = getInvocationPattern<ParallelFunction>(inParallel);

/**
 * Invokes the specified functions in sequence, handling any
 * returned Promises correctly.
 *
 * @param fns The functions to invoke in sequence.
 * @returns A function that will invoke the
 * given functions in sequence, waiting for any returned Promises
 * to settle, and either resolving with the last settled return
 * value or else rejecting with the first rejection reason or thrown
 * error.
 * @example
 * ```js
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
 * ```
 * @example
 * ```js
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
 * ```
 */
export const sequence: Factory<SequentialFunction> = getInvocationPattern<SequentialFunction>(inSequence);

/**
 * Queues invocations of a function until the specified signals are ready.
 * Optionally, allows filtering the queued invocations or modifying their
 * arguments or `this` contexts.
 *
 * @param fn The function whose invocations should be buffered.
 * @param signals The signals to wait on before ending buffering.
 * @param filter Provides optional manipulation of the
 * buffered invocations. Passed an array of invocations and should return an
 * array of invocations. See the example for details.
 * @returns A function that will queue invocations while any of
 * the given signals are in a blocked state.
 * @example
 * ```js
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
 * ```
 * @example
 * ```js
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
 * ```
 */
export function buffer(fn: Function, signals: Signal[], filter: BufferFilter = identity): BufferFunction {
    const queue: [any, any[]][] = [];
    const ready = (signal: Signal) => signal.ready();
    const invoke = ([ctx, args]: [any, any[]]) =>
        new Promise((resolve) =>
            resolve(fn.apply(ctx, args)));
    return async function buffered(...args: any[]) {
        queue.push([this, args]);
        await Promise.all(signals.map(ready));
        await Promise.all(filter(queue.splice(0)).map(invoke));
    };
}

/**
 * Conditionally invokes the supplied function if the given predicate returns `true`.
 *
 * @template T the type of arguments the wrapped function accepts
 * @template R the return type of the wrapped function
 * @param fn The function to invoke conditionally.
 * @param predicate A lodash iteratee to act as a predicate function. Iteratee will
 * return `true` or `false` depending on whether the passed function should be invoked
 * and will be called with the original set of arguments and context.
 * @returns A function that will invoke `fn` only if `predicate` returns `true`.
 * @example
 * ```js
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
 * ```
 */
export function invokeIf<T, R>(fn: Invocable<T, R>, predicate: symbol | number | string | object | Function): Invocable<T, R | never> {
    const pred = iteratee(predicate);
    return function conditional(...args: any[]) {
        if (pred.apply(this, args)) {
            return fn.apply(this, args);
        }
    };
}
