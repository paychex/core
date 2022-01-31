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

import { attempt, isEmpty } from 'lodash';

/**
 * Creates a signal that queues callers until signaled. While signaled, resolves
 * all callers in the order they were queued.
 *
 * Think of a manual reset signal as a traffic light. While it is red, all cars
 * are queued in the order they arrive. Once the light is signaled green, the cars
 * can proceed in the order they arrived. And as long as the light remains green,
 * any future cars can proceed.
 *
 * @param signaled Whether to start in a signaled state.
 * @returns A signal that resolves all callers while signaled.
 * @example
 * ```js
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
 * ```
 * @example
 * ```js
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
 * ```
 */

/**
 * Represents the abstract base interface other Signal interfacees are derived from. Allows
 * all signals to be waited on.
 *
 * @see {@link Semaphore}
 * @see {@link CountdownSignal}
 * @see {@link AutoResetSignal}
 * @see {@link ManualResetSignal}
 */
export interface Signal {

    /**
    * Queues the caller until the signal is placed into a signaled state.
    *
    * @returns A Promise that will be resolved when the signal is placed
    * into a signaled state.
    * @example
    * ```js
    * const signals = [
    *   signals.manualReset(),
    *   signals.autoReset(),
    *   signals.semaphore(),
    *   signals.countdown(),
    * ];
    *
    * await Promise.all(signals.map(signal => signal.ready()));
    * ```
    */
    ready: () => Promise<void>

}

/**
 * Queues all callers until signaled. Once signaled, all callers proceed in the
 * order they were queued. Future callers will proceed immediately while this
 * object remains in a signaled state.
 *
 * Think of the manual reset signal as a traffic light. While it is red, all cars
 * are queued in the order they arrive. Once the light is signaled green, the cars
 * can proceed in the order they arrived. And as long as the light remains green,
 * any future cars can proceed.
 *
 * @example
 * ```js
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
 * ```
 * @example
 * ```js
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
 * ```
 */
export interface ManualResetSignal extends Signal {

    /**
     * Places the signal into a signaled state. This invokes any queued callers
     * in the order they were queued and allows future callers to proceed immediately.
     *
     *@example
     * ```js
     * import { tracker } from '../path/to/tracker';
     *
     * const signal = signals.manualReset(); // starts blocked
     *
     * export async function bootstrap() {
     *   // do bootstrap stuff here
     *   signal.set(); // unblock the signal
     * }
     *
     * export function onReady(callback) {
     *   signal.ready() // block until signaled
     *     .then(callback)
     *     .catch(errors.rethrow(errors.ignore()))
     *     .catch(tracker.error);
     * }
     * ```
     */
    set(): void

    /**
     * Places the signal into a blocked (unsignaled) state. This begins queueing
     * any future callers.
     *
     * @example
     * ```js
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
     * ```
     */
    reset(): void

    /**
     * Queues the caller until the signal is placed into a signaled state.
     *
     * @returns A Promise that will be resolved when the signal is placed
     * into a signaled state.
     * @example
     * ```js
     * import { tracker } from '../path/to/tracker';
     *
     * const signal = signals.manualReset(); // starts blocked
     *
     * export async function bootstrap() {
     *   // do bootstrap stuff here
     *   signal.set(); // unblock the signal
     * }
     *
     * export function onReady(callback) {
     *   signal.ready() // block until signaled
     *     .then(callback)
     *     .catch(errors.rethrow(errors.ignore()))
     *     .catch(tracker.error);
     * }
     * ```
     */
    ready: () => Promise<void>

}


/**
 * Releases 1 queued caller each time it is signaled.
 *
 * The auto reset signal can be used to create a `critical section` -- i.e. a block
 * of code that can only be executed by 1 caller at a time. Every other caller will
 * be queued in the order they arrive, and the next caller in the queue will only
 * be allowed to enter the critical section when the previous caller leaves the
 * critical section.
 *
 * @example
 * ```js
 * import { fetch, createRequest } from '../path/to/datalayer';
 *
 * const signal = signals.autoReset(true); // start unblocked
 *
 * const operation = {
 *   method: 'POST',
 *   base: 'my-app',
 *   path: '/some/endpoint'
 * };
 *
 * // ensure each network call completes
 * // before the next call is performed:
 * export async function networkCall() {
 *   await signal.ready(); // blocks other callers
 *   try {
 *     const data = { ... }; // payload to POST to the endpoint
 *     const request = createRequest(operation, null, data);
 *     const response = await fetch(request);
 *     return response.data;
 *   } finally {
 *     signal.set(); // unblock the next caller
 *   }
 * }
 * ```
 */
export interface AutoResetSignal extends Signal {

    /**
     * Places the signal into a signaled state. This will release only 1 queued caller
     * and then immediately reset the signal.
     *
     * @example
     * ```js
     * const signal = signals.autoReset(true); // start unblocked
     *
     * export async function doSomething() {
     *   await signal.ready(); // blocks other callers
     *   try {
     *     // critical section here
     *   } finally {
     *     signal.set(); // unblock the signal so the next caller can proceed
     *   }
     * }
     * ```
     */
    set(): void

    /**
     * Places the signal into a blocked (unsignaled) state. This begins queueing
     * any future callers.
     *
     * **NOTE:** You often won't need to call this method directly since this
     * signal will reset automatically each time it is set.
     *
     * @example
     * ```js
     * const signal = signals.autoReset(true); // start unblocked
     *
     * export async function doSomething() {
     *   await signal.ready();
     *   // do stuff here
     *   signal.set();
     * }
     *
     * export function cancel() {
     *   // this perpetually blocks the signal
     *   // unless set() gets called again
     *   signal.reset();
     * }
     * ```
     */
    reset(): void

    /**
     * Queues the caller until the signal is placed into a signaled state.
     *
     * @returns A Promise that will be resolved when the signal is placed
     * into a signaled state.
     * @example
     * ```js
     * const signal = signals.autoReset(true); // start unblocked
     *
     * export async function doSomething() {
     *   await signal.ready(); // blocks other callers
     *   try {
     *     // critical section here
     *   } finally {
     *     signal.set(); // unblock the signal so the next caller can proceed
     *   }
     * }
     * ```
     */
    ready: () => Promise<void>

}

/**
 * Queues callers until the counter reaches 0.
 *
 * @example
 * ```js
 * export function downloadAll(files = []) {
 *   const signal = signals.countdown(files.length);
 *   files.forEach(file =>
 *     download(file).finally(() =>
 *       signal.decrement()));
 *   return signal.ready();
 * }
 * ```
 * @example
 * ```js
 * import { registry } from '../some/component/registry';
 *
 * const signal = signals.countdown();
 *
 * export function loadComponent(component) {
 *   if (component in registry) {
 *     signal.increment();
 *     const script = document.createElement('script');
 *     script.async = true;
 *     script.type = 'text/javascript';
 *     script.src = registry[component];
 *     script.onload = () => signal.decrement(); // countdown
 *     document.body.appendChild(script);
 *   }
 *   return signal.ready();
 * }
 * ```
 */
export interface CountdownSignal extends Signal {

    /**
     * Places the signal into a blocked state. The signal will need to be decremented
     * by a corresponding amount in order to unblock it.
     *
     * @param count The number to add to the internal counter. Must be a positive integer.
     * @example
     * ```js
     * const signal = signals.countdown();
     *
     * export function appendFilesToDownload(files = []) {
     *   signal.increment(files.length);
     *   files.forEach(file =>
     *     download(file).finally(() =>
     *       signal.decrement()));
     *   return signal.ready();
     * }
     * ```
     */
    increment: (count?: number) => void

    /**
     * Subtracts the specified amount from the counter. When the counter reaches 0 it
     * will be placed into an unblocked state, enabling any queued callers to proceed.
     *
     * @param count The number to subtract from the internal counter. Must be a positive integer.
     * @example
     * ```js
     * const signal = signals.countdown(3);
     *
     * async function doTask1() {
     *   // do stuff
     *   signal.decrement();
     * }
     *
     * async function doTask2() {
     *   // do stuff
     *   signal.decrement();
     * }
     *
     * async function doTask3() {
     *   // do stuff
     *   signal.decrement();
     * }
     *
     * doTask1();
     * doTask2();
     * doTask3();
     *
     * export function ready() {
     *   return signal.ready();
     * }
     * ```
     */
    decrement: (count?: number) => void

    /**
     * Queues the caller until the counter reaches 0. Once the counter reaches 0, all
     * callers will be invoked in the order they were queued.
     *
     * @returns A Promise that will be resolved when the counter reaches 0.
     * @example
     * ```js
     * export function downloadAll(files = []) {
     *   const signal = signals.countdown(files.length);
     *   files.forEach(file =>
     *     download(file).finally(() =>
     *       signal.decrement()));
     *   return signal.ready();
     * }
     * ```
     */
    ready: () => Promise<void>

}

/**
 * Limits access to a pool of resources by restricting how many callers can run at a time.
 * Any callers above the allowed amount will be queued until a spot is released.
 *
 * **Best Practices**
 *
 * - Whether your operation succeeds or fails, _always_ call {@link Semaphore.release release()}
 * to ensure the next caller can proceed. Calling `release()` inside a `finally` block makes this easy.
 * See the example below.
 *
 * @example
 * ```js
 * import { fetch, createRequest } from '~/path/to/datalayer';
 * import { tracker } from '~/path/to/tracker';
 *
 * const uploadSpots = signals.semaphore(5);
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
 * ```
 */
export interface Semaphore extends Signal {

    /**
     * The number of spots currently available for callers before they will be queued.
     *
     * @readonly
     * @example
     * ```js
     * const spots = signals.semaphore(10);
     *
     * spots.ready().then(doSomething).finally(spots.release);
     *
     * console.log(spots.queued); // 0
     * console.log(spots.running); // 1
     * console.log(spots.available); // 9
     * ```
     */
    available: number

    /**
     * The number of callers currently running. Callers must always remember to call
     * {@link release release()} when done to ensure this number
     * is decremented appropriately.
     *
     * @readonly
     * @example
     * ```js
     * const spots = signals.semaphore(10);
     *
     * spots.ready().then(doSomething).finally(spots.release);
     *
     * console.log(spots.queued); // 0
     * console.log(spots.running); // 1
     * console.log(spots.available); // 9
     * ```
     */
    running: number

    /**
     * The number of callers that are still waiting to run.
     *
     * @readonly
     * @example
     * ```js
     * const spots = signals.semaphore(2);
     *
     * spots.ready().then(doSomething).finally(spots.release);
     * spots.ready().then(doSomethingElse).finally(spots.release);
     * spots.ready().then(doAnotherThing).finally(spots.release);
     *
     * console.log(spots.queued); // 1
     * console.log(spots.running); // 2
     * console.log(spots.available); // 0
     * ```
     */
    queued: number

    /**
     * Notifies the semaphore that the given number of slots have become available.
     * If any callers have been queued, they will be run in the newly available slots.
     *
     * @param count The number to spots to make available.
     * @example
     * ```js
     * const spots = signals.semaphore(2);
     *
     * spots.ready()
     *   .then(doSomething)
     *   .finally(spots.release);
     * ```
     * @example
     * ```js
     * const spots = signals.semaphore();
     *
     * Promise.all([
     *   spots.ready().then(firstOperation),
     *   spots.ready().then(secondOperation)
     * ]).finally(() => spots.release(2));
     * ```
     * @example
     * ```js
     * const spots = signals.semaphore(10);
     *
     * export async function doSomething() {
     *   await spots.ready();
     *   try {
     *     // code
     *   } finally {
     *     spots.release();
     *   }
     * }
     * ```
     */
    release: (count?: number) => void

    /**
     * Queues the caller until a spot is available.
     *
     * @returns A Promise that will be resolved when a slot is available.
     * @example
     * ```js
     * const spots = signals.semaphore(2);
     *
     * export async function doSomething() {
     *   await spots.ready();
     *   try {
     *     // do stuff
     *   } finally {
     *     spots.release();
     *   }
     * }
     * ```
     */
    ready: () => Promise<void>

}

const readonly = (get: () => any): PropertyDescriptor => ({ get, enumerable: true });

export function manualReset(signaled = false): ManualResetSignal {

    const queue: Function[] = [];
    let active = signaled;

    function enqueueIfNeeded(resolve: (value: void) => void | PromiseLike<void>) {
        if (active) resolve();
        else queue.push(resolve);
    }

    function ready(): Promise<void> {
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
 * @param [signaled=false]
 * @returns A signal that releases 1 caller each time it is signaled.
 * @example
 * ```js
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
 * ```
 */
export function autoReset(signaled = false): AutoResetSignal {

    const queue: Function[] = [];
    let active = signaled;

    function enqueueIfNeeded(resolve: (value: void) => void|PromiseLike<void>) {
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

    function ready(): Promise<void> {
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
 * @param initialCount The initial count of the signal. Must be a non-negative integer.
 * @returns Queues callers until the counter reaches 0.
 * @example
 * ```js
 * export function downloadAll(files = []) {
 *   const signal = signals.countdown(files.length);
 *   files.forEach(file =>
 *     download(file).finally(() =>
 *       signal.decrement()));
 *   return signal.ready();
 * }
 * ```
 * @example
 * ```js
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
 * ```
 */
export function countdown(initialCount = 0): CountdownSignal {

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

    function ready(): Promise<void> {
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
 * @param maxConcurrency The maximum number of parallel callers to allow.
 * @returns Limits access to a pool of resources by restricting how many callers can run at a time.
 * @example
 * ```js
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
 * ```
 */
export function semaphore(maxConcurrency = 5): Semaphore {

    let counter = 0;
    const queue: Function[] = [];

    function enqueueIfNeeded(resolve: (value: void) => void|PromiseLike<void>) {
        if (++counter <= maxConcurrency)
            resolve();
        else
            queue.push(resolve);
    }

    function ready(): Promise<void> {
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
    }) as unknown as Semaphore;

}