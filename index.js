import isError from 'lodash/isError';
import attempt from 'lodash/attempt';
import defaults from 'lodash/defaults';

/**
 * Contains utilities that do not fall under any of the other module categories.
 *
 * @module index
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
 * bus.on('error', tracker.error);
 *
 * bus.on('add', function handler(value1, value2) {
 *   console.log(value1 + value2); // 3
 *   throw new Error();
 * });
 *
 * bus.on('add', function handler() {
 *   // even though the first handler threw
 *   // an exception, this handler will still
 *   // be called
 *   console.log([...arguments]); // [1, 2]
 * });
 *
 * bus.fire('add', 1, 2);
 */

/**
 * Stops notifying subscribers of fired events until {@link ResumeMethod resume} is called.
 *
 * @method EventBus#pause
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
 * bus.pause();
 * bus.fire('add', 1, 2); // does not invoke subscriber
 */

/**
 * Resumes notifying subscribers after {@link PauseMethod pause} was called.
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
 * bus.pause();
 * bus.fire('add', 1, 2); // does not invoke subscriber
 * bus.resume();
 * bus.fire('add', 1, 2); // 3
 */

/**
 * Notifies any subscribers registered through {@link SubscribeMethod on}
 * or {@link SubscribeMethod one} that the specified event has occurred. If
 * any subscribers throw an exception then an 'error' event will be fired on
 * the bus, but any other subscribers will continue to be notified of the
 * initial event.
 *
 * @method EventBus#fire
 * @param {string} event The name of the event to fire.
 * @param {...any} [args] Optional arguments to pass to subscribers.
 * @example
 * import { eventBus } from '@paychex/core';
 * import { tracker } from '~/tracking';
 *
 * const bus = eventBus();
 *
 * bus.on('error', tracker.error);
 *
 * bus.on('add', function handler(value1, value2) {
 *   console.log(value1 + value2); // 3
 *   throw new Error();
 * });
 *
 * bus.on('add', function handler() {
 *   // even though the first handler threw
 *   // an exception, this handler will still
 *   // be called
 *   console.log([...arguments]); // [1, 2]
 * });
 *
 * bus.fire('add', 1, 2);
 */

/**
 * Registers a subscriber for the given event. The subscriber will be invoked
 * in the context used to create the {@link EventBus} and passed any arguments
 * provided to the {@link FireMethod fire method}.
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
 * @returns {EventBus} An EventBus that provides publish/subscribe functionality.
 * @example
 * import { eventBus } from '@paychex/core';
 * import { tracker } from '~/tracking';
 *
 * const bus = eventBus();
 *
 * bus.on('error', tracker.error);
 *
 * bus.on('add', function handler(value1, value2) {
 *   console.log(value1 + value2); // 3
 *   throw new Error();
 * });
 *
 * bus.on('add', function handler() {
 *   // even though the first handler threw
 *   // an exception, this handler will still
 *   // be called
 *   console.log([...arguments]); // [1, 2]
 * });
 *
 * bus.fire('add', 1, 2);
 * @example
 * import { eventBus } from '@paychex/core';
 *
 * const object = {
 *   key: 'value'
 * };
 *
 * const bus = eventBus(object); // subscriber context
 *
 * // NOTE: to access `this` in this handler
 * // we MUST use a real function and NOT the
 * // fat arrow syntax: () => {}
 * bus.on('custom-event', function handler() {
 *   console.log(this.key); // 'value'
 * });
 */
export function eventBus(context) {

    let paused = false;
    const subscribers = new Map();

    function proxyErrors(handler) {
        const { args } = this;
        const result = attempt(handler, ...args);
        if (isError(result)) {
            defaults(result, this);
            fire('error', result);
        }
    }

    function on(event, subscriber) {
        const handler = subscriber.bind(context);
        const handlers = subscribers.get(event) || new Set();
        handlers.add(handler);
        subscribers.set(event, handlers);
        return function off() {
            subscribers.get(event).delete(handler);
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

    function pause() {
        paused = true;
    }

    function resume() {
        paused = false;
    }

    function fire(event, ...args) {
        if (paused) return;
        const context = { event, args };
        const handlers = subscribers.get(event);
        handlers && handlers.forEach(proxyErrors, context);
    }

    return {
        on,
        one,
        fire,
        pause,
        resume,
    };

}