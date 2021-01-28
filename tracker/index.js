import uuid from 'uuid/v4.js';
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import noop from 'lodash/noop.js';
import invoke from 'lodash/invoke.js';
import isArray from 'lodash/isArray.js';
import isError from 'lodash/isError.js';
import mergeWith from 'lodash/mergeWith.js';
import isFunction from 'lodash/isFunction.js';
import defaultsDeep from 'lodash/defaultsDeep.js';

import {
    Tracker,
    TrackingInfo,
    NestedTimingTracker,
} from '../types/tracker.js';

class UnusedTracker extends Tracker {}
class UnusedTrackingInfo extends TrackingInfo {}
class UnusedNestedTimingTracker extends NestedTimingTracker {}

/**
 * Provides event, error, and performance logging for applications.
 *
 * @module tracker
 * @see {@link Tracker Tracker API}
 * @example
 * import createTracker from '@paychex/core/tracker';
 *
 * export const tracker = createTracker(console.log);
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

function customizer(lhs, rhs) {
    if (isArray(lhs)) {
        return lhs.concat(rhs);
    }
}

function tryMark(label) {
    invoke(globalThis, 'performance.mark', label)
}

function tryMeasure(label, start) {
    invoke(globalThis, 'performance.measure', label, start);
}

/**
 * Invoked each time a {@link Tracker} (or child Tracker) method produces
 * a new {@link TrackingInfo} instance.
 *
 * @global
 * @callback TrackingSubscriber
 * @param {TrackingInfo} info
 * @example
 * import createTracker from '@paychex/core/tracker';
 *
 * const tracker = createTracker((info) => {
 *   console.log(JSON.stringify(info));
 * });
 * @example
 * import createTracker from '@paychex/core/tracker';
 * import { store } from '~/path/to/actions';
 *
 * const tracker = createTracker((info) => {
 *   store.dispatch({
 *     type: `track:${info.type}`,
 *     payload: info
 *   });
 * });
 */

/**
 * Creates a new {@link Tracker} instance. The specified subscriber will
 * be notified when new {@link TrackingInfo} entries are created.
 *
 * @function module:tracker.createTracker
 * @param {TrackingSubscriber} subscriber A method that will invoked
 * each time a {@link TrackingInfo} entry is created.
 * @returns {Tracker} The new Tracker instance.
 * @example
 * import createTracker from '@paychex/core/tracker';
 *
 * const tracker = createTracker((info) => {
 *   console.log(JSON.stringify(info));
 * });
 */
export default function createTracker(subscriber) {

    const context = {};

    function getContext(...args) {
        return mergeWith({}, context, ...args, customizer);
    }

    if (!isFunction(subscriber))
        subscriber = noop;

    return {

        uuid,

        child() {
            return createTracker((info) => {
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

/**
 * Enables nested timings for the given Tracker instance.
 *
 * **IMPORTANT:** Enabling nested timings introduces edge cases and best practices
 * you should understand before using. See the {@link NestedTimingTracker} documentation
 * for more information.
 *
 * @function
 * @param {Tracker} tracker The Tracker to wrap to enable nested timings.
 * @returns {NestedTimingTracker} A Tracker instance that can create nested timings.
 * @example
 * import { tracker } from '~/tracking';
 * import { withNesting } from '@paychex/core/tracker';
 *
 * const child = tracker.child();
 * const logger = withNesting(child);
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
 *
 * // timing tree:
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
 */
export function withNesting(tracker) {

    function startChild(label, children) {

        let count = 0;

        const info = {
            label,
            count: null,
            start: Date.now(),
            stop: null,
            duration: null,
            data: {
                children: []
            },
        };

        const start = lbl => startChild(lbl, info.data.children);

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

        start(label) {
            const tree = { children: [] };
            const done = tracker.start(label);
            const start = lbl => startChild(lbl, tree.children);
            const stop = (data = {}) => done(mergeWith(tree, data, customizer));
            return [stop, start];
        }

    };

}