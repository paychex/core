/**
 * Provides utility methods for working with Tracker instances or collectors.
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
 * @module trackers/utils
 */

import {
    set,
    isString,
    mapValues,
    transform,
    isObjectLike,
    cloneDeep,
    mergeWith,
} from 'lodash';

import { BaseTrackingInfo, NestedStartResult, NestedTimingTracker, Tracker, TrackingInfo, TrackingSubscriber } from './index';

import { customizer } from './shared';

function newInstanceOf<T=any>(value: T): T {
    return cloneDeep(Object.getPrototypeOf(value));
}

function replace(value: string, rx: RegExp) {
    this.string = this.string.replace(rx, value);
}

/**
 * Wraps a collector so the {@link TrackingInfo} instance's key and value
 * strings will be replaced according to the specified map. Used
 * primarily to convert system codes into human-readable values
 * before passing to a collector.
 *
 * @param collector The collector function to wrap. Will
 * be invoked with a new TrackingInfo instance whose keys and values
 * will be replaced according to the given map.
 * @param map The
 * mapping of values to replace. For example, `/\ben\b/gi -> 'English'`
 * would change all instances of `'en'` to `'English'`. **NOTE:**
 * Be sure to use `\b` to indicate word boundaries, `^` and `$` to indicate
 * the start and end of a string, `/g` to enable multiple replacements
 * within a string, and `/i` to ignore case.
 * @param keysOnly Whether to replace only object keys; if not
 * specified, object keys *and* values will be replaced.
 * @example
 * ```js
 * const map = new Map([
 *   [/^lang$/, 'language'],
 *   [/\ben\b/i, 'English'],
 *   [/\bes\b/i, 'Spanish'],
 * ]);
 *
 * const collector = trackers.utils.withReplacement(console.log, map);
 * export const tracker = trackers.create(collector);
 *
 * tracker.event('lang', { avail: ['es', 'en'], selected: 'en' });
 * ```
 *
 * ```json
 * {
 *   "id": "09850c98-8d0e-4520-a61c-9401c750dec6",
 *   "type": "event",
 *   "label": "language",
 *   "start": 1611671260770,
 *   "stop": 1611671260770,
 *   "duration": 0,
 *   "count": 1,
 *   "data": {
 *     "avail": [ "Spanish", "English" ],
 *     "selected": "English"
 *   }
 * }
 * ```
 */
export function withReplacement(collector: TrackingSubscriber, map: Map<RegExp, string>, keysOnly: boolean = false):  TrackingSubscriber {

    function substitute(value: any) {
        if (!isString(value))
            return value;
        const context = { string: value };
        map.forEach(replace, context);
        return context.string;
    }

    function transformer(out: any, value: any, key: any): any {
        return set(out, substitute(key), convert(value));
    }

    function convert(value: any): any {
        if (isObjectLike(value)) {
            return transform(value, transformer, newInstanceOf(value));
        }
        return keysOnly ? value : substitute(value);
    }

    return function collect(info: TrackingInfo) {
        const args = Array.prototype.slice.call(arguments, 1);
        const clone = mapValues(cloneDeep(info), convert);
        return collector.call(null, clone, ...args);
    };

}

/**
 * Enables nested timings for the given Tracker instance.
 *
 * **IMPORTANT:** Enabling nested timings introduces edge cases and best practices
 * you should understand before using. See the {@link NestedTimingTracker} documentation
 * for more information.
 *
 * @param tracker The Tracker to wrap to enable nested timings.
 * @returns A Tracker instance that can create nested timings.
 * @example
 * ```js
 * import { tracker } from '~/tracking';
 *
 * const child = tracker.child();
 * const logger = trackers.utils.withNesting(child);
 *
 * async function loadSecurity(start, clientId) {
 *     const [stop] = start('load user roles');
 *     await fakeDataCall(clientId); // pretend data call
 *     stop({ role: 'admin' });
 * }
 *
 * async function loadFeatures(start, product) {
 *     const [stop] = start(`load ${product} features`);
 *     await fakeDataCall(product); // pretend data call
 *     stop({ features: [
 *         `${product}-feat-a`,
 *         `${product}-feat-b`
 *     ]});
 * }
 *
 * async function loadProducts(start, clientId) {
 *     const [stop, nest] = start('load products');
 *     await fakeDataCall(clientId); // pretend data call
 *     await Promise.all([
 *         loadFeatures(nest, 'prod-a'),
 *         loadFeatures(nest, 'prod-b')
 *     ]);
 *     stop({ products: ['prod-a', 'prod-b'] });
 * }
 *
 * async function loadClientData(clientId) {
 *     const [stop, nest] = logger.start('load client data');
 *     await loadProducts(nest, clientId);
 *     await loadSecurity(nest, clientId);
 *     stop({ clientId });
 * }
 *
 * await loadClientData('client-123');
 * ```
 *
 * ### timing tree:
 *
 * ```json
 * {
 *   "id": "dfc21f25-42da-439f-8fd4-23ab02b70668",
 *   "label": "load client data",
 *   "start": 1562872496161,
 *   "stop": 1562872496208,
 *   "duration": 47,
 *   "type": "timer",
 *   "count": 1,
 *   "data": {
 *     "children": [
 *       {
 *         "label": "load products",
 *         "count": 1,
 *         "start": 1562872496161,
 *         "stop": 1562872496192,
 *         "duration": 31,
 *         "data": {
 *           "children": [
 *             {
 *               "label": "load prod-a features",
 *               "count": 1,
 *               "start": 1562872496176,
 *               "stop": 1562872496191,
 *               "duration": 15,
 *               "data": {
 *                 "children": [],
 *                 "features": [
 *                   "prod-a-feat-a",
 *                   "prod-a-feat-b"
 *                 ]
 *               }
 *             },
 *             {
 *               "label": "load prod-b features",
 *               "count": 1,
 *               "start": 1562872496176,
 *               "stop": 1562872496192,
 *               "duration": 16,
 *               "data": {
 *                 "children": [],
 *                 "features": [
 *                   "prod-b-feat-a",
 *                   "prod-b-feat-b"
 *                 ]
 *               }
 *             }
 *           ],
 *           "products": [
 *             "prod-a",
 *             "prod-b"
 *           ]
 *         }
 *       },
 *       {
 *         "label": "load user roles",
 *         "count": 1,
 *         "start": 1562872496192,
 *         "stop": 1562872496208,
 *         "duration": 16,
 *         "data": {
 *           "children": [],
 *           "role": "admin"
 *         }
 *       }
 *     ],
 *     "clientId": "client-123"
 *   }
 * }
 * ```
 */
export function withNesting(tracker: Tracker): NestedTimingTracker {

    function startChild(label: string, children: BaseTrackingInfo[]): NestedStartResult {

        let count = 0;

        const info: BaseTrackingInfo = {
            label,
            count: null,
            start: Date.now(),
            stop: null,
            duration: null,
            data: {
                children: []
            },
        };

        const start = (lbl: string) => startChild(lbl, info.data.children);

        function stop(data = {}) {
            const end = Date.now();
            const copy = { ...info, data: {} };
            children.push(mergeWith(
                copy,
                info,
                {
                    data,
                    stop: end,
                    count: ++count,
                    duration: end - info.start,
                },
                customizer
            ));
        }

        return [stop, start];

    }

    return {

        ...tracker,

        start(label: string): NestedStartResult {
            const tree: Record<string, any> = { children: [] };
            const done = tracker.start(label);
            const start = (lbl: string) => startChild(lbl, tree.children);
            const stop = (data = {}) => done(mergeWith(tree, data, customizer));
            return [stop, start];
        }

    };

}
