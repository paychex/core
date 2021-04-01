import QS from 'query-string';

import {
    lte,
    has,
    get,
    set,
    noop,
    pick,
    invoke,
    isEqual,
    memoize,
    defaults,
    cloneDeep,
    conforms,
    isFunction,
} from 'lodash-es';

import { error } from '../errors/index.mjs';

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
 * import rules from '~/config/proxy';
 *
 * const proxy = data.createProxy();
 * const { fetch, createRequest } = data.createDataLayer(proxy);
 *
 * proxy.use(...rules);
 *
 * // we extend the functionality of `fetch` by wrapping
 * // it and returning a function with the same signature
 * // that proxies to the real fetch while adding custom
 * // error handling logic
 * function withCustomErrors(fetch) {
 *   return async function useCustomErrors(request) {
 *     return await fetch(request)
 *       .catch(errors.rethrow({ app: 'my app' }));
 *   };
 * }
 *
 * let pipeline = fetch;
 * // add custom error handling
 * pipeline = withCustomErrors(pipeline);
 * // add default request headers
 * pipeline = data.utils.withHeaders(pipeline, {
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
 * import { fetch, createRequest } from './datalayer.mjs';
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
 * const load = data.utils.withRetry(fetch, data.utils.falloff());
 *
 * export async function loadData(id) {
 *   const params = { id };
 *   const request = createRequest(datacall, params);
 *   const response = await load(request)
 *     .catch(errors.rethrow(errors.fatal(params)));
 *   return response.data;
 * }
 * ```
 * @module data/utils
 */

const rxToken = /:(\w+)/g;
const rxTrailing = /[&?]+$/;

const isCache = conforms({
    get: isFunction,
    set: isFunction,
});

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
 * input params | result string
 * :-- | :--
 * `{ key: false }` | `key=false`
 * `{ key: null }` | `key`
 * `{ key: undefined }` | (no output)
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
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const getUser = {
 *   base: 'users',
 *   method: 'GET',
 *   path: '/users/:id',
 * };
 *
 * const attempt = data.utils.withRetry(fetch, data.utils.falloff(5, 100));
 *
 * export async function loadUserData(id) {
 *   const params = { id };
 *   const request = createRequest(getUser, params);
 *   const response = await attempt(request)
 *     .catch(errors.rethrow(params));
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
 * @param {Fetch} fetch The operation to wrap.
 * @param {RetryFunction} retry Invoked to determine
 * whether the data operation should be retried.
 * @returns {Fetch} The wrapped fetch method.
 * @see {@link module:data/utils.falloff falloff()}
 * @example
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
 * const attempt = data.utils.withRetry(fetch, retryOnAbort);
 *
 * export async function loadUserData(id) {
 *   const params = { id };
 *   const request = createRequest(getUser, params);
 *   const response = await attempt(request)
 *     .catch(errors.rethrow(params));
 *   return response.data;
 * }
 */
export function withRetry(fetch, retry, retries = new Map()) {

    if (!isFunction(retry))
        throw error('Argument `retry` must be a function.');

    return async function useRetry(request, ...args) {
        let response;
        const count = retries.get(request) || 0;
        try {
            response = await fetch(request, ...args);
            set(response, 'meta.retryCount', count);
            retries.delete(request);
        } catch (e) {
            retries.set(request, count + 1);
            return await Promise.resolve()
                .then(() => retry(request, e.response))
                .then(() => useRetry(request, ...args))
                .catch(() => {
                    if (retries.has(request))
                        set(e, 'response.meta.retryCount', retries.get(request));
                    retries.delete(request);
                    throw e;
                });
        }
        return response;
    };
}

/**
 * Wraps the fetch method to cache successful Responses within a data pipeline.
 *
 * **NOTE:** You can easily create {@link Store}-backed data caches for this method
 * using {@link module:stores/utils.asDataCache asDataCache()}.
 *
 * @function
 * @param {Fetch} fetch The fetch method to wrap.
 * @param {Cache} cache The cache used to store {@link Response Responses}.
 * @returns {Fetch} The wrapped fetch method.
 * @see {@link module:stores/utils.asDataCache asDataCache()} in @paychex/core/stores
 * @throws An invalid cache was provided to withCache.
 * @example
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
 * const store = stores.indexedDB({ store: 'reports' });
 * const attempt = data.utils.withCache(fetch, stores.utils.asDataCache(store));
 *
 * export async function loadReportHistory(id) {
 *   const params = { id };
 *   const request = createRequest(getReportHistory, params);
 *   const response = await attempt(request)
 *     .catch(errors.rethrow(params));
 *   return response.data;
 * }
 */
export function withCache(fetch, cache) {

    if (!isCache(cache))
        throw error('An invalid cache was provided to withCache.');

    return async function useCache(request, ...args) {
        let response = await Promise.resolve()
            .then(() => invoke(cache, 'get', request))
            .catch(noop);
        if (response) {
            set(response, 'meta.cached', true);
        } else {
            response = await fetch(request, ...args);
            await Promise.resolve()
                .then(() => invoke(cache, 'set', request, response))
                .catch(noop);
        }
        return response;
    };

}

/**
 * Wraps the given fetch method to add optional request and response
 * transformations to the data pipeline.
 *
 * @function
 * @param {Fetch} fetch The fetch method to wrap.
 * @param {Transformer} transformer Determines how the {@link Request}
 * and {@link Response} should be transformed before being passed to
 * the next stage in the data pipeline.
 * @returns {Fetch} The wrapped fetch method.
 * @example
 * import pako from 'pako'; // compression
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
 * const attempt = data.utils.withTransform(fetch, compressor);
 *
 * export async function saveUserData(id, user) {
 *   const params = { id };
 *   const request = createRequest(saveUser, params, user);
 *   const response = await attempt(request);
 *   return response.meta.headers['e-tag'];
 * }
 */
export function withTransform(fetch, transformer) {
    return async function useTransform(request, ...args) {
        const clone = cloneDeep(request);
        if (has(transformer, 'request')) {
            clone.body = await invoke(transformer, 'request', clone.body, clone.headers);
        }
        const response = await fetch(clone, ...args);
        const modified = cloneDeep(response);
        if (has(transformer, 'response')) {
            modified.data = await invoke(transformer, 'response', modified.data);
        }
        return modified;
    };
}

/**
 * Wraps the fetch operation to wait for a network connection prior to
 * attempting the data operation.
 *
 * @function
 * @param {Fetch} fetch The fetch method to wrap.
 * @param {Reconnect} reconnect Returns a Promise that resolves
 * when the user's network connection has been re-established.
 * @returns {Fetch} The wrapped fetch method.
 * @throws Argument `reconnect` must be a function.
 * @example
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
 * const attempt = data.utils.withConnectivity(fetch, waitForConnect);
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

    return async function useConnectivity(request, ...args) {
        if (!get(globalThis, 'navigator.onLine', true))
            await reconnect(request);
        return await fetch(request, ...args);
    };

}

/**
 * Invokes the specified method when a call is aborted ({@link Response}
 * status = 0).
 *
 * @function
 * @param {Fetch} fetch The fetch method to wrap.
 * @param {Diagnostics} diagnostics Invoked when a data call is aborted.
 * @returns {Fetch} The wrapped fetch method.
 * @throws Argument `diagnostics` must be a function.
 * @example
 * import { noop } from 'lodash-es';
 * import { fetch, createRequest } from '~/path/to/datalayer';
 * import { tracker } from '~/path/to/tracker';
 * import operations from '~/config/diagnostics.mjson';
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
 *   data.utils.withDiagnostics(fetch, performNetworkTests);
 */
export function withDiagnostics(fetch, diagnostics) {

    if (!isFunction(diagnostics))
        throw error('Argument `diagnostics` must be a function.');

    return async function useDiagnostics(request, ...args) {
        let response;
        try {
            response = await fetch(request, ...args);
        } catch (e) {
            const status = get(e, 'status', get(e, 'response.status', 0));
            if (lte(status, 0))
                Promise.resolve()
                    .then(() => diagnostics(request))
                    .catch(noop);
            throw e;
        }
        return response;
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
 * @param {Fetch} fetch The fetch method to wrap.
 * @param {Reauthenticate} reauthenticate Method to invoke to reauthenticate the user.
 * @returns {Fetch} The wrapped fetch method.
 * @throws Argument `reauthenticate` must be a function.
 * @example
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const getUserToken = {
 *   base: 'auth',
 *   path: '/refreshToken',
 *   withCredentials: true,
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
 * export const pipeline = data.utils.withAuthentication(fetch, reauthenticate);
 */
export function withAuthentication(fetch, reauthenticate) {

    if (!isFunction(reauthenticate))
        throw error('Argument `reauthenticate` must be a function.');

    return async function useAuthentication(request, ...args) {
        let response;
        try {
            response = await fetch(request, ...args);
        } catch (e) {
            if (e.status === 401)
                return await Promise.resolve()
                    .then(() => reauthenticate(request))
                    .then(() => useAuthentication(request, ...args))
                    .catch(() => { throw e });
            throw e;
        }
        return response;
    };

}

/**
 * Applies default {@link Request} headers.
 *
 * @function
 * @param {Fetch} fetch The fetch method to wrap.
 * @param {HeadersMap} headers The headers to apply to the {@link Request} headers
 * collection. Request headers with will override any default headers with the same
 * names specified here.
 * @returns {Fetch} The wrapped fetch method.
 * @example
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * const operation = {
 *   base: 'my-app',
 *   path: '/users/:id'
 * };
 *
 * const attempt = data.utils.withHeaders(fetch, {
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
    return async function useHeaders(request, ...args) {
        const clone = cloneDeep(request);
        defaults(clone.headers, headers);
        return await fetch(clone, ...args);
    };
}

function cookieProvider(name) {
    return get(globalThis, ['document', 'cookie', name]);
}

function getUrlProperties(url) {
    const a = invoke(globalThis, 'document.createElement', 'a');
    invoke(a, 'setAttribute', 'href', url);
    invoke(a, 'setAttribute', 'href', get(a, 'href')); // set twice to force parsing
    return pick(a, ['port', 'hostname', 'protocol']);
}

function rxMatches(rx) {
    return rx.test(String(this));
}

function asRegExp(wildcard) {
    return new RegExp(wildcard.replace('*', '.*'), 'i');
}

function isAllowed(target, origin, hosts) {
    return isEqual(target, origin) || (
        target.port === origin.port &&
        target.protocol === origin.protocol &&
        hosts.some(rxMatches, target.hostname)
    );
}

/**
 * Adds Cross-Site Request Forgery protection to {@link Request Requests} made
 * to the same origin where the app is hosted. For this to work, the server and
 * client agree on a unique token to identify the user and prevent cross-site
 * requests from being sent without the user's knowledge.
 *
 * By default, this method reads the `XSRF-TOKEN` cookie value sent by the server
 * and adds it as the `X-XSRF-TOKEN` request header on any requests sent to the
 * same origin. You can configure the cookie and/or the header name by passing your
 * own values in the `options` argument. You can also specify a whitelist of cross-origin
 * hostnames the header should be sent to (e.g. to subdomains of the host domain).
 * See {@link XSRFOptions} for details.
 *
 * Read more about XSRF and implementation best practices {@link https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.md here}.
 *
 * @function
 * @param {Fetch} fetch The fetch method to wrap.
 * @param {XSRFOptions} [options] Optional overrides for cookie and header names.
 * @returns {Fetch} The wrapped fetch method.
 * @see {@link https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.md OWASP XSRF Cheat Sheet}
 * @example
 * import { fetch } from '~/path/to/datalayer';
 *
 * export const safeFetch = data.utils.withXSRF(fetch);
 * @example
 * import { fetch } from '~/path/to/datalayer';
 *
 * export const safeFetch = data.utils.withXSRF(fetch, {
 *   cookie: 'XSRF-MY-APP',
 *   header: 'X-XSRF-MY-APP',
 *   hosts: ['*.my-app.com']
 * });
 */
export function withXSRF(fetch, options = {}) {
    const {
        hosts = [],
        cookie = 'XSRF-TOKEN',
        header = 'x-xsrf-token',
        provider = cookieProvider
    } = options;
    const whitelist = hosts.map(asRegExp);
    const urlProps = memoize(getUrlProperties);
    const origin = urlProps(get(globalThis, 'location.href'));
    return async function useXSRF(request, ...args) {
        const token = provider(cookie);
        const target = urlProps(request.url);
        if (!token || !isAllowed(target, origin, whitelist)) {
            return await fetch(request, ...args);
        }
        const clone = cloneDeep(request);
        set(clone, `headers.${header}`, token);
        return await fetch(clone);
    };
}

/**
 * Coordinates and synchronizes access to the data pipeline through
 * the specified {@link module:signals~ManualResetSignal ManualResetSignal}
 * or {@link module:signals~AutoResetSignal AutoResetSignal}.
 *
 * @function
 * @param {Fetch} fetch The fetch method to wrap.
 * @param {AutoResetSignal|ManualResetSignal} signal The {@link module:signals~ManualResetSignal ManualResetSignal}
 * or {@link module:signals~AutoResetSignal AutoResetSignal} to use to synchronize data calls.
 * @returns {Fetch} The wrapped fetch method.
 * @example
 * // delay calls until the user is authenticated
 *
 * import fetch from 'path/to/datalayer';
 *
 * const authenticated = signals.manualReset(false);
 * export const pipeline = data.utils.withSignal(fetch, authenticated);
 *
 * export function setAuthenticated() {
 *   authenticated.set();
 * }
 * @example
 * // prevent concurrent data calls from reaching the
 * // server out of order by enforcing a sequence (i.e.
 * // the first call must complete before a second call
 * // is sent)
 *
 * import fetch from 'path/to/datalayer';
 *
 * // start the pipeline in a signaled state; each call will
 * // automatically reset the signal, which will be set again
 * // when the call completes, allowing the next call to proceed
 * export const pipeline = data.utils.withSignal(fetch, signals.autoReset(true));
 */
export function withSignal(fetch, signal) {
    return async function useSignal(request, ...args) {
        let response;
        await signal.ready();
        try {
            response = await fetch(request, ...args);
        } finally {
            signal.set();
        }
        return response;
    };
}
