import { rethrow } from './errors/index.js';

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
 * Provides publish/subscribe functionality.
 *
 * @global
 * @interface EventBus
 * @borrows EventBus#on as EventBus#one
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
 * @global
 * @callback ParallelFunction
 * @property {Function} add Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original ParallelFunction for chaining.
 * @property {Function} remove Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original ParallelFunction for chaining.
 * @property {Function} insert Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original ParallelFunction for chaining.
 * @property {Function} clone Creates a new copy of the ParallelFunction. Methods can be added or removed
 * from this function without modifying the original. Returns the original ParallelFunction for chaining.
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
 * @global
 * @callback SequentialFunction
 * @property {Function} add Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original SequentialFunction for chaining.
 * @property {Function} remove Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original SequentialFunction for chaining.
 * @property {Function} insert Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original SequentialFunction for chaining.
 * @property {Function} clone Creates a new copy of the SequentialFunction. Methods can be added or removed
 * from this function without modifying the original. Returns the original SequentialFunction for chaining.
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
