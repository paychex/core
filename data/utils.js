import QS from 'query-string';
import lte from 'lodash/lte';
import has from 'lodash/has';
import get from 'lodash/get';
import set from 'lodash/set';
import noop from 'lodash/noop';
import merge from 'lodash/merge';
import invoke from 'lodash/invoke';
import cloneDeep from 'lodash/cloneDeep';
import conformsTo from 'lodash/conformsTo';
import isFunction from 'lodash/isFunction';

import { error } from '../errors';

/**
 * Functionality used to customize a {@link DataLayer DataLayer} pipeline.
 *
 * A DataLayer provides only basic functionality for fetching data. These
 * utility methods help you extend the data pipeline with powerful features.
 * They work by wrapping the DataLayer's {@link DataLayer#fetch fetch()} method
 * to process {@link Request Requests} and {@link Response Responses} based
 * on various conditions you supply.
 *
 * You should use this same approach in your own applications to provide easy
 * cross-cutting functionality for data operations.
 *
 * ```javascript
 * // datalayer.js
 *
 * import { rethrow } from '@paychex/core/errors';
 * import { withHeaders } from '@paychex/core/data/utils';
 * import { createProxy, createDataLayer } from '@paychex/core/data';
 *
 * import rules from '~/config/proxy';
 *
 * const proxy = createProxy();
 * const { fetch, createRequest } = createDataLayer(proxy);
 *
 * proxy.use(...rules);
 *
 * // we extend the functionality of `fetch` by wrapping
 * // it and returning a function with the same signature
 * // that proxies to the real fetch while adding custom
 * // error handling logic
 * async function customErrors(fetch) {
 *   return async function custom(request) {
 *     return await fetch(request)
 *       .catch(rethrow({ app: 'my app' }));
 *   };
 * }
 *
 * let pipeline = fetch;
 * // add custom error handling
 * pipeline = customErrors(pipeline);
 * // add default request headers
 * pipeline = withHeaders(pipeline, {
 *   'x-app-name': 'my-app'
 * });
 *
 * export {
 *   proxy,
 *   createRequest,
 *   fetch: pipeline // return our extended pipeline
 * }
 *```
 *```javascript
 * // consumer.js
 *
 * import { rethrow, fatal } from '@paychex/core/errors';
 * import { withRetry, falloff } from '@paychex/core/data/utils';
 * import { fetch, createRequest } from './datalayer.js';
 *
 * const datacall = {
 *   base: 'endpoint',
 *   path: '/:id/info'
 * };
 *
 * // automatically retry failed requests using
 * // an exponential falloff between attempts;
 * // the version of fetch we bring in has already
 * // been wrapped to add custom error data and
 * // request headers; this shows how we can combine
 * // cross-cutting logic with custom one-off logic
 * const load = withRetry(fetch, falloff());
 *
 * export async function loadData(id) {
 *   const params = { id };
 *   const request = createRequest(datacall, params);
 *   const response = await load(request)
 *     .catch(rethrow(fatal(params)));
 *   return response.data;
 * }
 * ```
 * @module data/utils
 */

const rxToken = /:(\w+)/g;
const rxTrailing = /[&?]+$/;

const CACHE_SCHEMA = {
    get: isFunction,
    set: isFunction,
};

const replacer = params => (token, key) => {
    const value = params[key] || token;
    delete params[key];
    return value;
}

/**
 * Replaces tokens in a string with values from the provided lookup,
 * and then appends any unmatched key-value pairs in the lookup as
 * a querystring.
 *
 * **NOTE:** Nested objects will not be serialized; if you need to
 * pass complex objects to your endpoint, you should be doing it
 * through the request body; alternatively, use JSON.stringify on
 * the object yourself before passing it to serialize.
 *
 * **NOTE:** different falsy values are treated differently when
 * appending to the querystring:
 *
 *  - {key: false} => 'key=false'
 *  - {key: null} => 'key'
 *  - {key: undefined} => ''
 *
 * @function
 * @param {string} [url=''] A URL that may contain tokens in the `:name` format. Any
 * tokens found in this format will be replaced with corresponding named values in
 * the `params` argument.
 * @param {Object} [params={}] Values to use to replace named tokens in the URL. Any
 * unmatched values will be appended to the URL as a properly encoded querystring.
 * @returns {string} A tokenized string with additional URL-encoded values
 * appened to the querystring.
 * @example
 * const url = tokenize('/clients/:id/apps', {id: '0012391'});
 * assert.equals(url, '/clients/0012391/apps');
 * @example
 * const url = tokenize('/my/endpoint', {offset: 1, pagesize: 20});
 * assert.equals(url, '/my/endpoint?offset=1&pagesize=20');
 * @example
 * const url = tokenize('/users/:guid/clients', {
 *   guid: '00123456789123456789',
 *   order: ['displayName', 'branch']
 * });
 * assert.equals(url, '/users/00123456789123456789/clients?order=displayName&order=branch');
 */
export function tokenize(url = '', params = {}) {
    const values = { ...params };
    const out = url.replace(rxToken, replacer(values));
    const qs = QS.stringify(values);
    const sep = out.includes('?') ? '&' : '?';
    return (out + sep + qs).replace(rxTrailing, '');
}

/**
 * Determines whether a failed data operation should be
 * retried. Returning a resolved promise means to retry
 * the data operation. A rejected promise means not to
 * retry the data operation.
 *
 * @global
 * @async
 * @callback RetryFunction
 * @param {Request} request The Request object.
 * @param {Response} response The Response object.
 * @returns {Promise} Resolving the promise means to
 * retry the data operation. Rejecting the promise means
 * not to retry the data operation.
 */

/**
 * Creates a {@link RetryFunction} that will retry a failed
 * request the specified number of times, using the given
 * exponential base as a falloff interval.
 *
 * @function
 * @param {number} [times=3] The number of times to retry the
 * failed data operation before giving up.
 * @param {number} [base=200] The base number of milliseconds
 * to use as the exponential falloff period. On each invocation
 * of the retry function, the falloff period will be increased
 * by a power of 2 and multiplied by this base. For example:
 *  - retry #1: 200ms
 *  - retry #2: 400ms
 *  - retry #3: 800ms
 * @returns {RetryFunction} Invoked to determine
 * whether the data operation should be retried.
 * @see {@link module:data/utils.withRetry withRetry()}
 * @example
 * import { rethrow } from '@paychex/core/errors'
 * import { falloff, withRetry } from '@paychex/core/data/utils'
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const getUser = {
 *   base: 'users',
 *   method: 'GET',
 *   path: '/users/:id',
 * };
 *
 * const attempt = withRetry(fetch, falloff(5, 100));
 *
 * export async function loadUserData(id) {
 *   const params = { id };
 *   const request = createRequest(getUser, params);
 *   const response = await attempt(request).catch(rethrow(params));
 *   return response.data;
 * }
 */
export function falloff(times = 3, base = 200, options = {}) {
    const {
        scheduler = setTimeout,
        retries = new WeakMap()
    } = options;
    return function retry(request/*, response*/) {
        const count = retries.get(request) || 0;
        retries.set(request, count + 1);
        if (count >= times) return Promise.reject();
        return new Promise((resolve) =>
            scheduler(resolve, Math.pow(2, count) * base));
    };
}

/**
 * Wraps {@link DataLayer#fetch fetch} to provide automatic
 * retry functionality when the operation fails. You can provide
 * pre-defined retry logic using {@link module:data/utils.falloff existing}
 * {@link RetryFunction} factories or by passing your own custom
 * RetryFunction to this method.
 *
 * @function
 * @param {DataLayer#fetch} fetch The operation to wrap.
 * @param {RetryFunction} retry Invoked to determine
 * whether the data operation should be retried.
 * @returns {DataLayer#fetch} The wrapped fetch method.
 * @see {@link module:data/utils.falloff falloff()}
 * @example
 * import { rethrow } from '@paychex/core/errors'
 * import { withRetry } from '@paychex/core/data/utils'
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const getUser = {
 *   base: 'users',
 *   method: 'GET',
 *   path: '/users/:id',
 * };
 *
 * function retryOnAbort(request, response) {
 *   // aborted and timed-out calls
 *   // should return status 0
 *   if (response.status === 0)
 *     return Promise.resolve(); // retry
 *   return Promise.reject(); // don't retry
 * }
 *
 * const attempt = withRetry(fetch, retryOnAbort);
 *
 * export async function loadUserData(id) {
 *   const params = { id };
 *   const request = createRequest(getUser, params);
 *   const response = await attempt(request).catch(rethrow(params));
 *   return response.data;
 * }
 */
export function withRetry(fetch, retry, retries = new Map()) {

    if (!isFunction(retry))
        throw error('Argument `retry` must be a function.');

    return async function useRetry(request) {
        const count = retries.get(request) || 0;
        try {
            const response = await fetch(request);
            set(response, 'meta.retryCount', count);
            retries.delete(request);
            return response;
        } catch (e) {
            retries.set(request, count + 1);
            return await Promise.resolve()
                .then(() => retry(request, e.response))
                .then(() => useRetry(request))
                .catch(() => {
                    retries.delete(request);
                    set(e, 'response.meta.retryCount', count + 1);
                    throw e;
                });
        }
    };
}

/**
 * Stores and retrieves Response objects.
 *
 * @global
 * @interface Cache
 * @see {@link module:stores.asDataCache asDataCache()} in @paychex/core/stores
 * @see {@link module:data/utils.withCache withCache()} in @paychex/core/data/utils
 * @example
 * import { indexedDB } from '@paychex/core/stores'
 *
 * const store = indexedDB({store: 'my-objects'});
 * const ignore = () => {};
 *
 * export const cache = {
 *   async get(request) {
 *     return await store.get(request.url).catch(ignore);
 *   },
 *   async set(request, response) {
 *     return await store.set(request.url, response).catch(ignore);
 *   }
 * }
 */

/**
 * Retrieves a Response object from the cache. You should resolve
 * with `undefined` if the cached value is not found, expired, or
 * invalid. Do NOT reject the returned Promise.
 *
 * @async
 * @method Cache#get
 * @param {Request} request Contains information you can use to create
 * a cache key. Typically, the `url` is unique enough to act as a key.
 * See the example code.
 * @returns {Promise<?Response>} Promise resolved with `undefined` if
 * the key could not be found in the cache or is invalid; otherwise,
 * resolved with the {@link Response} object passed to {@link Cache.set}.
 * @example
 * import { indexedDB } from '@paychex/core/stores'
 *
 * const store = indexedDB({store: 'my-objects'});
 * const ignore = () => {};
 *
 * export const cache = {
 *   async get(request) {
 *     return await store.get(request.url).catch(ignore);
 *   },
 *   async set(request, response) {
 *     return await store.set(request.url, response).catch(ignore);
 *   }
 * }
 */

/**
 * Stores a Response object in the cache. Resolve the returned promise
 * when the object has been cached OR if the caching operation fails. Do
 * NOT reject the returned Promise.
 *
 * @async
 * @method Cache#set
 * @param {Request} request Contains information you can use to create
 * a cache key. Typically, the `url` is unique enough to act as a key.
 * See the example code.
 * @param {Response} response The Response to cache. This is the value
 * that should be returned from {@link Cache.get}.
 * @returns {Promise} A promise resolved when the value is cached.
 * @example
 * import { indexedDB } from '@paychex/core/stores'
 *
 * const store = indexedDB({store: 'my-objects'});
 * const ignore = () => {};
 *
 * export const cache = {
 *   async get(request) {
 *     return await store.get(request.url).catch(ignore);
 *   },
 *   async set(request, response) {
 *     return await store.set(request.url, response).catch(ignore);
 *   }
 * }
 */

/**
 * Wraps the fetch method to cache successful Responses within a data pipeline.
 *
 * **NOTE:** You can easily create {@link Store}-backed data caches for this method
 * using {@link module:stores.asDataCache asDataCache()}.
 *
 * @function
 * @param {DataLayer#fetch} fetch The fetch method to wrap.
 * @param {Cache} cache The cache used to store {@link Response Responses}.
 * @returns {DataLayer#fetch} The wrapped fetch method.
 * @see {@link module:stores.asDataCache asDataCache()} in @paychex/core/stores
 * @throws An invalid cache was provided to withCache.
 * @example
 * import { rethrow } from '@paychex/core/errors';
 * import { withCache } from '@paychex/core/data/utils';
 * import { indexedDB, asDataCache } from '@paychex/core/stores';
 * import { createRequest, fetch } from '~/path/to/datalayer';
 *
 * const getReportHistory = {
 *   method: 'GET',
 *   base: 'reports',
 *   path: '/history/:id'
 * };
 *
 * // NOTE: use withEncryption(store, options) if the response
 * // might contain personal or sensitive information that you
 * // wish to keep secret
 * const store = indexedDB({ store: 'reports' });
 * const attempt = withCache(fetch, asDataCache(store));
 *
 * export async function loadReportHistory(id) {
 *   const params = { id };
 *   const request = createRequest(getReportHistory, params);
 *   const response = await attempt(request).catch(rethrow(params));
 *   return response.data;
 * }
 */
export function withCache(fetch, cache) {

    if (!conformsTo(cache, CACHE_SCHEMA))
        throw error('An invalid cache was provided to withCache.');

    return async function useCache(request) {
        let response = await Promise.resolve()
            .then(() => invoke(cache, 'get', request))
            .catch(noop);
        if (response) {
            set(response, 'meta.cached', true);
        } else {
            response = await fetch(request);
            await Promise.resolve()
                .then(() => invoke(cache, 'set', request, response))
                .catch(noop);
        }
        return response;
    };

}

/**
 * Map of strings representing either {@link Request} headers
 * or {@link Response} {@link MetaData meta} headers. The header name is the key
 * and the header data is the value.
 *
 * @global
 * @typedef {Object.<string, string>} HeadersMap
 * @example
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * async function loadData() {
 *   const request = createRequest({
 *     base: 'my-app',
 *     path: '/path/to/data',
 *     headers: {
 *       'content-type': 'application/json'
 *     }
 *   });
 *   const response = await fetch(request);
 *   console.log(response.meta.headers);
 *   return response.data;
 * }
 */

/**
 * Enables developers to modify the data of a request prior to sending. The
 * current body data and headers map will be passed to this method, and the return
 * value will be used as the new request body data. You can also mutate the headers
 * map (e.g. by adding or deleting values) prior to the request being sent.
 *
 * @global
 * @async
 * @callback RequestTransform
 * @param {*} data The payload passed to {@link DataLayer#createRequest}. Whatever
 * you return from this function will be used as the new request payload.
 * @param {HeadersMap} headers A key-value collection of header names
 * to header values. You can modify this object directly (e.g. by adding or
 * deleting values) prior to the request being sent.
 * @returns {*|Promise} The new body to send with the request.
 */

/**
 * Enables developers to modify the data of a response before it is returned
 * to callers.
 *
 * @global
 * @async
 * @callback ResponseTransform
 * @param {*} data The response payload returned from the server. Whatever value
 * you return from this function will replace {@link Response}.data.
 * @returns {*|Promise} The data to return to callers.
 */

/**
 * @global
 * @typedef {object} Transformer
 * @property {RequestTransform} [request] Transforms the {@link Request} body and headers.
 * @property {ResponseTransform} [response] Transforms the {@link Response} data.
 * @example
 * import isString from 'lodash/isString';
 * import { withTransform } from '@paychex/core/data/utils';
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const operation = {
 *   method: 'GET',
 *   base: 'my-app',
 *   path: '/some/data',
 * };
 *
 * const transformer = {
 *   response(data) {
 *     try {
 *       return JSON.parse(data);
 *     } catch (e) {
 *       return data;
 *     }
 *   }
 * };
 *
 * const attempt = withTransform(fetch, transformer);
 *
 * export async function getJSONData() {
 *   const request = createRequest(operation);
 *   const response = await attempt(request);
 *   return response.data;
 * }
 */

/**
 * Wraps the given fetch method to add optional request and response
 * transformations to the data pipeline.
 *
 * @function
 * @param {DataLayer#fetch} fetch The fetch method to wrap.
 * @param {Transformer} transformer Determines how the {@link Request}
 * and {@link Response} should be transformed before being passed to
 * the next stage in the data pipeline.
 * @returns {DataLayer#fetch} The wrapped fetch method.
 * @example
 * import pako from 'pako'; // compression
 * import { withTransform } from '@paychex/core/data/utils';
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const saveUser = {
 *   method: 'POST',
 *   base: 'my-app',
 *   path: '/users/:id',
 *   headers: {
 *     'content-encoding': 'deflate'
 *   }
 * };
 *
 * // NOTE: `request` and `response` are optional;
 * // see the Transformer documentation for details
 * const compressor = {
 *   request(body, headers) {
 *     const json = JSON.stringify(body);
 *     if (headers['content-encoding'] === 'deflate')
 *       return pako.deflate(json);
 *     return json;
 *   }
 * };
 *
 * const attempt = withTransform(fetch, compressor);
 *
 * export async function saveUserData(id, user) {
 *   const params = { id };
 *   const request = createRequest(saveUser, params, user);
 *   const response = await attempt(request);
 *   return response.headers['e-tag'];
 * }
 */
export function withTransform(fetch, transformer) {
    return async function useTransform(request) {
        const clone = cloneDeep(request);
        if (has(transformer, 'request')) {
            clone.body = await invoke(transformer, 'request', clone.body, clone.headers);
        }
        const response = await fetch(clone);
        const modified = cloneDeep(response);
        if (has(transformer, 'response')) {
            modified.data = await invoke(transformer, 'response', modified.data);
        }
        return modified;
    };
}

/**
 * Invoked when a network connection is lost. Should resolve when the
 * network connection is re-established. NOTE: This method may be called
 * multiple times while the connection is down; its logic should handle
 * this scenario (e.g. only showing a dialog to the user once per outage).
 *
 * @async
 * @global
 * @callback Reconnect
 * @returns {Promise} A promise that will be resolved when the user's
 * network connection is restored.
 */

/**
 * Invoked when a 401 error is returned on a {@link Response}. Indicates that
 * the user's authentication token is invalid and should be regenerated.
 * Typically, a reauth function will add a {@link ProxyRule Proxy rule} to ensure
 * the token is applied in the correct format (e.g. as an Authorize header) and on
 * the correct {@link Request Requests} (e.g. Requests with a specific `base`).
 * Another approach is to make a network call that returns an updated Set-Cookie
 * response header so that future requests contain an updated JWT value.
 *
 * @async
 * @global
 * @callback Reauthenticate
 * @returns {Promise} A promise that will be resolved when the user's
 * authentication token has been retrieved and any corresponding Proxy
 * rules have been applied.
 */

/**
 * Invoked when a data call is aborted ({@link Response} status is 0) but the user
 * has a connection to the Internet. NOTE: This method may be called multiple
 * times; its logic should ensure it only runs diagnostics the desired number of
 * times (e.g. once per failed domain). Also, this method is responsible for logging
 * results (or for caching the results if a connection could not be established).
 *
 * @async
 * @global
 * @callback Diagnostics
 * @param {Request} request The request that failed without receiving
 * a response. The user still has a network connection, so we need to
 * determine why the connection may have failed.
 * @returns {Promise} A Promise resolved when the diagnostics suite has
 * completed. NOTE: {@link module:data/utils.withDiagnostics withDiagnostics}
 * will proceed without waiting for this promise to resolve.
 */

/**
 * Wraps the fetch operation to wait for a network connection prior to
 * attempting the data operation.
 *
 * @function
 * @param {DataLayer#fetch} fetch The fetch method to wrap.
 * @param {Reconnect} reconnect Returns a Promise that resolves
 * when the user's network connection has been re-established.
 * @returns {DataLayer#fetch} The wrapped fetch method.
 * @throws Argument `reconnect` must be a function.
 * @example
 * import { withConnectivity } from '@paychex/core/data/utils';
 * import { showDialog, connectToNetwork } from '~/path/to/dialogs';
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const operation = {
 *   base: 'my-app',
 *   path: '/path/to/data'
 * };
 *
 * async function waitForConnect() {
 *   return await showDialog(connectToNetwork, { modal: true });
 * }
 *
 * const attempt = withConnectivity(fetch, waitForConnect);
 *
 * export async function loadData() {
 *   const request = createRequest(operation);
 *   const response = await attempt(request);
 *   return response.data;
 * }
 */
export function withConnectivity(fetch, reconnect) {

    if (!isFunction(reconnect))
        throw error('Argument `reconnect` must be a function.');

    return async function useConnectivity(request) {
        if (!window.navigator.onLine)
            await reconnect(request);
        return await fetch(request);
    };

}

/**
 * Invokes the specified method when a call is aborted ({@link Response}
 * status = 0).
 *
 * @function
 * @param {DataLayer#fetch} fetch The fetch method to wrap.
 * @param {Diagnostics} diagnostics Invoked when a data call is aborted.
 * @returns {DataLayer#fetch} The wrapped fetch method.
 * @throws Argument `diagnostics` must be a function.
 * @example
 * import noop from 'lodash/noop';
 * import { withDiagnostics } from '@paychex/core/data/utils';
 * import { fetch, createRequest } from '~/path/to/datalayer';
 * import { tracker } from '~/path/to/tracker';
 * import operations from '~/config/diagnostics.json';
 *
 * function trackResults(results) {
 *   tracker.event('diagnostics run', { results });
 * }
 *
 * function asResultPromise(request) {
 *   const fromResponse = (response) =>
 *     `${request.url}: ${response.status} (${response.statusText})`;
 *   const fromError = (error) => fromResponse(error.response);
 *   return fetch(request).then(fromResponse, fromError).catch(noop);
 * }
 *
 * function performNetworkTests(request) {
 *   // only perform diagnostics for calls that
 *   // were aborted between the user and our servers
 *   if (!request.url.includes('mydomain.com')) return;
 *   const requests = operations.map(createRequest);
 *   const responses = requests.map(asResultPromise);
 *   Promise.all(responses).then(trackResults);
 * }
 *
 * export const fetchWithDiagnostics =
 *   withDiagnostics(fetch, performNetworkTests);
 */
export function withDiagnostics(fetch, diagnostics) {

    if (!isFunction(diagnostics))
        throw error('Argument `diagnostics` must be a function.');

    return async function useDiagnostics(request) {
        try {
            return await fetch(request);
        } catch (e) {
            const status = get(e, 'status', get(e, 'response.status', 0));
            if (lte(status, 0))
                Promise.resolve()
                    .then(() => diagnostics(request))
                    .catch(noop);
            throw e;
        }
    };

}

/**
 * Wraps a fetch method so a reauthentication method is invoked if
 * a {@link Response} status 401 is returned. The reauthentication
 * method is responsible for ensuring future requests are authenticated.
 *
 * One way to do this is by adding a {@link ProxyRule} to the {@link Proxy}
 * that sets an Authorize header to an updated value on specific {@link Request Requests}.
 * A simpler approach is to rely on a Set-Cookie response header to update the
 * cookies sent with future requests (if {@link DataDefinition withCredentials}
 * is true).
 *
 * @function
 * @param {DataLayer#fetch} fetch The fetch method to wrap.
 * @param {Reauthenticate} reauthenticate Method to invoke to reauthenticate the user.
 * @returns {DataLayer#fetch} The wrapped fetch method.
 * @throws Argument `reauthenticate` must be a function.
 * @example
 * import { withAuthentication } from '@paychex/core/data/utils';
 * import { fetch, proxy, createRequest } from '~/path/to/datalayer';
 *
 * const getUserToken = {
 *   base: 'auth',
 *   path: '/refreshToken'
 * };
 *
 * // a 401 has occurred; get a new JWT token
 * // for the current user
 * async function reauthenticate() {
 *   // a Set-Cookie response header will update
 *   // the JWT that we send on future requests,
 *   // so we don't need to do anything else here
 *   return await fetch(createRequest(getUserToken));
 * }
 *
 * export const pipeline = withAuthentication(fetch, proxy);
 */
export function withAuthentication(fetch, reauthenticate) {

    if (!isFunction(reauthenticate))
        throw error('Argument `reauthenticate` must be a function.');

    return async function useAuthentication(request) {
        try {
            return await fetch(request);
        } catch (e) {
            if (e.status === 401)
                return await Promise.resolve()
                    .then(() => reauthenticate(request))
                    .then(() => useAuthentication(request))
                    .catch(() => { throw e });
            throw e;
        }
    };

}

/**
 * Applies default {@link Request} headers.
 *
 * @function
 * @param {DataLayer#fetch} fetch The fetch method to wrap.
 * @param {HeadersMap} headers The headers to apply to the {@link Request} headers
 * collection. If a header already exists it will *not* be overwritten.
 * @returns {DataLayer#fetch} The wrapped fetch method.
 * @example
 * import { withHeaders } from '@paychex/core/data/utils';
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const operation = {
 *   base: 'my-app',
 *   path: '/users/:id'
 * };
 *
 * const attempt = withHeaders(fetch, {
 *   'x-app-name': 'my-app',
 *   'x-platform': 'android',
 * });
 *
 * export function getUser(id) {
 *   const params = { id };
 *   const request = createRequest(operation, params);
 *   const response = await attempt(request);
 *   return response.data;
 * }
 */
export function withHeaders(fetch, headers = {}) {
    return async function useHeaders(request) {
        const clone = cloneDeep(request);
        merge(clone.headers, headers);
        return await fetch(clone);
    };
}
