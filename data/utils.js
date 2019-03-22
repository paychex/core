/**
 * Contains utility methods for use with data operations.
 *
 * @module data/utils
 */

/**
 * Determines whether a failed data operation should be
 * retried. Returning a resolved promise means to retry
 * the data operation. A rejected promise means not to
 * retry the data operation.
 *
 * @global
 * @callback RetryFunction
 * @param {Request} request The Request object.
 * @param {Response} response The Response object.
 * @param {Proxy} proxy The current Proxy.
 * @returns {Promise} Resolving the promise means to
 * retry the data operation. Rejecting the promise means
 * not to retry the data operation.
 */

/**
 * Retries a failed request the specified number of times
 * and uses the given exponential base as a falloff interval.
 *
 * @param {number} [times=3] The number of times to retry the
 * failed data operation before giving up.
 * @param {number} [base=200] The base number of milliseconds
 * to use as the exponential falloff period. On each invocation
 * of the retry function, the falloff period will be increased
 * by a power of 2 and multiplied by this base. For example:
 *  - retry #1: 200ms
 *  - retry #2: 400ms
 *  - retry #3: 800ms
 * @returns {RetryFunction} A function to invoke to determine
 * whether the data operation should be retried.
 * @example
 * import { withFalloff } from '@paychex/core/data/utils'
 *
 * const myDataOperation = {
 *   base: 'landing',
 *   path: '/users/:id',
 *   adapter: '@paychex/rest',
 *   retry: withFalloff(3)
 * };
 */
export function withFalloff(times = 3, base = 200, scheduler = setTimeout) {
    const invokes = new WeakMap();
    return function retry(request, response) {
        const count = invokes.get(request) || 0;
        invokes.set(request, count + 1);
        if (count >= times) return Promise.reject();
        return new Promise((resolve) =>
            scheduler(resolve, Math.pow(2, count) * base));
    };
}

/**
 * Wrapper method for a [Cache#set]{@link Cache} method.
 * Only invokes the wrapped getter if the {@link Response}
 * object's status code matches the specified value.
 *
 * @param {number} status The status code the {@link Response}
 * should have before the passed setter method is invoked.
 * @param {function} setter The {@link Cache}#set method to
 * invoke if the Response status matches.
 * @returns {function} A {@link Cache#set} wrapper method.
 * @example
 * import { isResponseStatus } from '@paychex/core/data/utils'
 *
 * export default class MyCache {
 *   set: ifResponseStatus(200, async function set(request, response) {
 *     // do caching logic here
 *   })
 * }
 */
export function ifResponseStatus(status, setter) {
    return async function set(request, response) {
        if (response.status === status)
            return await setter(request, response);
    };
}

/**
 * Wrapper method for a [Cache#get]{@link Cache} method.
 * Only invokes the wrapped getter if the {@link Request}
 * object's status code matches the specified value.
 *
 * @param {string} method The method the {@link Request}
 * should have before the passed getter method is invoked.
 * @param {function} getter The {@link Cache}#get method to
 * invoke if the Request status matches.
 * @returns {function} A {@link Cache#get} wrapper method.
 * @example
 * import { ifRequestMethod } from '@paychex/core/data/utils'
 *
 * export default class MyCache {
 *   get: ifRequestMethod('POST', async function get(request) {
 *     // retrieve from cache here
 *   })
 * }
 */
export function ifRequestMethod(method, getter) {
    return async function get(request) {
        if (request.method === method)
            return await getter(request);
    };
}