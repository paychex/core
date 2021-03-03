import uuid from 'uuid/v4.js';

import {
    get,
    set,
    noop,
    invoke,
    isError,
    mergeWith,
    isFunction,
    defaultsDeep,
} from 'lodash-es';

import { customizer } from './shared.mjs';

export * as utils from './utils.mjs';

/**
 * Provides event, error, and performance logging for applications.
 *
 * ```js
 * // esm
 * import { trackers } from '@paychex/core';
 *
 * // cjs
 * const { trackers } = require('@paychex/core');
 *
 * // iife
 * const { trackers } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ trackers }) { ... });
 * define(['@paychex/core'], function({ trackers }) { ... });
 * ```
 *
 * @module trackers
 * @see {@link Tracker Tracker API}
 * @example
 * export const tracker = trackers.create(console.log);
 *
 * export async function bootstrap(appId) {
 *   const child = tracker.child();
 *   try {
 *     child.context({ app: appId });
 *     const stop = child.start('bootstrap time');
 *     const scripts = await loadScripts();
 *     child.event('app bootstrapped');
 *     stop({
 *       tags: ['perf', 'ct-003'],
 *       scriptCount: scripts.length
 *     });
 *   } catch (e) {
 *     child.error(e);
 *   }
 * }
 */

function tryMark(label) {
    invoke(globalThis, 'performance.mark', label)
}

function tryMeasure(label, start) {
    invoke(globalThis, 'performance.measure', label, start);
}

/**
 * Creates a new {@link Tracker} instance. The specified subscriber will
 * be notified when new {@link TrackingInfo} entries are created.
 *
 * @function
 * @param {TrackingSubscriber} subscriber A method that will invoked
 * each time a {@link TrackingInfo} entry is created.
 * @returns {Tracker} The new Tracker instance.
 * @example
 * const tracker = trackers.create((info) => {
 *   console.log(JSON.stringify(info));
 * });
 */
export function create(subscriber) {

    const context = {};

    function getContext(...args) {
        return mergeWith({}, context, ...args, customizer);
    }

    if (!isFunction(subscriber))
        subscriber = noop;

    return {

        uuid,

        child() {
            return create((info) => {
                defaultsDeep(info.data, context);
                subscriber(info);
            });
        },

        context(data) {
            mergeWith(context, data, customizer);
        },

        event(message, data) {
            const id = uuid();
            const now = Date.now();
            tryMark(message);
            subscriber(Object.freeze({
                id,
                type: 'event',
                label: message,
                start: now,
                stop: now,
                duration: 0,
                count: 1,
                data: getContext(data)
            }));
        },

        error(err) {
            const id = uuid();
            const now = Date.now();
            if (!isError(err))
                return console.warn('A non-Error was passed to tracker.error:', err);
            set(err, 'count', get(err, 'count', 0) + 1);
            subscriber(Object.freeze({
                id,
                type: 'error',
                label: err.message,
                start: now,
                stop: now,
                duration: 0,
                count: get(err, 'count'),
                data: getContext(err, {
                    // non-enumerable properties
                    // we want to track should be
                    // explicitly retrieved here
                    name: err.name,
                    stack: err.stack
                })
            }));
        },

        start(label) {
            let count = 0;
            const id = uuid();
            const start = Date.now();
            tryMark(id);
            return function end(data) {
                const stop = Date.now();
                const duration = stop - start;
                tryMeasure(label, id);
                subscriber(Object.freeze({
                    id,
                    label,
                    start,
                    stop,
                    duration,
                    type: 'timer',
                    count: ++count,
                    data: getContext(data)
                }));
            };
        }

    };

}
