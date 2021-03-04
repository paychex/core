/**
 * Represents the abstract base class other Signal classes are derived from. Allows
 * all signals to be waited on.
 *
 * ## Child Classes:
 *
 * - {@link Semaphore}
 * - {@link CountdownSignal}
 * - {@link AutoResetSignal}
 * - {@link ManualResetSignal}
 *
 * @class
 * @global
 * @abstract
 * @hideconstructor
 * @see {Semaphore}
 * @see {CountdownSignal}
 * @see {AutoResetSignal}
 * @see {ManualResetSignal}
 */
export class Signal {

    /**
    * Queues the caller until the signal is placed into a signaled state.
    *
    * @method Signal#ready
    * @returns {Promise} A Promise that will be resolved when the signal is placed
    * into a signaled state.
    * @example
    * const signals = [
    *   signals.manualReset(),
    *   signals.autoReset(),
    *   signals.semaphore(),
    *   signals.countdown(),
    * ];
    *
    * await Promise.all(signals.map(signal => signal.ready()));
    */
    ready() {}

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
 * @class
 * @global
 * @extends Signal
 * @hideconstructor
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
export class ManualResetSignal extends Signal {

    /**
     * Places the signal into a signaled state. This invokes any queued callers
     * in the order they were queued and allows future callers to proceed immediately.
     *
     * @method ManualResetSignal#set
     * @example
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
     */
    set() { }

    /**
     * Places the signal into a blocked (unsignaled) state. This begins queueing
     * any future callers.
     *
     * @method ManualResetSignal#reset
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
    reset() { }

    /**
     * Queues the caller until the signal is placed into a signaled state.
     *
     * @method ManualResetSignal#ready
     * @override
     * @returns {Promise} A Promise that will be resolved when the signal is placed
     * into a signaled state.
     * @example
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
     */
    ready() { }

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
 * @class
 * @global
 * @extends Signal
 * @hideconstructor
 * @example
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
 */
export class AutoResetSignal extends Signal {

    /**
     * Places the signal into a signaled state. This will release only 1 queued caller
     * and then immediately reset the signal.
     *
     * @method AutoResetSignal#set
     * @example
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
     */
    set() { }

    /**
     * Places the signal into a blocked (unsignaled) state. This begins queueing
     * any future callers.
     *
     * **NOTE:** You often won't need to call this method directly since this
     * signal will reset automatically each time it is set.
     *
     * @method AutoResetSignal#reset
     * @example
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
     */
    reset() { }

    /**
     * Queues the caller until the signal is placed into a signaled state.
     *
     * @method AutoResetSignal#ready
     * @override
     * @returns {Promise} A Promise that will be resolved when the signal is placed
     * into a signaled state.
     * @example
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
     */
    ready() { }

}

/**
 * Queues callers until the counter reaches 0.
 *
 * @class
 * @global
 * @extends Signal
 * @hideconstructor
 * @example
 * export function downloadAll(files = []) {
 *   const signal = signals.countdown(files.length);
 *   files.forEach(file =>
 *     download(file).finally(() =>
 *       signal.decrement()));
 *   return signal.ready();
 * }
 * @example
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
 */
export class CountdownSignal extends Signal {

    /**
     * Places the signal into a blocked state. The signal will need to be decremented
     * by a corresponding amount in order to unblock it.
     *
     * @method CountdownSignal#increment
     * @param {number} [count=1] The number to add to the internal counter. Must be a positive integer.
     * @example
     * const signal = signals.countdown();
     *
     * export function appendFilesToDownload(files = []) {
     *   signal.increment(files.length);
     *   files.forEach(file =>
     *     download(file).finally(() =>
     *       signal.decrement()));
     *   return signal.ready();
     * }
     */
    increment(count) { }

    /**
     * Subtracts the specified amount from the counter. When the counter reaches 0 it
     * will be placed into an unblocked state, enabling any queued callers to proceed.
     *
     * @method CountdownSignal#decrement
     * @param {number} [count=1] The number to subtract from the internal counter. Must be a positive integer.
     * @example
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
     */
    decrement(count) { }

    /**
     * Queues the caller until the counter reaches 0. Once the counter reaches 0, all
     * callers will be invoked in the order they were queued.
     *
     * @method CountdownSignal#ready
     * @override
     * @returns {Promise} A Promise that will be resolved when the counter reaches 0.
     * @example
     * export function downloadAll(files = []) {
     *   const signal = signals.countdown(files.length);
     *   files.forEach(file =>
     *     download(file).finally(() =>
     *       signal.decrement()));
     *   return signal.ready();
     * }
     */
    ready() {}

}

/**
 * Limits access to a pool of resources by restricting how many callers can run at a time.
 * Any callers above the allowed amount will be queued until a spot is released.
 *
 * **Best Practices**
 *
 * - Whether your operation succeeds or fails, _always_ call {@link Semaphore#release release()}
 * to ensure the next caller can proceed. Calling `release()` inside a `finally` block makes this easy.
 * See the example below.
 *
 * @class
 * @global
 * @extends Signal
 * @hideconstructor
 * @example
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
 */
export class Semaphore extends Signal {

    /**
     * The number of spots currently available for callers before they will be queued.
     *
     * @member Semaphore#available
     * @type {number}
     * @example
     * const spots = signals.semaphore(10);
     *
     * spots.ready().then(doSomething).finally(spots.release);
     *
     * console.log(spots.queued); // 0
     * console.log(spots.running); // 1
     * console.log(spots.available); // 9
     */
    available = 0

    /**
     * The number of callers currently running. Callers must always remember to call
     * {@link Semaphore#release release()} when done to ensure this number
     * is decremented appropriately.
     *
     * @member Semaphore#running
     * @type {number}
     * @example
     * const spots = signals.semaphore(10);
     *
     * spots.ready().then(doSomething).finally(spots.release);
     *
     * console.log(spots.queued); // 0
     * console.log(spots.running); // 1
     * console.log(spots.available); // 9
     */
    running = 0

    /**
     * The number of callers that are still waiting to run.
     *
     * @member Semaphore#queued
     * @type {number}
     * @example
     * const spots = signals.semaphore(2);
     *
     * spots.ready().then(doSomething).finally(spots.release);
     * spots.ready().then(doSomethingElse).finally(spots.release);
     * spots.ready().then(doAnotherThing).finally(spots.release);
     *
     * console.log(spots.queued); // 1
     * console.log(spots.running); // 2
     * console.log(spots.available); // 0
     */
    queued = 0

    /**
     * Notifies the semaphore that the given number of slots have become available.
     * If any callers have been queued, they will be run in the newly available slots.
     *
     * @method Semaphore#release
     * @param {number} [count=1] The number to spots to make available.
     * @example
     * const spots = signals.semaphore(2);
     *
     * spots.ready()
     *   .then(doSomething)
     *   .finally(spots.release);
     * @example
     * const spots = signals.semaphore();
     *
     * Promise.all([
     *   spots.ready().then(firstOperation),
     *   spots.ready().then(secondOperation)
     * ]).finally(() => spots.release(2));
     * @example
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
     */
    release(count) { }

    /**
     * Queues the caller until a spot is available.
     *
     * @method Semaphore#ready
     * @override
     * @returns {Promise} A Promise that will be resolved when a slot is available.
     * @example
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
     */
    ready() {}

}
