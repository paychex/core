import { attempt, isEmpty } from 'lodash-es';

const readonly = (get) => ({ get, enumerable: true });

/**
 * Provides utilities for synchronizing blocks of code.
 *
 * ```js
 * // esm
 * import { signals } from '@paychex/core';
 *
 * // cjs
 * const { signals } = require('@paychex/core');
 *
 * // iife
 * const { signals } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ signals }) { ... });
 * define(['@paychex/core'], function({ signals }) { ... });
 * ```
 *
 * There are 4 types of signals provided in this module:
 *
 * **Manual Reset Signal**
 *
 * Think of the manual reset signal as a traffic light. While it is red,
 * all cars are queued in the order they arrive. Once the light is signaled
 * green, the cars can proceed in the order they arrived. And as long as the
 * light remains green, any future cars can proceed.
 *
 * Use cases:
 *
 * - wait for a router to bootstrap before enabling navigation
 * - block all load operations until a save operation completes
 *
 * **Auto Reset Signal**
 *
 * The auto reset signal can be used to create a `critical section` -- i.e. a
 * block of code that can only be executed by 1 caller at a time. Every other
 * caller will be queued in the order they arrive, and the next caller in the
 * queue will only be allowed to enter the critical section when the previous
 * caller leaves the critical section.
 *
 * Use cases:
 *
 * - ensure only 1 dialog is shown to the user at a time
 * - queue router navigations while a navigation is in process
 * - ensure a specific network call completes before being called again
 *
 * **Countdown Signal**
 *
 * A countdown signal allows you to queue callers until a certain number of
 * operations have completed.
 *
 * Use cases:
 *
 * - disable the UI until a group of downloads have finished
 * - wait for a set of child components to load before stopping a timer
 *
 * **Semaphore**
 *
 * Think of a semaphore as a bouncer at a club who ensures that only a certain
 * number of people are allowed in at one time. In other words, semaphores are
 * used to control access to a limited pool of resources.
 *
 * Use cases:
 *
 * - limit file uploads to a maximum of 5 at a time
 * - limit in-progress data calls on a slow network
 *
 * @module signals
 */

/**
 * Creates a signal that queues callers until signaled. While signaled, resolves
 * all callers in the order they were queued.
 *
 * Think of a manual reset signal as a traffic light. While it is red, all cars
 * are queued in the order they arrive. Once the light is signaled green, the cars
 * can proceed in the order they arrived. And as long as the light remains green,
 * any future cars can proceed.
 *
 * @function
 * @param {boolean} [signaled=false] Whether to start in a signaled state.
 * @returns {ManualResetSignal} A signal that resolves all callers while signaled.
 * @example
 * const signal = signals.manualReset();
 *
 * export function bootstrap() {
 *   // do some preliminary stuff
 *   signal.set(); // unblock any callers
 * }
 *
 * export async function doSomething() {
 *   // block callers until signaled:
 *   await signal.ready();
 *   // bootstrap has now been called and
 *   // completed, so we can safely perform
 *   // an operation here
 * }
 * @example
 * // simple pause/resume functionality
 *
 * const signal = signals.manualReset(true); // start unblocked
 *
 * export async function doSomething() {
 *   await signal.ready();
 *   // do stuff here
 * }
 *
 * export function pause() {
 *   signal.reset();
 * }
 *
 * export function resume() {
 *   signal.set();
 * }
 */
export function manualReset(signaled = false) {

    const queue = [];
    let active = signaled;

    function enqueueIfNeeded(resolve) {
        if (active) resolve();
        else queue.push(resolve);
    }

    function ready() {
        return new Promise(enqueueIfNeeded);
    }

    function reset() {
        active = false;
    }

    function set() {
        active = true;
        while (!isEmpty(queue))
            queue.shift()();
    }

    return {
        ready,
        reset,
        set,
    };

}

/**
 * Creates a signal that queues callers until signaled. Releases only 1 queued
 * caller each time it is signaled, then automatically resets into a blocked state.
 *
 * The auto reset signal can be used to create a `critical section` -- i.e. a block
 * of code that can only be executed by 1 caller at a time. Every other caller will
 * be queued in the order they arrive, and the next caller in the queue will only
 * be allowed to enter the critical section when the previous caller leaves the
 * critical section.
 *
 * @function
 * @param {boolean} [signaled=false]
 * @returns {AutoResetSignal} A signal that releases 1 caller each time it is signaled.
 * @example
 * import { fetch, createRequest } from '../path/to/datalayer';
 *
 * const signal = signals.autoReset(true); // start unblocked
 * const operation = {
 *   method: 'POST',
 *   base: 'my-app',
 *   path: '/some/endpoint'
 * };
 *
 * // ensure each network call completes
 * // before the next call is performed:
 * export async function networkCall() {
 *   await signal.ready(); // block other callers
 *   try {
 *     const data = { ... }; // payload to POST to the endpoint
 *     const request = createRequest(operation, null, data);
 *     const response = await fetch(request);
 *     return response.data;
 *   } finally {
 *     signal.set(); // unblock the next caller
 *   }
 * }
 */
export function autoReset(signaled = false) {

    const queue = [];
    let active = signaled;

    function enqueueIfNeeded(resolve) {
        if (active) {
            reset();
            resolve();
        } else {
            queue.push(resolve);
        }
    }

    function reset() {
        active = false;
    }

    function ready() {
        return new Promise(enqueueIfNeeded);
    }

    function set() {
        if (!isEmpty(queue))
            queue.shift()();
        else
            active = true;
    }

    return {
        ready,
        reset,
        set,
    };

}

/**
 * Creates a signal that will queue callers until the counter reaches 0. At that
 * point, all callers will be invoked in the order they were queued.
 *
 * @function
 * @param {number} [initialCount=0] The initial count of the signal. Must be a non-negative integer.
 * @returns {CountdownSignal} Queues callers until the counter reaches 0.
 * @example
 * export function downloadAll(files = []) {
 *   const signal = signals.countdown(files.length);
 *   files.forEach(file =>
 *     download(file).finally(() =>
 *       signal.decrement()));
 *   return signal.ready();
 * }
 * @example
 * // progress blocking
 *
 * const counter = signals.countdown();
 *
 * export function addBlockingTask(task) {
 *   counter.increment();
 *   return Promise.resolve()
 *     .then(task)
 *     .finally(counter.decrement);
 * }
 *
 * export function tasksCompleted() {
 *   return counter.ready();
 * }
 */
export function countdown(initialCount = 0) {

    let counter = Math.max(0, Math.floor(initialCount));
    const inner = manualReset(counter === 0);

    function increment(count = 1) {
        counter += Math.max(1, Math.floor(count));
        inner.reset();
    }

    function decrement(count = 1) {
        const amount = Math.max(1, Math.floor(count));
        counter = Math.max(0, counter - amount);
        if (counter === 0)
            inner.set();
    }

    function ready() {
        return inner.ready();
    }

    return {
        ready,
        increment,
        decrement,
    };

}

/**
 * Limits access to a pool of resources by restricting how many callers can run at a time.
 * Any callers above the allowed amount will be queued until a spot is released.
 *
 * @function
 * @param {number} [maxConcurrency=5] The maximum number of parallel callers to allow.
 * @returns {Semaphore} Limits access to a pool of resources by restricting how many callers can run at a time.
 * @example
 * import { fetch, createRequest } from '~/path/to/datalayer';
 * import { tracker } from '~/path/to/tracker';
 *
 * const uploadSpots = signals.semaphore(5);
 *
 * const operation = {
 *   base: 'files',
 *   method: 'POST',
 *   path: '/save/:id'
 * };
 *
 * export async function uploadFile(blob) {
 *   const data = new FormData();
 *   const params = { id: tracker.uuid() };
 *   data.append('file', blob, params.id);
 *   try {
 *     await uploadSpots.ready();
 *     await fetch(createRequest(operation, params, data));
 *     return params.id;
 *   } finally {
 *     uploadSpots.release(); // always release
 *   }
 * }
 */
export function semaphore(maxConcurrency = 5) {

    let counter = 0;
    const queue = [];

    function enqueueIfNeeded(resolve) {
        if (++counter <= maxConcurrency)
            resolve();
        else
            queue.push(resolve);
    }

    function ready() {
        return new Promise(enqueueIfNeeded);
    }

    function release(count = 1) {
        const min = Math.max(1, Math.floor(count));
        const amount = Math.min(counter - queue.length, min);
        queue.splice(0, amount).forEach(attempt);
        counter -= amount;
    }

    return Object.defineProperties({
        ready,
        release,
    }, {
        queued: readonly(() => queue.length),
        running: readonly(() => counter - queue.length),
        available: readonly(() => Math.max(0, maxConcurrency - counter)),
    });

}