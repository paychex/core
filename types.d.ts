/**
 * <p>Functionality used to customize a {@link DataLayer DataLayer} pipeline.</p>
 * <p>A DataLayer provides only basic functionality for fetching data. These
 * utility methods help you extend the data pipeline with powerful features.
 * They work by wrapping the DataLayer's {@link DataLayer#fetch fetch()} method
 * to process {@link Request Requests} and {@link Response Responses} based
 * on various conditions you supply.</p>
 * <p>You should use this same approach in your own applications to provide easy
 * cross-cutting functionality for data operations.</p>
 * <pre class="prettyprint source lang-javascript"><code>// datalayer.js
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
 * </code></pre>
 * <pre class="prettyprint source lang-javascript"><code>// consumer.js
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
 * </code></pre>
 */
declare module "data/utils" {
    /**
     * <p>Replaces tokens in a string with values from the provided lookup,
     * and then appends any unmatched key-value pairs in the lookup as
     * a querystring.</p>
     * <p><strong>NOTE:</strong> Nested objects will not be serialized; if you need to
     * pass complex objects to your endpoint, you should be doing it
     * through the request body; alternatively, use JSON.stringify on
     * the object yourself before passing it to serialize.</p>
     * <p><strong>NOTE:</strong> different falsy values are treated differently when
     * appending to the querystring:</p>
     * <table>
     * <thead>
     * <tr>
     * <th style="text-align:left">input params</th>
     * <th style="text-align:left">result string</th>
     * </tr>
     * </thead>
     * <tbody>
     * <tr>
     * <td style="text-align:left"><code>{ key: false }</code></td>
     * <td style="text-align:left"><code>key=false</code></td>
     * </tr>
     * <tr>
     * <td style="text-align:left"><code>{ key: null }</code></td>
     * <td style="text-align:left"><code>key</code></td>
     * </tr>
     * <tr>
     * <td style="text-align:left"><code>{ key: undefined }</code></td>
     * <td style="text-align:left">(no output)</td>
     * </tr>
     * </tbody>
     * </table>
     * @example
     * const url = tokenize('/clients/:id/apps', {id: '0012391'});
    assert.equals(url, '/clients/0012391/apps');
     * @example
     * const url = tokenize('/my/endpoint', {offset: 1, pagesize: 20});
    assert.equals(url, '/my/endpoint?offset=1&pagesize=20');
     * @example
     * const url = tokenize('/users/:guid/clients', {
      guid: '00123456789123456789',
      order: ['displayName', 'branch']
    });
    assert.equals(url, '/users/00123456789123456789/clients?order=displayName&order=branch');
     * @param [url = ''] - <p>A URL that may contain tokens in the <code>:name</code> format. Any
     * tokens found in this format will be replaced with corresponding named values in
     * the <code>params</code> argument.</p>
     * @param [params = {}] - <p>Values to use to replace named tokens in the URL. Any
     * unmatched values will be appended to the URL as a properly encoded querystring.</p>
     * @returns <p>A tokenized string with additional URL-encoded values
     * appened to the querystring.</p>
     */
    function tokenize(url?: string, params?: any): string;
    /**
     * <p>Creates a {@link RetryFunction} that will retry a failed
     * request the specified number of times, using the given
     * exponential base as a falloff interval.</p>
     * @example
     * import { fetch, createRequest } from '~/path/to/datalayer';
    
    const getUser = {
      base: 'users',
      method: 'GET',
      path: '/users/:id',
    };
    
    const attempt = data.utils.withRetry(fetch, data.utils.falloff(5, 100));
    
    export async function loadUserData(id) {
      const params = { id };
      const request = createRequest(getUser, params);
      const response = await attempt(request)
        .catch(errors.rethrow(params));
      return response.data;
    }
     * @param [times = 3] - <p>The number of times to retry the
     * failed data operation before giving up.</p>
     * @param [base = 200] - <p>The base number of milliseconds
     * to use as the exponential falloff period. On each invocation
     * of the retry function, the falloff period will be increased
     * by a power of 2 and multiplied by this base. For example:</p>
     * <ul>
     * <li>retry #1: 200ms</li>
     * <li>retry #2: 400ms</li>
     * <li>retry #3: 800ms</li>
     * </ul>
     * @returns <p>Invoked to determine
     * whether the data operation should be retried.</p>
     */
    function falloff(times?: number, base?: number): RetryFunction;
    /**
     * <p>Wraps {@link DataLayer#fetch fetch} to provide automatic
     * retry functionality when the operation fails. You can provide
     * pre-defined retry logic using {@link module:data/utils.falloff existing}
     * {@link RetryFunction} factories or by passing your own custom
     * RetryFunction to this method.</p>
     * @example
     * import { fetch, createRequest } from '~/path/to/datalayer';
    
    const getUser = {
      base: 'users',
      method: 'GET',
      path: '/users/:id',
    };
    
    function retryOnAbort(request, response) {
      // aborted and timed-out calls
      // should return status 0
      if (response.status === 0)
        return Promise.resolve(); // retry
      return Promise.reject(); // don't retry
    }
    
    const attempt = data.utils.withRetry(fetch, retryOnAbort);
    
    export async function loadUserData(id) {
      const params = { id };
      const request = createRequest(getUser, params);
      const response = await attempt(request)
        .catch(errors.rethrow(params));
      return response.data;
    }
     * @param fetch - <p>The operation to wrap.</p>
     * @param retry - <p>Invoked to determine
     * whether the data operation should be retried.</p>
     * @returns <p>The wrapped fetch method.</p>
     */
    function withRetry(fetch: Fetch, retry: RetryFunction): Fetch;
    /**
     * <p>Wraps the fetch method to cache successful Responses within a data pipeline.</p>
     * <p><strong>NOTE:</strong> You can easily create {@link Store}-backed data caches for this method
     * using {@link module:stores/utils.asDataCache asDataCache()}.</p>
     * @example
     * import { createRequest, fetch } from '~/path/to/datalayer';
    
    const getReportHistory = {
      method: 'GET',
      base: 'reports',
      path: '/history/:id'
    };
    
    // NOTE: use withEncryption(store, options) if the response
    // might contain personal or sensitive information that you
    // wish to keep secret
    const store = stores.indexedDB({ store: 'reports' });
    const attempt = data.utils.withCache(fetch, stores.utils.asDataCache(store));
    
    export async function loadReportHistory(id) {
      const params = { id };
      const request = createRequest(getReportHistory, params);
      const response = await attempt(request)
        .catch(errors.rethrow(params));
      return response.data;
    }
     * @param fetch - <p>The fetch method to wrap.</p>
     * @param cache - <p>The cache used to store {@link Response Responses}.</p>
     * @returns <p>The wrapped fetch method.</p>
     */
    function withCache(fetch: Fetch, cache: Cache): Fetch;
    /**
     * <p>Wraps the given fetch method to add optional request and response
     * transformations to the data pipeline.</p>
     * @example
     * import pako from 'pako'; // compression
    import { fetch, createRequest } from '~/path/to/datalayer';
    
    const saveUser = {
      method: 'POST',
      base: 'my-app',
      path: '/users/:id',
      headers: {
        'content-encoding': 'deflate'
      }
    };
    
    // NOTE: `request` and `response` are optional;
    // see the Transformer documentation for details
    const compressor = {
      request(body, headers) {
        const json = JSON.stringify(body);
        if (headers['content-encoding'] === 'deflate')
          return pako.deflate(json);
        return json;
      }
    };
    
    const attempt = data.utils.withTransform(fetch, compressor);
    
    export async function saveUserData(id, user) {
      const params = { id };
      const request = createRequest(saveUser, params, user);
      const response = await attempt(request);
      return response.meta.headers['e-tag'];
    }
     * @param fetch - <p>The fetch method to wrap.</p>
     * @param transformer - <p>Determines how the {@link Request}
     * and {@link Response} should be transformed before being passed to
     * the next stage in the data pipeline.</p>
     * @returns <p>The wrapped fetch method.</p>
     */
    function withTransform(fetch: Fetch, transformer: Transformer): Fetch;
    /**
     * <p>Wraps the fetch operation to wait for a network connection prior to
     * attempting the data operation.</p>
     * @example
     * import { showDialog, connectToNetwork } from '~/path/to/dialogs';
    import { fetch, createRequest } from '~/path/to/datalayer';
    
    const operation = {
      base: 'my-app',
      path: '/path/to/data'
    };
    
    async function waitForConnect() {
      return await showDialog(connectToNetwork, { modal: true });
    }
    
    const attempt = data.utils.withConnectivity(fetch, waitForConnect);
    
    export async function loadData() {
      const request = createRequest(operation);
      const response = await attempt(request);
      return response.data;
    }
     * @param fetch - <p>The fetch method to wrap.</p>
     * @param reconnect - <p>Returns a Promise that resolves
     * when the user's network connection has been re-established.</p>
     * @returns <p>The wrapped fetch method.</p>
     */
    function withConnectivity(fetch: Fetch, reconnect: Reconnect): Fetch;
    /**
     * <p>Invokes the specified method when a call is aborted ({@link Response}
     * status = 0).</p>
     * @example
     * import { noop } from 'lodash-es';
    import { fetch, createRequest } from '~/path/to/datalayer';
    import { tracker } from '~/path/to/tracker';
    import operations from '~/config/diagnostics.mjson';
    
    function trackResults(results) {
      tracker.event('diagnostics run', { results });
    }
    
    function asResultPromise(request) {
      const fromResponse = (response) =>
        `${request.url}: ${response.status} (${response.statusText})`;
      const fromError = (error) => fromResponse(error.response);
      return fetch(request).then(fromResponse, fromError).catch(noop);
    }
    
    function performNetworkTests(request) {
      // only perform diagnostics for calls that
      // were aborted between the user and our servers
      if (!request.url.includes('mydomain.com')) return;
      const requests = operations.map(createRequest);
      const responses = requests.map(asResultPromise);
      Promise.all(responses).then(trackResults);
    }
    
    export const fetchWithDiagnostics =
      data.utils.withDiagnostics(fetch, performNetworkTests);
     * @param fetch - <p>The fetch method to wrap.</p>
     * @param diagnostics - <p>Invoked when a data call is aborted.</p>
     * @returns <p>The wrapped fetch method.</p>
     */
    function withDiagnostics(fetch: Fetch, diagnostics: Diagnostics): Fetch;
    /**
     * <p>Wraps a fetch method so a reauthentication method is invoked if
     * a {@link Response} status 401 is returned. The reauthentication
     * method is responsible for ensuring future requests are authenticated.</p>
     * <p>One way to do this is by adding a {@link ProxyRule} to the {@link Proxy}
     * that sets an Authorize header to an updated value on specific {@link Request Requests}.
     * A simpler approach is to rely on a Set-Cookie response header to update the
     * cookies sent with future requests (if {@link DataDefinition withCredentials}
     * is true).</p>
     * @example
     * import { fetch, createRequest } from '~/path/to/datalayer';
    
    const getUserToken = {
      base: 'auth',
      path: '/refreshToken',
      withCredentials: true,
    };
    
    // a 401 has occurred; get a new JWT token
    // for the current user
    async function reauthenticate() {
      // a Set-Cookie response header will update
      // the JWT that we send on future requests,
      // so we don't need to do anything else here
      return await fetch(createRequest(getUserToken));
    }
    
    export const pipeline = data.utils.withAuthentication(fetch, reauthenticate);
     * @param fetch - <p>The fetch method to wrap.</p>
     * @param reauthenticate - <p>Method to invoke to reauthenticate the user.</p>
     * @returns <p>The wrapped fetch method.</p>
     */
    function withAuthentication(fetch: Fetch, reauthenticate: Reauthenticate): Fetch;
    /**
     * <p>Applies default {@link Request} headers.</p>
     * @example
     * import { fetch, createRequest } from '~/path/to/datalayer';
    
    const operation = {
      base: 'my-app',
      path: '/users/:id'
    };
    
    const attempt = data.utils.withHeaders(fetch, {
      'x-app-name': 'my-app',
      'x-platform': 'android',
    });
    
    export function getUser(id) {
      const params = { id };
      const request = createRequest(operation, params);
      const response = await attempt(request);
      return response.data;
    }
     * @param fetch - <p>The fetch method to wrap.</p>
     * @param headers - <p>The headers to apply to the {@link Request} headers
     * collection. Request headers with will override any default headers with the same
     * names specified here.</p>
     * @returns <p>The wrapped fetch method.</p>
     */
    function withHeaders(fetch: Fetch, headers: HeadersMap): Fetch;
    /**
     * <p>Adds Cross-Site Request Forgery protection to {@link Request Requests} made
     * to the same origin where the app is hosted. For this to work, the server and
     * client agree on a unique token to identify the user and prevent cross-site
     * requests from being sent without the user's knowledge.</p>
     * <p>By default, this method reads the <code>XSRF-TOKEN</code> cookie value sent by the server
     * and adds it as the <code>X-XSRF-TOKEN</code> request header on any requests sent to the
     * same origin. You can configure the cookie and/or the header name by passing your
     * own values in the <code>options</code> argument. You can also specify a whitelist of cross-origin
     * hostnames the header should be sent to (e.g. to subdomains of the host domain).
     * See {@link XSRFOptions} for details.</p>
     * <p>Read more about XSRF and implementation best practices {@link https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.md here}.</p>
     * @example
     * import { fetch } from '~/path/to/datalayer';
    
    export const safeFetch = data.utils.withXSRF(fetch);
     * @example
     * import { fetch } from '~/path/to/datalayer';
    
    export const safeFetch = data.utils.withXSRF(fetch, {
      cookie: 'XSRF-MY-APP',
      header: 'X-XSRF-MY-APP',
      hosts: ['*.my-app.com']
    });
     * @param fetch - <p>The fetch method to wrap.</p>
     * @param [options] - <p>Optional overrides for cookie and header names.</p>
     * @returns <p>The wrapped fetch method.</p>
     */
    function withXSRF(fetch: Fetch, options?: XSRFOptions): Fetch;
    /**
     * <p>Coordinates and synchronizes access to the data pipeline through
     * the specified {@link module:signals~ManualResetSignal ManualResetSignal}
     * or {@link module:signals~AutoResetSignal AutoResetSignal}.</p>
     * @example
     * // delay calls until the user is authenticated
    
    import fetch from 'path/to/datalayer';
    
    const authenticated = signals.manualReset(false);
    export const pipeline = data.utils.withSignal(fetch, authenticated);
    
    export function setAuthenticated() {
      authenticated.set();
    }
     * @example
     * // prevent concurrent data calls from reaching the
    // server out of order by enforcing a sequence (i.e.
    // the first call must complete before a second call
    // is sent)
    
    import fetch from 'path/to/datalayer';
    
    // start the pipeline in a signaled state; each call will
    // automatically reset the signal, which will be set again
    // when the call completes, allowing the next call to proceed
    export const pipeline = data.utils.withSignal(fetch, signals.autoReset(true));
     * @param fetch - <p>The fetch method to wrap.</p>
     * @param signal - <p>The {@link module:signals~ManualResetSignal ManualResetSignal}
     * or {@link module:signals~AutoResetSignal AutoResetSignal} to use to synchronize data calls.</p>
     * @returns <p>The wrapped fetch method.</p>
     */
    function withSignal(fetch: Fetch, signal: AutoResetSignal | ManualResetSignal): Fetch;
}

/**
 * <p>Determines whether a failed data operation should be
 * retried. Returning a resolved promise means to retry
 * the data operation. A rejected promise means not to
 * retry the data operation.</p>
 * @param request - <p>The Request object.</p>
 * @param response - <p>The Response object.</p>
 */
declare type RetryFunction = (request: Request, response: Response) => Promise;

/**
 * <p>Invoked when a network connection is lost. Should resolve when the
 * network connection is re-established. NOTE: This method may be called
 * multiple times while the connection is down; its logic should handle
 * this scenario (e.g. only showing a dialog to the user once per outage).</p>
 */
declare type Reconnect = () => Promise;

/**
 * <p>Invoked when a 401 error is returned on a {@link Response}. Indicates that
 * the user's authentication token is invalid and should be regenerated.
 * Typically, a reauth function will add a {@link ProxyRule Proxy rule} to ensure
 * the token is applied in the correct format (e.g. as an Authorize header) and on
 * the correct {@link Request Requests} (e.g. Requests with a specific <code>base</code>).
 * Another approach is to make a network call that returns an updated Set-Cookie
 * response header so that future requests contain an updated JWT value.</p>
 */
declare type Reauthenticate = () => Promise;

/**
 * <p>Invoked when a data call is aborted ({@link Response} status is 0) but the user
 * has a connection to the Internet. NOTE: This method may be called multiple
 * times; its logic should ensure it only runs diagnostics the desired number of
 * times (e.g. once per failed domain). Also, this method is responsible for logging
 * results (or for caching the results if a connection could not be established).</p>
 * @param request - <p>The request that failed without receiving
 * a response. The user still has a network connection, so we need to
 * determine why the connection may have failed.</p>
 */
declare type Diagnostics = (request: Request) => Promise;

/**
 * <p>Provide utilities for creating application errors with
 * certain severities and optional custom information.</p>
 * <pre class="prettyprint source lang-js"><code>// esm
 * import { errors } from '@paychex/core';
 *
 * // cjs
 * const { errors } = require('@paychex/core');
 *
 * // iife
 * const { errors } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ errors }) { ... });
 * define(['@paychex/core'], function({ errors }) { ... });
 * </code></pre>
 * @example
 * import { tracker } from '../path/to/tracker';
import { fetch, createRequest } from '../path/to/datalayer';

const { rethrow, fatal } = errors;

const operation = {
  base: 'my-app',
  path: '/settings',
  headers: {
    accept: 'application/json'
  }
};

export async function loadAppSettings() {
  const request = createRequest(operation);
  const response = await fetch(request)
    .catch(rethrow(fatal({ app: 'my-app' })));
  return response.data;
}
 */
declare module "errors" {
    /**
     * <p>Indicates an Error that cannot be recovered from.</p>
     * @example
     * export const tracker = trackers.create((info) => {
      if (info.type === 'error') {
        const error = info.data;
        switch (error.severity) {
          case errors.ERROR:
          case errors.FATAL:
            // send to error log
            break;
          case errors.IGNORE:
            console.log(error.message);
            console.log(err.stack);
            break;
        }
      }
    });
     */
    const FATAL: string;
    /**
     * <p>Indicates an error that was unexpected but recoverable.</p>
     * @example
     * export const tracker = trackers.create((info) => {
      if (info.type === 'error') {
        const error = info.data;
        switch (error.severity) {
          case errors.ERROR:
          case errors.FATAL:
            // send to error log
            break;
          case errors.IGNORE:
            console.log(error.message);
            console.log(err.stack);
            break;
        }
      }
    });
     */
    const ERROR: string;
    /**
     * <p>Indicates an error that was expected and recoverable.</p>
     * @example
     * export const tracker = trackers.create((info) => {
      if (info.type === 'error') {
        const error = info.data;
        switch (error.severity) {
          case errors.ERROR:
          case errors.FATAL:
            // send to error log
            break;
          case errors.IGNORE:
            console.log(error.message);
            console.log(err.stack);
            break;
        }
      }
    });
     */
    const IGNORE: string;
    /**
     * <p>Mixes properties into an Error instance to assist with triage and debugging.</p>
     * <p><strong>NOTE:</strong> This method expects 2 arguments (an Error and an object literal)
     * and is curried. That means you can provide the arguments at any time. They
     * can also be provided in any order. These are all the same:</p>
     * <pre class="prettyprint source lang-javascript"><code>rethrow(e, { params });
     * rethrow({ params }, e);
     * rethrow(e)({ params });
     * rethrow({ params })(e);
     * </code></pre>
     * @example
     * somePromiseMethod(params)
      .then(handleResult)
      .catch(errors.rethrow({ params }));
     * @example
     * try {
      someMethod(params);
    } catch (e) {
      errors.rethrow(e, { params });
    }
     * @example
     * import { fetch, createRequest } from '~/path/to/data';
    import { loadClientOperation } from '../data/clients';
    
    const { rethrow, fatal } = errors;
    
    export async function loadClientData(clientId) {
      const params = { clientId };
      const request = createRequest(loadClientOperation, params);
      const response = await fetch(request).catch(rethrow(fatal(params)));
      return response.data;
    }
     * @param error - <p>An Error to decorate and rethrow.</p>
     * @param props - <p>Properties to mix into the Error instance.</p>
     */
    function rethrow(error: Error, props: any): void;
    /**
     * <p>Creates a new Error instance with the optional key-value pairs mixed in.
     * The returned Error will have the default severity of {@link module:errors.ERROR ERROR},
     * which indicates it is unexpected but also recoverable.</p>
     * @example
     * import { isNil } from 'lodash-es';
    
    export function loadClientData(clientId) {
      if (isNil(clientId))
        throw errors.error('Parameter clientId is required.');
      // ...working logic here...
    }
     * @example
     * // change error severity to FATAL
    import { isNil } from 'lodash-es';
    
    export function loadUserPermissions(userId) {
      return new Promise((resolve, reject) => {
        if (isNil(userId))
          reject(errors.error('Parameter userId is required.', errors.fatal()));
        // ...working logic here...
      });
    }
     * @param message - <p>The error message.</p>
     * @param [data = {}] - <p>Optional data to assign to the Error.</p>
     * @returns <p>A new Error instance.</p>
     */
    function error(message: string, data?: any): Error;
    /**
     * <p>Returns an object literal containing the optionally specified key-value
     * pairs along with a severity of {@link module:errors.FATAL FATAL},
     * indicating an Error that cannot be recovered from.</p>
     * @example
     * import { isNil } from 'lodash-es';
    
    export function loadUserPermissions(userId) {
      if (isNil(userId))
        throw errors.error('Parameter userId is required.', errors.fatal());
      // ...working logic here...
    }
     * @example
     * import { fetch, createRequest } from '~/path/to/data';
    import { loadClientOperation } from '../data/clients';
    
    const { rethrow, fatal } = errors;
    
    export async function loadClientData(clientId) {
      const params = { clientId };
      const request = createRequest(loadClientOperation, params);
      const response = await fetch(request).catch(rethrow(fatal(params)));
      return response.data;
    }
     * @param [data = {}] - <p>Optional data to assign.</p>
     * @returns <p>An object map of the optionally provided key-value pairs
     * along with a severity of {@link module:errors.FATAL FATAL}.</p>
     */
    function fatal(data?: any): any;
    /**
     * <p>Returns an object literal containing the optionally specified key-value
     * pairs along with a severity of {@link module:errors.IGNORE IGNORE},
     * indicating an Error that was expected and can be safely ignored.</p>
     * @example
     * import { isNil } from 'lodash-es';
    
    const { error, ignore, rethrow } = errors;
    const cache = stores.memoryStore();
    
    export async function cacheResults(key, data) {
      if (isNil(key))
        throw error('Argument key not provided.', ignore());
      return await cache.set(key, data)
        .catch(rethrow(ignore({ key })));
    }
     * @param [data = {}] - <p>Optional data to assign.</p>
     * @returns <p>An object map of the optionally provided key-value pairs
     * along with a severity of {@link module:errors.IGNORE IGNORE}.</p>
     */
    function ignore(data?: any): any;
}

/**
 * <pre class="prettyprint source lang-js"><code>// esm
 * import { events } from '@paychex/core';
 *
 * // cjs
 * const { events } = require('@paychex/core');
 *
 * // iife
 * const { events } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ events }) { ... });
 * define(['@paychex/core'], function({ events }) { ... });
 * </code></pre>
 * <p>Provides event publish/subscribe functionality.</p>
 */
declare module "events" {
    /**
     * <p>Creates a new {@link EventBus} to enable publish/subscribe behavior.</p>
     * @example
     * import { tracker } from '~/tracking';
    
    const bus = events.bus();
    
    bus.on('event', function handler(arg1, arg2) {
      console.log(`received ${arg1} and ${arg2}`);
      return arg1 + arg2;
    });
    
    // subscribers can be asynchronous
    bus.on('event', async function handler(arg1, arg2) {
      const result = await someAsyncMethod(arg1);
      await someOtherAsyncMethod(result, arg2);
      return 'abc';
    });
    
    // fire and forget
    bus.fire('event', 1, 2);
    
    // catch any rejected promises returned by
    // handlers (or errors thrown by handlers)
    await bus.fire('event', 1, 2).catch(tracker.error);
    
    // examine the return values of handlers
    const results = await bus.fire('event', 1, 2);
    console.log(results); // [3, 'abc']
     * @example
     * // custom handler context
    
    const context = {
      key: 'value'
    };
    
    const bus = events.bus(context); // subscriber context
    
    // NOTE: to access `this` in this handler
    // we MUST use a real function and NOT the
    // fat arrow syntax: () => {}
    bus.on('custom-event', function handler() {
      console.log(this.key); // 'value'
    });
     * @example
     * // sequential mode
    
    const bus = events.bus(null, functions.sequence);
    
    bus.on('event', handler1); // runs first
    bus.on('event', handler2); // runs after
    
    export async function trigger(...args) {
      await bus.fire('event', ...args);
    }
     * @example
     * // combining bus, sequence, and parallel
    
    // allow users to register concurrent event handlers;
    // if any of these handlers throw an exception, the
    // fired event will be rejected
    const interceptors = functions.parallel();
    
    export function addInterceptor(fn) {
      interceptors.add(fn);
      return function remove() {
        interceptors.remove(fn);
      };
    }
    
    // our internal event handler will run after any
    // interceptors have run and be provided the results
    // returned by all the interceptors
    async function internalHandler(...args, results) {
      // results is array of values returned from interceptors
    }
    
    // all interceptors will have access to our context
    // object (e.g. `this.store` inside the subscriber)
    const context = {
      store: stores.memoryStore(),
    };
    
    // execute handlers sequentially
    // instead of in parallel
    const bus = events.bus(context, functions.sequence);
    
    bus.on('event', interceptors);    // run first
    bus.on('event', internalHandler); // run second
    
    // we could also have written:
    // const bus = events.bus(context);
    // bus.on('event', functions.sequence(interceptors, internalHandler));
    
    export async function run(...args) {
      return await bus.fire('event', ...args);
    }
     * @param [context] - <p>An optional <code>this</code> context to use when invoking subscribers.</p>
     * @param [mode = parallel] - <p>Optional factory to create an execution processor. The
     * default is {@link module:functions~parallel parallel}, but you could also pass {@link module:functions~sequence sequence}
     * or your own factory method. See the examples.</p>
     * @returns <p>An EventBus that provides publish/subscribe functionality.</p>
     */
    function bus(context?: any, mode?: Parallel): EventBus;
}

/**
 * <pre class="prettyprint source lang-js"><code>// esm
 * import { functions } from '@paychex/core';
 *
 * // cjs
 * const { functions } = require('@paychex/core');
 *
 * // iife
 * const { functions } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ functions }) { ... });
 * define(['@paychex/core'], function({ functions }) { ... });
 * </code></pre>
 * <p>Contains utilities to wrap one or more functions.</p>
 */
declare module "functions" {
    /**
     * <p>Invokes the specified functions in parallel, handling any
     * returned Promises correctly.</p>
     * @example
     * const concurrent = functions.parallel(fn1, fn2, fn3);
    const results = await concurrent('abc', 123);
    results.length; // 3
     * @example
     * // combining parallel() and sequence()
    
    const workflow = functions.parallel(
      step1,
      functions.sequence(step2a, step2b, step2c),
      functions.sequence(step3a, step3b),
      step4,
    );
    
    workflow.add(functions.sequence(step5a, step5b));
    
    await workflow('some args');
     * @param fns - <p>The functions to invoke in parallel.</p>
     * @returns <p>A function that will invoke the
     * given functions in parallel, waiting for any returned Promises
     * to settle, and either resolving with the array of settled return
     * values or else rejecting with the first rejection reason or
     * thrown error.</p>
     */
    function parallel(...fns: ((...params: any[]) => any)[]): ParallelFunction;
    /**
     * <p>Invokes the specified functions in sequence, handling any
     * returned Promises correctly.</p>
     * @example
     * const bus = events.bus();
    const checkDirty = functions.parallel();
    
    bus.on('navigate', functions.sequence(checkDirty, loadNewRoute));
    
    export function addDirtyChecker(fn) {
      checkDirty.add(fn);
      return function remove() {
        checkDirty.remove(fn);
      };
    }
    
    export async function navigate(container, path) {
      await bus.fire('navigate', container, path);
    }
     * @example
     * // combining parallel() and sequence()
    
    const workflow = functions.parallel(
      step1,
      functions.sequence(step2a, step2b, step2c),
      functions.sequence(step3a, step3b),
      step4,
    );
    
    workflow.add(functions.sequence(step5a, step5b));
    
    await workflow('some args');
     * @param fns - <p>The functions to invoke in sequence.</p>
     * @returns <p>A function that will invoke the
     * given functions in sequence, waiting for any returned Promises
     * to settle, and either resolving with the last settled return
     * value or else rejecting with the first rejection reason or thrown
     * error.</p>
     */
    function sequence(...fns: ((...params: any[]) => any)[]): SequentialFunction;
    /**
     * <p>Queues invocations of a function until the specified signals are ready.
     * Optionally, allows filtering the queued invocations or modifying their
     * arguments or <code>this</code> contexts.</p>
     * @example
     * // pause or resume tracking without losing events
    
    const ready = signals.manualReset(false);
    const collectors = functions.parallel();
    const buffered = functions.buffer(collectors, [ready]);
    
    export const tracker = trackers.create(buffered);
    
    export function add(collector) {
      collectors.add(collector);
    };
    
    export function pause() {
      ready.reset();
    }
    
    export function start() {
      ready.set();
    }
     * @example
     * // only run most recent invocation of a function
    // if invoked multiple times while queued
    
    const signal = signals.manualReset(true);
    
    function onlyMostRecent(invocations) {
      return invocations.slice(-1);
    }
    
    async function loadData(arg) {
      try {
        await signal.ready();
        // make data call here
      } finally {
        signal.set();
      }
    }
    
    export const load = functions.buffer(loadData, [signal], onlyMostRecent);
    
    // consumer:
    load(...); // runs, queues future calls until finished
    load(...); // will be queued, then dropped in favor of most recent call
    load(...); // will be queued, then run after first load completes
     * @param fn - <p>The function whose invocations should be buffered.</p>
     * @param signals - <p>The signals to wait on before ending buffering.</p>
     * @param [filter = identity] - <p>Provides optional manipulation of the
     * buffered invocations. Passed an array of invocations and should return an
     * array of invocations. See the example for details.</p>
     * @returns <p>A function that will queue invocations while any of
     * the given signals are in a blocked state.</p>
     */
    function buffer(fn: (...params: any[]) => any, signals: Signal[], filter?: BufferFilter): BufferFunction;
    /**
     * <p>Conditionally invokes the supplied function if the given predicate returns <code>true</code>.</p>
     * @example
     * const collectors = functions.parallel();
    
    collectors.add(console.log);
    collectors.add(gaCollector(window.ga));
    
    function isEvent(item) {
      return item.type === 'event';
    }
    
    const tracker = trackers.create(functions.invokeIf(collectors, isEvent));
    
    // we could also use lodash iteratee syntax:
    const tracker = trackers.create(functions.invokeIf(collectors, { type: 'event' }));
    const tracker = trackers.create(functions.invokeIf(collectors, ['type', 'event']));
     * @param fn - <p>The function to invoke conditionally.</p>
     * @param predicate - <p>A predicate function that returns <code>true</code> or <code>false</code>
     * depending on whether the passed function should be invoked. Will be called with
     * the original set of arguments and context.</p>
     * @returns <p>A function that will invoke <code>fn</code> only if <code>predicate</code> returns <code>true</code>.</p>
     */
    function invokeIf(fn: (...params: any[]) => any, predicate: (...params: any[]) => any): (...params: any[]) => any;
}

/**
 * @example
 * const isValidUserName = functions.parallel(isNonEmpty, allCharactersValid);

// add more functions to the collection:
isValidUserName.add(isNotTaken, passesProfanityFilter);

export async function validate(username) {
  try {
    const results = await isValidUserName(username);
    return result.every(Boolean);
  } catch (e) {
    return false;
  }
}
 * @property add - <p>Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original ParallelFunction for chaining.</p>
 * @property remove - <p>Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original ParallelFunction for chaining.</p>
 * @property insert - <p>Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original ParallelFunction for chaining.</p>
 * @property clone - <p>Creates and returns a new copy of the ParallelFunction. Methods can be added or removed
 * from this function without modifying the original.</p>
 * @param args - <p>The arguments to pass to the original functions.</p>
 */
declare type ParallelFunction = (...args: any[]) => Promise;

/**
 * @example
 * // as a standalone function

const process = functions.sequence();

async function handler1(...args, lastHandlerResult) {
  console.log(args, lastHandlerResult);
  await someAsyncMethod(...args);
  return 1;
}

function handler2(...args, lastHandlerResult) {
  console.log(args, lastHandlerResult);
  return 2;
}

process.add(handler1);
process.add(handler2);

await process('abc', 'def'); // 2
// output from handler1: ['abc', 'def'], undefined
// output from handler2: ['abc', 'def'], 1
 * @example
 * // as a combination event handler

function handler1(...args) {
  return 'some value';
}

function handler2(...args, previousValue) {
  return previousValue === 'some value';
}

const bus = events.bus();

bus.on('event', functions.sequence(handler1, handler2));
await bus.fire('event', 'arg1', 'arg2'); // [true]
 * @property add - <p>Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original SequentialFunction for chaining.</p>
 * @property remove - <p>Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original SequentialFunction for chaining.</p>
 * @property insert - <p>Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original SequentialFunction for chaining.</p>
 * @property clone - <p>Creates and returns a new copy of the SequentialFunction. Methods can be added or removed
 * from this function without modifying the original.</p>
 * @param args - <p>The arguments to pass to the original functions.</p>
 */
declare type SequentialFunction = (...args: any[]) => Promise;

/**
 * <p>Function returned by {@link module:index~buffer buffer}.</p>
 * @param args - <p>The arguments to pass to the wrapped function.</p>
 */
declare type BufferFunction = (...args: any[]) => Promise;

/**
 * <p>Filters the queued invocations when a {@link module:index~buffer buffer}'s
 * signals are ready.</p>
 * @param invocations - <p>The queued invocations.</p>
 */
declare type BufferFilter = (invocations: InvocationData[]) => InvocationData[];

/**
 * <p>Provides utilities for working with collections of structured data.
 * Simplifies and standardizes support for common UI and business logic
 * surrounding data collections. You can easily extend functionality by
 * combining existing wrappers or by writing your own.</p>
 * <pre class="prettyprint source lang-js"><code>// esm
 * import { models } from '@paychex/core';
 *
 * // cjs
 * const { models } = require('@paychex/core');
 *
 * // iife
 * const { models } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ models }) { ... });
 * define(['@paychex/core'], function({ models }) { ... });
 * </code></pre>
 * @example
 * import { createRequest, fetch } from '~/path/to/data';

const getUserReports = {
  method: 'GET',
  base: 'reporting',
  path: 'reports/:user',
};

export async function getReports(user) {
  const request = createRequest(getUserReports, { user });
  const response = await fetch(request);
  const reportList = models.collection(...response.data);
  // order reports newest first and then by name
  return models.utils.withOrdering(reportList, ['date', 'name'], ['desc', 'asc']);
}
 */
declare module "models" {
    /**
     * <p>Creates a new {@link ModelCollection} instance.</p>
     * @example
     * export const emptyModel = models.collection();
    export const filledModel = models.collection(1, 2, 3);
     * @example
     * import { createRequest, fetch } from '~/path/to/data';
    import { loadClientData } from '../data';
    
    export async function createClientDataModel(client) {
      const request = createRequest(loadClientData, { client });
      const response = await fetch(request);
      return models.collection(...response.data); // spread values
    }
     * @param [items] - <p>Optional items to add to the collection.</p>
     * @returns <p>A new ModelCollection instance</p>
     */
    function collection(...items?: any[]): ModelCollection;
}

/**
 * <p>Extends {@link ModelCollection} instances with helpful functionality.</p>
 * <pre class="prettyprint source lang-js"><code>// esm
 * import { models } from '@paychex/core';
 *
 * // cjs
 * const { models } = require('@paychex/core');
 *
 * // iife
 * const { models } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ models }) { ... });
 * define(['@paychex/core'], function({ models }) { ... });
 * </code></pre>
 * @example
 * import { createRequest, fetch } from '~/path/to/data';

const getUserReports = {
  method: 'GET',
  base: 'reporting',
  path: 'reports/:user',
};

export async function getReports(user) {
  const request = createRequest(getUserReports, { user });
  const response = await fetch(request);
  const reportList = models.collection(...response.data);
  // order reports newest first and then by name
  return models.utils.withOrdering(reportList, ['date', 'name'], ['desc', 'asc']);
}
 */
declare module "models/utils" {
    /**
     * <p>Orders the specified {@link ModelCollection} items. You can order
     * using multiple selector functions and specify a different sort
     * order for each selector.</p>
     * @example
     * import { getClientData } from '../data';
    
    export async function getClientList() {
      const clients = await getClientData();
      const list = models.collection(...clients);
      const date = (client) => Date.parse(client.dateModified);
      // order by branch name ascending and then date modified descending...
      // NOTE: we can use lodash iteratee shortcuts for our accessors; see
      // https://lodash.com/docs/4.17.11#iteratee for more information.
      return models.utils.withOrdering(list, ['branch', date], ['asc', 'desc']);
    }
    
    // CONSUMERS:
    const list = await getClientList();
    list.items(); // [...clients ordered by branch asc and date desc...]
    
    // modify ordering:
    list.orderBy(); // order by identity
    list.orderBy([...iteratees]); // use ascending order
    list.orderBy([...iteratees], [...orders]); // use specified orders
     * @param list - <p>The ModelCollection instance to adapt.</p>
     * @param [args] - <p>Optional arguments to pass to lodash's orderBy method.</p>
     * @returns <p>A ModelCollection with ordering functionality.</p>
     */
    function withOrdering(list: ModelCollection, ...args?: any[]): OrderedModelCollection;
    /**
     * <p>Filters the specified ModelCollection's items.</p>
     * @example
     * import { getNotificationsList } from '../models/notifications';
    
    export async function getUnreadNotifications() {
      // wrap an existing ModelCollection
      const list = await getNotificationsList();
      return models.utils.withFiltering(list, ['unread']);
    }
     * @example
     * const isOdd = num => num % 2;
    const list = models.utils.withFiltering(models.collection(), isOdd);
    
    list.add(1, 2, 3, 4, 5);
    list.items(); // [1, 3, 5]
    
    list.filterBy(); // reset filtering
    list.items(); // [1, 2, 3, 4, 5]
     * @param list - <p>The ModelCollection instance to adapt.</p>
     * @param [filterer = identity] - <p>The filter logic to apply.</p>
     * @returns <p>A ModelCollection with added filtering logic.</p>
     */
    function withFiltering(list: ModelCollection, filterer?: ModelCollectionPredicate): FilteredModelCollection;
    /**
     * <p>Applies grouping logic to the specified ModelCollection's items.</p>
     * @example
     * import { getNotificationsList } from '../models/notifications';
    
    export async function groupNotifications() {
      // wrap an existing ModelCollection
      const list = await getNotificationsList();
      return models.utils.withGrouping(list, ['status']);
    }
     * @example
     * import { cond, conforms, constant, stubTrue } from 'lodash-es';
    import { getClientList } from '../models/client';
    
    const lessThan = (max) => (num) => num < max;
    
    // function that buckets by employeeCount
    const employeeBuckets = cond([
      [ conforms({ employeeCount: lessThan(10) }), constant('small')  ],
      [ conforms({ employeeCount: lessThan(20) }), constant('medium') ],
      [ stubTrue,                                  constant('large')  ]
    ]);
    
    export async function getBucketedClientList() {
      const list = await getClientList();
      return models.utils.withGrouping(list, employeeBuckets);
    }
    
    // CONSUMER:
    const clients = await getBucketedClientList();
    clients.groups(); // { small: [...], medium: [...], large: [...] }
    
    clients.groupBy(['region']);
    clients.groups(); // { 'east': [...], 'north': [...], 'south': [...] }
     * @param list - <p>The ModelCollection instance to adapt.</p>
     * @param [grouper = identity] - <p>Optional arguments to pass to lodash's groupBy</p>
     * @returns <p>A ModelCollection with added grouping logic.</p>
     */
    function withGrouping(list: ModelCollection, grouper?: any): GroupedModelCollection;
    /**
     * <p>Adds &quot;active item&quot; tracking and navigation to an existing {@link ModelCollection} instance.</p>
     * @example
     * const list = models.utils.withActive(models.collection(1, 2, 3));
    
    list.on('active-change', (current, previous) => {
      console.log('activating', current);
      console.log('deactivating', previous);
    });
    
    list.active(); // 1
    list.next(); // 2
    list.prev(); // 1
    list.active(3); // 3
    list.next(true); // 1
     * @param list - <p>The model list to add active item tracking and navigation to.</p>
     * @returns <p>A ModelCollection with active item tracking and navigation.</p>
     */
    function withActive(list: ModelCollection): ActiveModelCollection;
    /**
     * <p>Adds selection tracking to an existing {@link ModelCollection} instance.</p>
     * @example
     * const list = models.utils.withSelection(models.collection(1, 2, 3));
    
    list.selected(); // []
    list.toggle();   // [1, 2, 3]
    list.toggle(2);  // [1, 3]
    list.selected(3) // [3]
    
    list.on('selection-change', (selection) => {
      console.log('selection changed', selection);
    });
    
    list.selected(1); // "selection changed [1]"
    list.toggle(); // "selection changed [1, 2, 3]"
     * @param list - <p>The model list to add selection tracking to.</p>
     * @returns <p>A ModelCollection with selection capabilities.</p>
     */
    function withSelection(list: ModelCollection): SelectionModelCollection;
    /**
     * <p>Adds paging to an existing {@link ModelCollection} instance.</p>
     * @example
     * // paging over a filtered list
    
    // order matters! filter first, then page:
    const list = models.utils.withPaging(
      models.utils.withFiltering(
        models.collection()));
    
    list.pageSize(2);
    list.add(1, 2, 3, 4, 5);
    console.log(list.pageCount); // 3
    
    const isOdd = num => num % 2;
    list.filterBy(isOdd);
    console.log(list.pageCount); // 2
    
    list.add(6, 7, 8, 9, 10);
    console.log(list.pageCount); // 3
    
    console.log(list.pageIndex()); // 0
    console.log(list.items()); // [1, 3]
    
    list.nextPage();
    console.log(list.items()); // [5, 7]
     * @param list - <p>The model list to add paging to.</p>
     * @param [size = 50] - <p>The number of items to show on each page.</p>
     * @returns <p>A ModelCollection with paging capabilities.</p>
     */
    function withPaging(list: ModelCollection, size?: number): PagedModelCollection;
    /**
     * <p>Applies a uniqueness constraint to the specified {@link ModelCollection}.</p>
     * @example
     * import { getUsers } from '../data/users';
    
    export async function getUsersList() {
      const users = await getUsers();
      const userList = models.collection(...users);
      // NOTE: we can use lodash iteratee shortcuts for our selector; see
      // https://lodash.com/docs/4.17.11#iteratee for more information.
      return models.utils.withUnique(userList, 'username');
    }
     * @param list - <p>The ModelCollection instance to apply the uniqueness constraint to.</p>
     * @param [iteratee = identity] - <p>Optional key selector to use for uniqueness.</p>
     * @returns <p>A ModelCollection with a uniqueness constraint.</p>
     */
    function withUnique(list: ModelCollection, iteratee?: any): UniqueModelCollection;
    /**
     * <p>Adds methods to update the underlying collection based on a new collection.</p>
     * <p><strong>NOTE:</strong> This wrapper uses {@link module:models.withUnique withUnique}
     * to ensure that only 1 instance of an item is present in the underlying collection.</p>
     * @example
     * import { getUsers } from '../data/users';
    
    export async function getUsersList() {
      const users = await getUsers();
      const userList = models.collection(...users);
      // NOTE: we can use lodash iteratee shortcuts for our selector; see
      // https://lodash.com/docs/4.17.11#iteratee for more information.
      return models.utils.withUpdating(userList, 'username');
    }
    
    // USAGE:
    const list = await getUsersList();
    const currentUsers = await getUsers(); // maybe on a poll
    list.merge(...currentUsers);
     * @param list - <p>The ModelCollection to add updating functionality to.</p>
     * @param [selector = identity] - <p>The key selector to use to uniquely
     * identify elements in the collection.</p>
     * @returns <p>A ModelCollection that has various methods
     * you can invoke to update the underlying collection based on a new collection.</p>
     */
    function withUpdating(list: ModelCollection, selector?: any): UpdatingModelCollection;
}

/**
 * <p>Returns a boolean value given the specified inputs.</p>
 * @param value - <p>The incoming value.</p>
 * @param key - <p>The key or index of the value in the collection.</p>
 * @param collection - <p>The collection the value came from.</p>
 */
declare type ModelCollectionPredicate = (value: any, key: number | string, collection: any[]) => boolean;

/**
 * <p>Provides utilities for running complex, multi-step asynchronous processes.</p>
 * <pre class="prettyprint source lang-js"><code>// esm
 * import { process } from '@paychex/core';
 *
 * // cjs
 * const { process } = require('@paychex/core');
 *
 * // iife
 * const { process } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ process }) { ... });
 * define(['@paychex/core'], function({ process }) { ... });
 * </code></pre>
 * <p><strong>Overview</strong></p>
 * <p>A process consists of 2 things:</p>
 * <ul>
 * <li>a collection of actions to invoke</li>
 * <li>the logic for picking which actions should run at any given time</li>
 * </ul>
 * <p>This abstraction enables both workflow-style processes (multiple steps running in
 * parallel, with some steps dependent on the completion of earlier steps) as well as
 * state machine-style processes (one state active at a time, with the next state
 * determined by examining the process' current set of conditions).</p>
 * <p>You can even set up custom process logic by providing your own {@link ProcessLogic} instance
 * to the {@link module:process.process process} method. See the example {@link ProcessLogic here}.</p>
 * <p><strong>Action Methods</strong></p>
 * <p>Each {@link Action} in a process can implement methods that the process will
 * invoke at the appropriate time. These methods can be broken down into 2 categories:</p>
 * <ol>
 * <li>exec methods</li>
 * <li>post-exec methods</li>
 * </ol>
 * <p>The &quot;exec&quot; methods are run when the action is invoked. These include {@link Action#init init},
 * {@link Action#execute execute} and {@link Action#retry retry}.</p>
 * <p>The &quot;post-exec&quot; methods are run after the process completes. These include
 * {@link Action#rollback rollback}, {@link Action#failure failure}, and
 * {@link Action#success success}.</p>
 * <p><strong>IMPORTANT!</strong> The post-exec methods are run <em>in parallel</em> and <em>at the same time</em> that
 * the {@link ExecutionPromise} returned by {@link ProcessStart} is resolved or rejected,
 * meaning there is no guaranteed order between your process callbacks and your actions'
 * post-exec methods.</p>
 */
declare module "process" {
    /**
     * <p>Method that takes no arguments and can return any type. If it returns a Promise,
     * the resolved value will be returned instead.</p>
     */
    type AsyncVoidFunction = () => any;
    /**
     * <p>Creates a fully realized {@link Action} for use within a {@link module:process.process process}.</p>
     * @example
     * async function loadData() {
      // make a data call
    }
    
    function processResults() {
      // access this.results.load
      // value returned will be assigned
      // to this.results.process
    }
    
    const actions = models.collection();
    actions.add(process.action('load', loadData));
    actions.add(process.action('process', processResults));
    
    // "load" should transition to "process" automatically:
    const criteria = [ ['load', 'process'] ];
    
    export const start = process.create('get data', actions, process.transitions(criteria));
     * @param name - <p>The name of the process action.</p>
     * @param api - <p>The execute method or partial {@link Action} to fill out.</p>
     */
    function action(name: string, api: AsyncVoidFunction | Action): Action;
    /**
     * <p>Utility method to run a single {@link Action} in isolation.
     * This method is used internally by {@link module:process.process process}
     * but is made available publicly for unusual situations.</p>
     * <p><strong>NOTE:</strong> The success and failure methods will not be run using this
     * method since their invocation depends on whether or not a collection
     * of Actions has completed successfully. If you want to invoke
     * the success and failure methods, you should do so manually. See the
     * example for details.</p>
     * @example
     * const step = process.action('something', {
      count: 0,
      init() { this.count = 0; },
      execute() {
        console.log(this.args);
        this.count = this.count + 1;
        return this.count * this.factor;
      },
      success() {}, // must be invoked manually
      failure(err) {}, // must be invoked manually
    });
    
    export async function invokeSomething(...args) {
      const context = { args, factor: 3 };
      const promise = process.run(step, context);
      // invoke success and failure methods
      // on separate promise chain than the
      // one we return to callers; we don't
      // care if these fail and we don't want
      // their return values to override the
      // return value from the execute method
      promise.then(
        () => step.success.call(context),
        (err) => step.failure.call(context, err)
      );
      return await promise; // value returned by execute()
    }
     * @param item - <p>The Action whose methods should be invoked.</p>
     * @param context - <p>The context accessed using <code>this</code> within an action method.</p>
     * @param [initialize = true] - <p>Whether to run the Action's init method.</p>
     */
    function run(item: Action, context: ProcessContext, initialize?: boolean): void;
    /**
     * <p>Returns a method you can invoke to begin a complex asynchronous process.
     * The order of actions taken is determined using the {@link ProcessLogic}
     * object passed as the last argument. You can use the built-in {@link dependencies}
     * and {@link transitions} logic factories to create this object for you,
     * or supply your own logic to create custom process behaviors.</p>
     * @example
     * // workflow
    
    import { loadUserInfo } from '../data/user';
    import { loadClientData } from '../data/clients';
    
    import { start } from '../path/to/machine';
    
    const actions = models.collection();
    
    actions.add(process.action('loadUserInfo', loadUserInfo));
    
    actions.add(process.action('loadClientData', {
      async execute() {
        const clientId = this.args[0];
        return await loadClientData(clientId)
          .catch(errors.rethrow({ clientId }));
      }
    }));
    
    actions.add(process.action('merge', {
      execute() {
        const user = this.results.loadUserInfo;
        const clients = this.results.loadClientData;
        return Object.assign({}, user, { clients });
      }
    }));
    
    actions.add(process.action('eula', function execute() {
      const conditions = this.results;
      return start('initial', conditions);
    }));
    
    export const dispatch = process.create('load user clients', actions, process.dependencies({
      'eula': ['merge'],
      'merge': ['loadUserInfo', 'loadClientData'],
    }));
    
    // USAGE: dispatch(clientId);
     * @example
     * // state machine
    
    import { tracker } from '~/tracking';
    import { showDialog } from '../some/dialog';
    import { dispatch } from '../some/workflow';
    
    const actions = new Set();
    
    // if no start state is explicitly passed to the start()
    // method then this first action will be used automatically
    actions.add(process.action('start', {
      success() {
        tracker.event(`${this.process} succeeded`);
      },
      failure(err) {
        Object.assign(err, errors.fatal());
        tracker.error(err);
      }
    }));
    
    actions.add(process.action('show dialog', {
      execute() {
        return showDialog('accept.cookies');
      }
    }));
    
    // we can dispatch a workflow in one of our actions
    actions.add(process.action('run workflow', function execute() {
      const cookiesEnabled = this.results['show dialog'];
      const ignoreError = errors.rethrow(errors.ignore({ cookiesEnabled }));
      return dispatch(cookiesEnabled).catch(ignoreError);
    }));
    
    actions.add(process.action('stop', function() {
      this.stop(); // stop the machine
    }));
    
    const transitions = process.transitions([
    
      // show the dialog after starting the machine
      ['start', 'show dialog'],
    
      // only run the workflow if the user has not
      // logged in within the past 2 weeks
      ['show dialog', 'run workflow', function notRecentlyLoggedIn() {
        const TWO_WEEKS = 1000 * 60 * 60 * 24 * 7 * 2;
        const lastLogin = Date.parse(localStorage.getItem('lastLogin'));
        return lastLogin < Date.now() - TWO_WEEKS;
      }],
    
      // only if the above transition's condition returns
      // false (i.e. the user has recently logged in) will
      // this next transition will be evaluated; and since
      // this next transition always returns true, the machine
      // will always have a path forward
      ['show dialog', 'stop'],
    
      // if we did get into the "run workflow" state, make
      // sure we stop the workflow afterwards
      ['run workflow', 'stop']
    
    ]);
    
    export const start = process.create('intro', actions, transitions);
     * @param name - <p>The name of the process to run.</p>
     * @param actions - <p>An interable collection (e.g. Set, array, or {@link ModelList}) of {@link Action}s to run.</p>
     * @param logic - <p>The logic that determines how to start and continue a process.</p>
     * @returns <p>A method you can invoke to begin the process. The arguments will
     * depend in part on the {@link ProcessLogic} object you passed.</p>
     */
    function create(name: string, actions: Iterable<Action>, logic: ProcessLogic): ProcessStart;
    /**
     * <p>Creates a {@link ProcessLogic} instance that can be passed to the {@link module:process.process process}
     * method. When started, the process will use the dependency map to determine which {@link Action actions}
     * can be invoked immediately (having no dependencies) and which should be run when their dependent actions
     * have completed.</p>
     * <p>This method results in the process running like a <em>workflow</em>, with some actions run in parallel
     * and the execution order of actions dependent upon the stated dependencies.</p>
     * @example
     * const dependencies = process.dependencies({
      'step b': ['step a'], // action b runs after action a
      'step c': ['step b', 'step d'] // action c runs after actions b and d
    });
    
    const actions = [
      process.action('step a', () => console.log('step a run')),
      process.action('step b', () => console.log('step b run')),
      process.action('step c', () => console.log('step c run')),
      process.action('step d', () => console.log('step d run')),
    ];
    
    export const dispatch = process.create('my workflow', actions, dependencies);
     * @example
     * const actions = [
      process.action('start', function execute() {
        console.log('args:', this.args);
      }),
      process.action('parallel 1', function execute() {
        console.log('in', this.name);
      }),
      process.action('parallel 2', function execute() {
        console.log('in', this.name);
      }),
    ];
    
    const order = process.dependencies({
      'parallel 1': ['start'],
      'parallel 2': ['start'],
    });
    
    export const dispatch = process('my workflow', actions, order);
    
    // USAGE:
    // dispatch(123, 'abc');
     * @param [deps = {}] - <p>The dependency map that should be used
     * to determine the initial and follow-up {@link Action actions} to invoke in this
     * process.</p>
     * @returns <p>A ProcessLogic instance that {@link module:process.process process}
     * can use to determine how to run the {@link ModelList} {@link Action actions} it was provided.</p>
     */
    function dependencies(deps?: {
        [key: string]: string[];
    }): ProcessLogic;
    /**
     * <p>Creates a {@link ProcessLogic} instance that can be passed to the {@link module:process.process process}
     * method. When started, the process will use the transition criteria to determine which {@link Action actions}
     * can be invoked based on the current set of {@link ProcessContext#conditions conditions} as passed to
     * the {@link ProcessStart start} method <em>or</em> through calls to {@link ExecutionUpdate update}.</p>
     * <p><strong>NOTE:</strong> A process using transitions logic will not stop until and unless one of the following occurs:</p>
     * <ul>
     * <li>someone invokes the <code>stop()</code> method</li>
     * <li>someone invokes the <code>cancel()</code> method</li>
     * <li>a {@link Action} method throws an Error or returns a rejected Promise</li>
     * </ul>
     * <p>This method results in the process running like a <em>state machine</em>, with one action allowed to run at any
     * time and the next action determined using the current conditions and the given transition logic.</p>
     * @example
     * const states = models.collection();
    
    states.add(process.action('start', () => console.log('start')));
    states.add(process.action('next',  () => console.log('next')));
    states.add(process.action('stop',  function() {
      this.stop();
    }));
    
    const criteria = process.transitions([
      ['start', 'next'],
      ['next', 'stop']
    ]);
    
    export const start = process('my machine', states, criteria);
    
    // USAGE:
    start();
    start('next');
    start('stop', { initial: 'conditions' });
    // you can also just provide initial conditions;
    // the first action will still be used as the start action
    start({ initial: 'conditions' });
     * @param [criteria = []] - <p>The transitions that should be used
     * to determine the initial and follow-up {@link Action actions} to invoke in this
     * process.</p>
     * @returns <p>A ProcessLogic instance that {@link module:process.process process}
     * can use to determine how to run the {@link ModelList} {@link Action actions} it was provided.</p>
     */
    function transitions(criteria?: ProcessTransitions): ProcessLogic;
}

/**
 * <p>The method you invoke to begin an asynchronous process.</p>
 * @example
 * const actions = [
  process.action('a', () => console.log('a')),
  process.action('b', () => console.log('b')),
  process.action('c', () => console.log('c')),
];

const deps = process.dependencies({ 'b': ['a', 'c'] });
const trans = process.transitions([ ['a', 'c'], ['c', 'b']]);

const dispatch = process.create('workflow', actions, deps);
const start = process.create('state machine', actions, trans);

const workflowPromise = dispatch('arg 1', 'arg 2');
const machinePromise = start('a', { condition: 'value' });
 * @param [args] - <p>The arguments to invoke the process with. Which
 * arguments you pass will depend on the {@link ProcessLogic} instance
 * you passed to {@link module:process.process process}.</p>
 */
declare type ProcessStart = (...args?: any[]) => ExecutionPromise;

/**
 * <p>Provides utilities for synchronizing blocks of code.</p>
 * <pre class="prettyprint source lang-js"><code>// esm
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
 * </code></pre>
 * <p>There are 4 types of signals provided in this module:</p>
 * <p><strong>Manual Reset Signal</strong></p>
 * <p>Think of the manual reset signal as a traffic light. While it is red,
 * all cars are queued in the order they arrive. Once the light is signaled
 * green, the cars can proceed in the order they arrived. And as long as the
 * light remains green, any future cars can proceed.</p>
 * <p>Use cases:</p>
 * <ul>
 * <li>wait for a router to bootstrap before enabling navigation</li>
 * <li>block all load operations until a save operation completes</li>
 * </ul>
 * <p><strong>Auto Reset Signal</strong></p>
 * <p>The auto reset signal can be used to create a <code>critical section</code> -- i.e. a
 * block of code that can only be executed by 1 caller at a time. Every other
 * caller will be queued in the order they arrive, and the next caller in the
 * queue will only be allowed to enter the critical section when the previous
 * caller leaves the critical section.</p>
 * <p>Use cases:</p>
 * <ul>
 * <li>ensure only 1 dialog is shown to the user at a time</li>
 * <li>queue router navigations while a navigation is in process</li>
 * <li>ensure a specific network call completes before being called again</li>
 * </ul>
 * <p><strong>Countdown Signal</strong></p>
 * <p>A countdown signal allows you to queue callers until a certain number of
 * operations have completed.</p>
 * <p>Use cases:</p>
 * <ul>
 * <li>disable the UI until a group of downloads have finished</li>
 * <li>wait for a set of child components to load before stopping a timer</li>
 * </ul>
 * <p><strong>Semaphore</strong></p>
 * <p>Think of a semaphore as a bouncer at a club who ensures that only a certain
 * number of people are allowed in at one time. In other words, semaphores are
 * used to control access to a limited pool of resources.</p>
 * <p>Use cases:</p>
 * <ul>
 * <li>limit file uploads to a maximum of 5 at a time</li>
 * <li>limit in-progress data calls on a slow network</li>
 * </ul>
 */
declare module "signals" {
    /**
     * <p>Creates a signal that queues callers until signaled. While signaled, resolves
     * all callers in the order they were queued.</p>
     * <p>Think of a manual reset signal as a traffic light. While it is red, all cars
     * are queued in the order they arrive. Once the light is signaled green, the cars
     * can proceed in the order they arrived. And as long as the light remains green,
     * any future cars can proceed.</p>
     * @example
     * const signal = signals.manualReset();
    
    export function bootstrap() {
      // do some preliminary stuff
      signal.set(); // unblock any callers
    }
    
    export async function doSomething() {
      // block callers until signaled:
      await signal.ready();
      // bootstrap has now been called and
      // completed, so we can safely perform
      // an operation here
    }
     * @example
     * // simple pause/resume functionality
    
    const signal = signals.manualReset(true); // start unblocked
    
    export async function doSomething() {
      await signal.ready();
      // do stuff here
    }
    
    export function pause() {
      signal.reset();
    }
    
    export function resume() {
      signal.set();
    }
     * @param [signaled = false] - <p>Whether to start in a signaled state.</p>
     * @returns <p>A signal that resolves all callers while signaled.</p>
     */
    function manualReset(signaled?: boolean): ManualResetSignal;
    /**
     * <p>Creates a signal that queues callers until signaled. Releases only 1 queued
     * caller each time it is signaled, then automatically resets into a blocked state.</p>
     * <p>The auto reset signal can be used to create a <code>critical section</code> -- i.e. a block
     * of code that can only be executed by 1 caller at a time. Every other caller will
     * be queued in the order they arrive, and the next caller in the queue will only
     * be allowed to enter the critical section when the previous caller leaves the
     * critical section.</p>
     * @example
     * import { fetch, createRequest } from '../path/to/datalayer';
    
    const signal = signals.autoReset(true); // start unblocked
    const operation = {
      method: 'POST',
      base: 'my-app',
      path: '/some/endpoint'
    };
    
    // ensure each network call completes
    // before the next call is performed:
    export async function networkCall() {
      await signal.ready(); // block other callers
      try {
        const data = { ... }; // payload to POST to the endpoint
        const request = createRequest(operation, null, data);
        const response = await fetch(request);
        return response.data;
      } finally {
        signal.set(); // unblock the next caller
      }
    }
     * @returns <p>A signal that releases 1 caller each time it is signaled.</p>
     */
    function autoReset(signaled?: boolean): AutoResetSignal;
    /**
     * <p>Creates a signal that will queue callers until the counter reaches 0. At that
     * point, all callers will be invoked in the order they were queued.</p>
     * @example
     * export function downloadAll(files = []) {
      const signal = signals.countdown(files.length);
      files.forEach(file =>
        download(file).finally(() =>
          signal.decrement()));
      return signal.ready();
    }
     * @example
     * // progress blocking
    
    const counter = signals.countdown();
    
    export function addBlockingTask(task) {
      counter.increment();
      return Promise.resolve()
        .then(task)
        .finally(counter.decrement);
    }
    
    export function tasksCompleted() {
      return counter.ready();
    }
     * @param [initialCount = 0] - <p>The initial count of the signal. Must be a non-negative integer.</p>
     * @returns <p>Queues callers until the counter reaches 0.</p>
     */
    function countdown(initialCount?: number): CountdownSignal;
    /**
     * <p>Limits access to a pool of resources by restricting how many callers can run at a time.
     * Any callers above the allowed amount will be queued until a spot is released.</p>
     * @example
     * import { fetch, createRequest } from '~/path/to/datalayer';
    import { tracker } from '~/path/to/tracker';
    
    const uploadSpots = signals.semaphore(5);
    
    const operation = {
      base: 'files',
      method: 'POST',
      path: '/save/:id'
    };
    
    export async function uploadFile(blob) {
      const data = new FormData();
      const params = { id: tracker.uuid() };
      data.append('file', blob, params.id);
      try {
        await uploadSpots.ready();
        await fetch(createRequest(operation, params, data));
        return params.id;
      } finally {
        uploadSpots.release(); // always release
      }
    }
     * @param [maxConcurrency = 5] - <p>The maximum number of parallel callers to allow.</p>
     * @returns <p>Limits access to a pool of resources by restricting how many callers can run at a time.</p>
     */
    function semaphore(maxConcurrency?: number): Semaphore;
}

/**
 * <p>Provides methods for storing information on the client's
 * machine. The persistence period will vary based on the
 * storage type and configuration.</p>
 * <pre class="prettyprint source lang-js"><code>// esm
 * import { stores } from '@paychex/core';
 *
 * // cjs
 * const { stores } = require('@paychex/core');
 *
 * // iife
 * const { stores } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ stores }) { ... });
 * define(['@paychex/core'], function({ stores }) { ... });
 * </code></pre>
 */
declare module "stores" {
    /**
     * <p>An in-memory store whose contents will be cleared each time the
     * user navigates away from the page or refreshes their browser.</p>
     * <p><strong>NOTE</strong>: Objects are serialized to JSON during storage to ensure
     * any modifications to the original object are not reflected in the
     * cached copy as a side-effect. Retrieving the cached version will
     * always reflect the object as it existed at the time of storage.
     * <em>However</em>, some property types cannot be serialized to JSON. For
     * more information, <a href="https://abdulapopoola.com/2017/02/27/what-you-didnt-know-about-json-stringify/">read this</a>.</p>
     * @example
     * import { fetch, createRequest } from '~/path/to/datalayer';
    
    const operation = {
      base: 'reports',
      path: 'jobs/:id'
    };
    
    const store = stores.memoryStore();
    const cache = stores.utils.asDataCache(store);
    const pipeline = data.utils.withCache(fetch, cache);
    
    export async function loadData(id) {
      const params = { id };
      const request = createRequest(operation, params);
      const response = await pipeline(request).catch(errors.rethrow(params));
      return response.data;
    }
     * @returns <p>A Store that is not persisted. The store will
     * be cleared when the site is refreshed or navigated away from.</p>
     */
    function memoryStore(): Store;
}

/**
 * <p>Contains utility methods for working with Stores.</p>
 * <pre class="prettyprint source lang-js"><code>// esm
 * import { stores } from '@paychex/core';
 *
 * // cjs
 * const { stores } = require('@paychex/core');
 *
 * // iife
 * const { stores } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ stores }) { ... });
 * define(['@paychex/core'], function({ stores }) { ... });
 * </code></pre>
 */
declare module "stores/utils" {
    /**
     * <p>Wraps a {@link Store} instance so values are encrypted and
     * decrypted transparently when get and set. For increased security,
     * the key used to store a value will also be used to salt the given
     * private key, ensuring each object is stored with a unique key.</p>
     * @example
     * // random private key and initialization vector
    
    const iv = window.crypto.getRandomBytes(new UintArray(16));
    const key = window.crypto.getRandomBytes(new UintArray(8));
    
    export const lockbox = stores.utils.withEncryption(stores.memoryStore(), { key, iv });
     * @example
     * // user-specific private key and initialization vector
    
    import { proxy } from 'path/to/proxy';
    import { getUserPrivateKey, getUserGUID } from '../data/user';
    
    const database = stores.indexedDB({ store: 'my-store' });
    
    export async function loadData(id) {
      const iv = await getUserGUID();
      const key = await getUserPrivateKey();
      const encrypted = stores.utils.withEncryption(database, { key, iv });
      try {
        return await encrypted.get(id);
      } catch (e) {
        return await someDataCall(...)
          .then(value => {
             encrypted.set(id, value);
             return value;
          });
      }
    }
     * @param store - <p>Underlying Store instance whose values will
     * be encrypted during <code>set</code> calls and decrypted during <code>get</code> calls.</p>
     * @param config - <p>Indicates which encryption
     * method and encryption key to use.</p>
     * @returns <p>A Store instance that will encrypt and decrypt
     * values in the underlying store transparently.</p>
     */
    function withEncryption(store: Store, config: EncryptionConfiguration): Store;
    /**
     * <p>Wraps a Store so any keys are transparently modified before access.
     * This can be useful when storing data on a machine that will have
     * more than 1 user, to ensure different users don't access each other's
     * stored information.</p>
     * @example
     * import { user } from '../data/user';
    
    const store = stores.utils.withPrefix(stores.localStore(), user.guid);
     * @example
     * import { user } from '../data/user';
    
    const store = stores.utils.withPrefix(stores.localStore(), function(key) {
      return `${key}|${user.guid}`;
    });
     * @param store - <p>The store whose keys should be modified before access.</p>
     * @param prefix - <p>A string to prepend to any keys <em>or</em> a
     * function that will modify a key.</p>
     */
    function withPrefix(store: Store, prefix: string | Prefixer): void;
    /**
     * <p>Creates a {@link DateFactory} that returns a Date the specified number of
     * weeks in the future.</p>
     * @example
     * export const store = stores.utils.withExpiration(
      stores.localStore(),
      stores.utils.weeks(2)
    );
     * @param count - <p>The number of weeks in the future the Date should be.</p>
     * @returns <p>A function that returns a Date.</p>
     */
    function weeks(count: number): DateFactory;
    /**
     * <p>Creates a {@link DateFactory} that returns a Date the specified number of
     * days in the future.</p>
     * @example
     * export const store = stores.utils.withExpiration(
      stores.localStore(),
      stores.utils.days(1)
    );
     * @param count - <p>The number of days in the future the Date should be.</p>
     * @returns <p>A function that returns a Date.</p>
     */
    function days(count: number): DateFactory;
    /**
     * <p>Creates a {@link DateFactory} that returns a Date the specified number of
     * hours in the future.</p>
     * @example
     * export const store = stores.utils.withExpiration(
      stores.localStore(),
      stores.utils.hours(8)
    );
     * @param count - <p>The number of hours in the future the Date should be.</p>
     * @returns <p>A function that returns a Date.</p>
     */
    function hours(count: number): DateFactory;
    /**
     * <p>Creates a {@link DateFactory} that returns a Date the specified number of
     * minutes in the future.</p>
     * @example
     * export const store = stores.utils.withExpiration(
      stores.localStore(),
      stores.utils.minutes(90)
    );
     * @param count - <p>The number of minutes in the future the Date should be.</p>
     * @returns <p>A function that returns a Date.</p>
     */
    function minutes(count: number): DateFactory;
    /**
     * <p>Wraps a Store so values expire after a specified Date. Any attempts to
     * retrieve a value after it has expired will return <code>undefined</code>.</p>
     * @example
     * export const store = stores.utils.withExpiration(
      stores.localStore(),
      stores.utils.minutes(90)
    );
     * @example
     * import { user } from '../path/to/user';
    import { fetch, createRequest } from '../path/to/datalayer';
    
    const reports = stores.indexedDB({ store: 'reports' });
    const expires = stores.utils.withExpiration(reports, stores.utils.days(30));
    const encrypted = stores.utils.withEncryption(expires, {
      iv: user.id,
      key: user.privateKey,
    });
    
    const operation = {
      base: 'reports',
      path: '/reports/:id'
    };
    
    const pipeline = data.utils.withCache(fetch, stores.utils.asDataCache(encrypted));
    
    export async function getReportById(id) {
      const request = createRequest(operation, { id });
      const response = await pipeline(request);
      return response.data;
    }
     * @param store - <p>The store to wrap.</p>
     * @param dateFactory - <p>Function to create expiration Dates.</p>
     * @returns <p>A Store that returns <code>undefined</code> if a value has expired.</p>
     */
    function withExpiration(store: Store, dateFactory: DateFactory): Store;
    /**
     * <p>Utility method to wrap a {@link Store} implementation as a {@link Cache}
     * instance. Uses the {@link Request} url as the cache key.</p>
     * @example
     * import { createRequest, fetch } from '~/path/to/datalayer';
    
    const dataCall = {
      method: 'GET',
      base: 'server',
      path: '/values/:key'
    };
    
    // NOTE: use withEncryption(store, options) if the response
    // might contain personal or sensitive information that you
    // wish to keep secret
    const store = stores.indexedDB({ store: 'myDataValues' });
    const attempt = data.utils.withCache(fetch, stores.utils.asDataCache(store));
    
    export async function loadData(key) {
      const params = { key };
      const request = createRequest(dataCall, params);
      const response = await attempt(request).catch(errors.rethrow(params));
      return response.data;
    }
     * @param store - <p>The Store implementation to use as the Cache backing.</p>
     * @returns <p>A Cache implementation backed by the specified Store.</p>
     */
    function asDataCache(store: Store): Cache;
}

/**
 * <p>Method used to modify a key for use in a Store. Used primarily by
 * {@link module:stores/utils.withPrefix withPrefix}.</p>
 * @example
 * import { user } from '../data/user';

const store = stores.utils.withPrefix(stores.localStore(), function(key) {
  return `${key}|${user.guid}`;
});
 * @param key - <p>The key to modify before passing to a Store.</p>
 */
declare type Prefixer = (key: string) => string;

/**
 * <p>Factory method that returns a new Date instance on each invocation.</p>
 * @example
 * export const store = stores.utils.withExpiration(stores.localStore(), function sevenDays() {
  const now = Date.now();
  const days = 24 * 60 * 60 * 1000;
  return new Date(now + 7 * days);
});
 */
declare type DateFactory = () => Date;

/**
 * <p>Provides functionality useful during unit testing.</p>
 */
declare module "test" {
    /**
     * <p>Creates a new Spy instance for unit tests. A Spy is a
     * method that takes the place of an existing method and
     * has additional properties that can be queried to verify
     * that certain test conditions have been met.</p>
     * @example
     * import expect from 'expect';
    import { spy } from '@paychex/core/test/utils';
    import someFactoryMethod from '../path/to/test/file';
    
    describe('some factory method', () => {
    
      let instance, dependency;
    
      beforeEach(() => {
        dependency = {
          methodA: spy().returns('a'),
          methodB: spy().returns('b')
        };
        instance = someFactoryMethod(dependency);
      });
    
      it('invokes dependency method a', () => {
        instance.method();
        expect(dependency.methodA.called).toBe(true);
      });
    
      it('handles error', async () => {
        const handler = spy();
        const err = new Error('test');
        dependency.methodB.throws(err);
        await instance.anotherMethod().catch(handler);
        expect(handler.called).toBe(true);
        expect(handler.args[0]).toBe(err);
      });
    
      it('retries on error', async () => {
        dependency.methodA.onCall(0).throws(new Error());
        dependency.methodA.onCall(1).returns(123);
        const result = instance.method();
        expect(dependency.methodA.callCount).toBe(2);
        expect(result).toBe(123);
      });
    
    });
     * @returns <p>A new Spy instance for unit testing.</p>
     */
    function spy(): Spy;
}

/**
 * <p>Provides event, error, and performance logging for applications.</p>
 * <pre class="prettyprint source lang-js"><code>// esm
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
 * </code></pre>
 * @example
 * export const tracker = trackers.create(console.log);

export async function bootstrap(appId) {
  const child = tracker.child();
  try {
    child.context({ app: appId });
    const stop = child.start('bootstrap time');
    const scripts = await loadScripts();
    child.event('app bootstrapped');
    stop({
      tags: ['perf', 'ct-003'],
      scriptCount: scripts.length
    });
  } catch (e) {
    child.error(e);
  }
}
 */
declare module "trackers" {
    /**
     * <p>Creates a new {@link Tracker} instance. The specified subscriber will
     * be notified when new {@link TrackingInfo} entries are created.</p>
     * @example
     * const tracker = trackers.create((info) => {
      console.log(JSON.stringify(info));
    });
     * @param subscriber - <p>A method that will invoked
     * each time a {@link TrackingInfo} entry is created.</p>
     * @returns <p>The new Tracker instance.</p>
     */
    function create(subscriber: TrackingSubscriber): Tracker;
}

/**
 * <p>Invoked each time a {@link Tracker} (or child Tracker) method produces
 * a new {@link TrackingInfo} instance.</p>
 * @example
 * const tracker = trackers.create((info) => {
  console.log(JSON.stringify(info));
});
 * @example
 * // delegating tracking entries to a Redux store

import { store } from '~/path/to/actions';

const tracker = trackers.create((info) => {
  store.dispatch({
    type: `track:${info.type}`,
    payload: info
  });
});
 */
declare type TrackingSubscriber = (info: TrackingInfo) => void;

/**
 * <p>Provides utility methods for working with Tracker instances or collectors.</p>
 * <pre class="prettyprint source lang-js"><code>// esm
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
 * </code></pre>
 */
declare module "trackers/utils" {
    /**
     * <p>Wraps a collector so the {@link TrackingInfo} instance's key and value
     * strings will be replaced according to the specified map. Used
     * primarily to convert system codes into human-readable values
     * before passing to a collector.</p>
     * @example
     * const map = new Map([
      [/^lang$/, 'language'],
      [/\ben\b/i, 'English'],
      [/\bes\b/i, 'Spanish'],
    ]);
    
    const collector = trackers.utils.withReplacement(console.log, map);
    export const tracker = trackers.create(collector);
    
    tracker.event('lang', { avail: ['es', 'en'], selected: 'en' });
    
    `{
      id: '09850c98-8d0e-4520-a61c-9401c750dec6',
      type: 'event',
      label: 'language',
      start: 1611671260770,
      stop: 1611671260770,
      duration: 0,
      count: 1,
      data: {
        avail: [ 'Spanish', 'English' ],
        selected: 'English'
      }
    }`
     * @param collector - <p>The collector function to wrap. Will
     * be invoked with a new TrackingInfo instance whose keys and values
     * will be replaced according to the given map.</p>
     * @param map - <p>The
     * mapping of values to replace. For example, <code>/\ben\b/gi -&gt; 'English'</code>
     * would change all instances of <code>'en'</code> to <code>'English'</code>. <strong>NOTE:</strong>
     * Be sure to use <code>\b</code> to indicate word boundaries, <code>^</code> and <code>$</code> to indicate
     * the start and end of a string, <code>/g</code> to enable multiple replacements
     * within a string, and <code>/i</code> to ignore case.</p>
     */
    function withReplacement(collector: (...params: any[]) => any, map: Map<RegExp, string>): void;
    /**
     * <p>Enables nested timings for the given Tracker instance.</p>
     * <p><strong>IMPORTANT:</strong> Enabling nested timings introduces edge cases and best practices
     * you should understand before using. See the {@link NestedTimingTracker} documentation
     * for more information.</p>
     * @example
     * import { tracker } from '~/tracking';
    
    const child = tracker.child();
    const logger = trackers.utils.withNesting(child);
    
    async function loadSecurity(start, clientId) {
        const [stop] = start('load user roles');
        await fakeDataCall(clientId); // pretend data call
        stop({ role: 'admin' });
    }
    
    async function loadFeatures(start, product) {
        const [stop] = start(`load ${product} features`);
        await fakeDataCall(product); // pretend data call
        stop({ features: [
            `${product}-feat-a`,
            `${product}-feat-b`
        ]});
    }
    
    async function loadProducts(start, clientId) {
        const [stop, nest] = start('load products');
        await fakeDataCall(clientId); // pretend data call
        await Promise.all([
            loadFeatures(nest, 'prod-a'),
            loadFeatures(nest, 'prod-b')
        ]);
        stop({ products: ['prod-a', 'prod-b'] });
    }
    
    async function loadClientData(clientId) {
        const [stop, nest] = logger.start('load client data');
        await loadProducts(nest, clientId);
        await loadSecurity(nest, clientId);
        stop({ clientId });
    }
    
    await loadClientData('client-123');
    
    // timing tree:
    {
      "id": "dfc21f25-42da-439f-8fd4-23ab02b70668",
      "label": "load client data",
      "start": 1562872496161,
      "stop": 1562872496208,
      "duration": 47,
      "type": "timer",
      "count": 1,
      "data": {
        "children": [
          {
            "label": "load products",
            "count": 1,
            "start": 1562872496161,
            "stop": 1562872496192,
            "duration": 31,
            "data": {
              "children": [
                {
                  "label": "load prod-a features",
                  "count": 1,
                  "start": 1562872496176,
                  "stop": 1562872496191,
                  "duration": 15,
                  "data": {
                    "children": [],
                    "features": [
                      "prod-a-feat-a",
                      "prod-a-feat-b"
                    ]
                  }
                },
                {
                  "label": "load prod-b features",
                  "count": 1,
                  "start": 1562872496176,
                  "stop": 1562872496192,
                  "duration": 16,
                  "data": {
                    "children": [],
                    "features": [
                      "prod-b-feat-a",
                      "prod-b-feat-b"
                    ]
                  }
                }
              ],
              "products": [
                "prod-a",
                "prod-b"
              ]
            }
          },
          {
            "label": "load user roles",
            "count": 1,
            "start": 1562872496192,
            "stop": 1562872496208,
            "duration": 16,
            "data": {
              "children": [],
              "role": "admin"
            }
          }
        ],
        "clientId": "client-123"
      }
    }
     * @param tracker - <p>The Tracker to wrap to enable nested timings.</p>
     * @returns <p>A Tracker instance that can create nested timings.</p>
     */
    function withNesting(tracker: Tracker): NestedTimingTracker;
}

/**
 * <p>Metadata used to construct a {@link Request} instance.</p>
 */
declare class DataDefinition {
    /**
     * <p>Used in conjunction with {@link ProxyRule ProxyRules} to determine the
     * domain name for the resulting {@link Request} URL. If an empty string is provided then a relative
     * URL (one without a protocol or domain name) will be created using the existing domain name and protocol.</p>
     */
    base: string;
    /**
     * <p>Combined with the base path (if provided) to construct an absolute or relative URL.</p>
     */
    path: string;
    /**
     * <p>The adapter to use to complete the request.</p>
     */
    adapter: string;
    /**
     * <p>The HTTP headers to use on the request.</p>
     */
    headers: {
        [key: string]: string | string[];
    };
    /**
     * <p>Can be used to skip certain behaviors. See documentation for details.</p>
     */
    ignore: {
        [key: string]: boolean;
    };
    /**
     * <p>The HTTP verb to use.</p>
     */
    method: string;
    /**
     * <p>The desired response type. Can be one of <code>''</code> (the default),
     * <code>'text'</code>, <code>'json'</code>, <code>'arraybuffer'</code>, <code>'blob'</code> or <code>'document'</code>. See {@link https://xhr.spec.whatwg.org/#response-body the XHR spec}
     * for more information. Setting this will change the {@link Response Response.data} type.</p>
     */
    responseType: string;
    /**
     * <p>The number of milliseconds to wait before aborting the data call.</p>
     */
    timeout: number;
    /**
     * <p>Whether to send Cookies with the request.</p>
     */
    withCredentials: boolean;
}

/**
 * <p>Encapsulates the information used by {@link Adapter Adapters} to complete a data call.</p>
 * <p><strong>WARNING:</strong> Do not construct a Request object manually. Instead, pass a {@link DataDefinition}
 * object to {@link DataLayer#createRequest createRequest()} directly.</p>
 * <p><strong>IMPORTANT:</strong> The Request object is frozen. Any attempt to modify existing Request values
 * will result in an Error. If you need to modify a Request as part of a data pipeline, use
 * {@link https://lodash.com/docs/4.17.11#cloneDeep cloneDeep} (or similar) to make a copy of
 * the Request that can be safely modified.</p>
 */
declare class Request extends DataDefinition {
    /**
     * <p>The URL to open, constructed using {@link Proxy#url Proxy.url()} and any
     * {@link ProxyRule ProxyRules} that match the given Request properties as well as any optional
     * parameters passed to {@link DataLayer#createRequest createRequest()}.</p>
     */
    url: string;
    /**
     * <p>An optional payload to send to the URL, set when calling {@link DataLayer#createRequest createRequest()}.</p>
     */
    body: any;
}

/**
 * <p>Contains information returned from endpoints (typically only when an error occurs).
 * Messages should NOT be presented to end users directly (although message codes could
 * translated and presented if they provide useful guidance on how to recover from an
 * error).</p>
 */
declare class Message {
    /**
     * <p>A unique code to identify this message. May be used during
     * translation to present recovery information to the end user.</p>
     */
    code: string;
    /**
     * <p>The message severity. Possible values are ERROR, FATAL, and NONE.</p>
     */
    static severity: string;
    /**
     * <p>Any additional information the server believes may be useful
     * when triaging the error later.</p>
     */
    data: any[];
}

/**
 * <p>Additional Response information.</p>
 */
declare class MetaData {
    /**
     * <p>Whether the response should be considered a failure.</p>
     */
    error: boolean;
    /**
     * <p>Whether the response contains cached data.</p>
     */
    cached: boolean;
    /**
     * <p>Whether the response timed out. When this is true,
     * [Response.status]{@link Response} should be 0 and <code>meta.error</code> should be true.</p>
     */
    timeout: boolean;
    /**
     * <p>Map of response headers returned by the network call.</p>
     */
    headers: HeadersMap;
    /**
     * <p>Collection of {@link Message} instances; may be empty.</p>
     */
    static messages: Message[];
}

/**
 * <p>Represents the results of an Adapter's data operation. Ensures each adapter returns
 * a consistent format to the data layer for further processing (caching, error handling,
 * etc.).</p>
 * <p><strong>NOTE:</strong> This entire object should be serializable (i.e. no functions or complex built-in
 * objects) so the caching layer can retrieve the full Response on subsequent calls.</p>
 */
declare class Response {
    /**
     * <p>The response payload; may be <code>null</code>. Can be modified by setting <code>'responseType</code>'
     * on the {@link DataDefinition} object. See {@link https://xhr.spec.whatwg.org/#the-response-attribute the spec}
     * for more information on the types that can be returned.</p>
     */
    static data: any;
    /**
     * <p>A standard status code the {@link DataLayer#fetch} method will
     * examine to determine how to proceed. For example, a status code of 0 indicates an aborted
     * request and may prompt network diagnostics or a dialog prompting the user to restore their
     * network connection.</p>
     */
    status: number;
    /**
     * <p>A message that will be used to generate an Error message,
     * if [<code>meta.error</code>]{@link MetaData#error} is <code>true</code>.</p>
     */
    statusText: string;
    /**
     * <p>Additional information about the response.</p>
     */
    meta: MetaData;
}

/**
 * <p>Contains the minimum functionality necessary to convert a
 * {@link DataDefinition} object into a {@link Request} and to
 * execute that Request against an {@link Adapter}, returning
 * a {@link Response} with the requested data.</p>
 */
declare class DataLayer {
    /**
     * <p>Converts a {@link Request} into a {@link Response} by running the
     * request through an appropriate {@link Adapter}.</p>
     * @example
     * import xhr from '@paychex/adapter-xhr';
    import tracker from '~/path/to/tracker';
    import proxy from '~/path/to/proxy';
    
    // NOTE: you will probably already have access to
    // a datalayer and not need to create one yourself
    const { fetch, createRequest } = data.createDataLayer(proxy, xhr);
    
    const request = createRequest({
      base: 'my-app',
      path: '/live',
    });
    
    fetch(request)
      .then(response => {
        tracker.event('app is live', {
          status: response.status,
          message: response.statusText,
          moreInfo: response.data,
        });
      })
      .catch(tracker.error);
     * @param request - <p>The Request to pass to an {@link Adapter}
     * and convert into a {@link Response}.</p>
     * @returns <p>Information about the data operation.</p>
     */
    fetch(request: Request): Promise<Response>;
    /**
     * <p>Converts a {@link DataDefinition} object into a {@link Request} object that can be
     * passed to {@link DataLayer#fetch fetch}. The {@link Proxy} passed to
     * {@link module:data.createDataLayer createDataLayer} will be used to fill out the
     * Request using any configured {@link ProxyRule ProxyRules}.</p>
     * <p>Keeping your data definition objects separate from request objects enables us to
     * construct dynamic requests based on ProxyRules set at runtime. This means we can change
     * the endpoints and protocols using configuration data rather than code.</p>
     * @example
     * // save modified user data using a PATCH
    
    import { createPatch } from 'some/json-patch/library';
    import { createRequest, fetch } from '~/path/to/datalayer';
    
    const operation = {
      base: 'my-app',
      method: 'PATCH',
      path: '/users/:id'
    };
    
    export async function saveUserData(id, modified, original) {
      const params = { id };
      const body = createPatch(original, modified);
      const request = createRequest(operation, params, body);
      const response = await fetch(request).catch(errors.rethrow(errors.fatal(params)));
      return response.data;
    }
     * @example
     * // load data using the current domain and protocol
    
    import { createRequest, fetch } from '~/path/to/datalayer';
    
    const operation = {
      method: 'GET',
      // by not specifying a `base` value the resulting
      // URL will be relative to the current domain and
      // protocol
      path: '/users/:id'
    };
    
    export async function loadUserData(id) {
      const params = { id };
      const request = createRequest(operation, params);
      const response = await fetch(request).catch(errors.rethrow(params));
      return response.data;
    }
     * @param definition - <p>The DataDefinition to convert into a Request using ProxyRules.</p>
     * @param [params = {}] - <p>Optional parameters used to tokenize the URL or to append to the QueryString.</p>
     * @param [body = null] - <p>Optional data to send with the request.</p>
     * @returns <p>A fully formed Request that can be passed to {@link DataLayer#fetch fetch}.</p>
     */
    createRequest(definition: DataDefinition, params?: {
        [key: string]: any;
    }, body?: any): Request;
    /**
     * <p>Registers an {@link Adapter} with the given name. The {@link DataLayer#fetch fetch}
     * method will match the <code>'adapter'</code> value on the {@link Request} it is given with
     * any Adapters registered here.</p>
     * <p><strong>NOTE:</strong> The default adapter for a Request is the adapter used to construct the
     * data layer, which is always registered as <code>'default'</code>.</p>
     * @example
     * // create a custom Adapter that uses the
    // popular Axios library to make data calls
    // https://github.com/axios/axios
    
    import axios from 'axios';
    import { cloneDeep } from 'lodash-es';
    import { setAdapter, createRequest, fetch } from '~/path/to/datalayer';
    
    const http = axios.create({
      withCredentials: true,
      headers: { accept: 'application/json' }
    });
    
    // construct and return a Response object
    // using the values provided by Axios
    function createResponseFromSuccess(axiosResponse) { ... }
    function createResponseFromFailure(axiosError) { ... }
    
    setAdapter('axios', function useAxios(request) {
      // convert the Request into a config
      // that Axios understands -- e.g. axios
      // uses request.data instead of request.body
      const config = cloneDeep(request);
      config.data = request.body;
      return axios(config)
        // always resolve with a Response,
        // regardless of any errors:
        .then(createResponseFromSuccess)
        .catch(createResponseFromFailure);
    });
    
    // usage:
    const definition = {
      base: 'my-app',
      path: '/path/to/data',
      adapter: 'axios', // <-- use our custom adapter
      method: 'POST',
    };
    
    export async function saveData(data) {
      // our code looks the same regardless of which adapter
      // is used to make the data call; the adapter could even
      // be changed dynamically by the rules in our Proxy
      const request = createRequest(definition, null, data);
      const response = await fetch(request);
      return response.meta.headers['e-tag'];
    }
     * @param name - <p>The name of the Adapter to register.</p>
     * @param adapter - <p>The Adapter to register.</p>
     */
    setAdapter(name: string, adapter: Adapter): void;
}

/**
 * <p>Represents a single rule in a proxy instance. A Proxy rule looks like a normal {@link Request}
 * object with an additional property <code>match</code> that specifies the property values on a Request
 * instance that must match in order for the rule to be applied.</p>
 */
declare class ProxyRule extends Request {
    /**
     * <p>'http', 'https', 'file', etc.</p>
     */
    protocol: string;
    /**
     * <p>'myapps.myserver.com', 'localhost', etc.</p>
     */
    host: string;
    /**
     * <p>80, 8080, etc.</p>
     */
    port: number;
    /**
     * <p>One or more keys in a request object whose values must match
     * the given regular expression patterns.E.g.: <code>{base: 'cdn'}</code> or<code>{base: 'myapp', path: 'load.+'}</code></p>
     */
    match: {
        [key: string]: string;
    };
}

/**
 * <p>The Proxy provides an intercept layer based on build- and run-time configurations to enable
 * easier local development, impersonation, dynamic endpoints, static data redirects, and user-
 * and environment-specific versioning.</p>
 * <pre class="prettyprint source lang-js"><code>const proxy = data.createProxy();
 * </code></pre>
 */
declare class DataProxy {
    /**
     * <p>Uses the current proxy rules to construct a URL based on the given arguments.</p>
     * @example
     * const url = proxy.url('cdn', 'images', 'logo.svg');
     * @example
     * const url = proxy.url({
      base: 'cdn',
      protocol: 'https',
      path: '/some/path'
    });
     * @example
     * import { proxy } from '~/path/to/data';
    
    proxy.use({
      port: 8118,
      protocol: 'https',
      host: 'images.myserver.com',
      match: {
        base: 'images'
      }
    });
    
    ```html
      <img src="{{ getImageURL('avatars', 'e13d429a') }}" alt="" />
      <!-- https://images.myserver.com:8118/avatars/e13d429a -->
    ```
    export function getImageURL(bucket, id) {
      return proxy.url('images', bucket, id);
    }
     * @param base - <p>Either a Request instance, or a base value, e.g. 'cdn' or 'myapp'.</p>
     * @param [paths] - <p>If a <code>string</code> base value is provided, one or more URL paths to combine into the final URL.</p>
     * @returns <p>A URL with the appropriate protocol, host, port, and paths
     * given the currently configured proxy rules.</p>
     */
    url(base: string | Request, ...paths?: string[]): string;
    /**
     * <p>Add {@link ProxyRule rules} to the proxy instance. The order rules are added determines
     * the order they are applied.</p>
     * @example
     * import { proxy } from '~/path/to/data';
    
    // any {@link Request Requests} with base == 'files'
    // will be routed to https://files.myserver.com:8118
    proxy.use({
      port: 8118,
      protocol: 'https',
      host: 'files.myserver.com',
      match: {
        base: 'files'
      }
    });
     * @param rules - <p>The rules to use to configure this proxy instance.</p>
     */
    use(...rules: ProxyRule[]): void;
    /**
     * <p>Modifies the input Request object according to any matching Proxy rules.
     * Rules are applied in the order they were added to the Proxy, so later rules will
     * always override earlier rules.</p>
     * <p><strong>NOTE:</strong> You will not typically call this method directly. Instead, the
     * DataLayer.createRequest method will invoke this function on your behalf. See
     * that method for details.</p>
     * @example
     * import { proxy, createRequest, fetch } from '~/path/to/data';
    import switches from '../config/features.mjson';
    
    if (switches.useV2endpoint) {
      // switch from Remote to REST endpoint
      proxy.use({
        path: '/v2/endpoint',
        match: {
          base: 'my-project',
          path: '/endpoint',
        }
      });
    }
    
    export async function getEndpointData() {
      // createRequest modifies the Request
      // object generated by the DDO using
      // Proxy rules, including the one above
      const request = createRequest({
        base: 'my-project',
        path: '/endpoint',
      });
      const response = await fetch(request)
        .catch(errors.rethrow(errors.fatal()));
      return response.data;
    }
     * @param request - <p>The request object whose key/value pairs will be used
     * to determine which proxy rules should be used to determine the version.</p>
     * @returns <p>The input Request object, with properties modified according
     * to the matching Proxy rules.</p>
     */
    apply(request: Request): Request;
}

/**
 * <p>Map of strings representing either {@link Request} headers
 * or {@link Response} {@link MetaData meta} headers. The header name is the key
 * and the header data is the value. If you pass an array of strings as the value,
 * the strings will be combined and separated by commas.</p>
 * @example
 * import { fetch, createRequest } from '~/path/to/datalayer';

async function loadData() {
  const request = createRequest({
    base: 'my-app',
    path: '/path/to/data',
    headers: {
      'content-type': 'application/json',
      'accept': [
        'application/json',
        'text/plain',
        '*∕*'
      ]
    }
  });
  const response = await fetch(request);
  console.log(response.meta.headers);
  return response.data;
}
 */
declare type HeadersMap = {
    [key: string]: string | string[];
};

/**
 * @example
 * import { isString } from 'lodash-es';
import { fetch, createRequest } from '~/path/to/datalayer';

const operation = {
  method: 'GET',
  base: 'my-app',
  path: '/some/data',
};

const transformer = {
  response(data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  }
};

const attempt = data.utils.withTransform(fetch, transformer);

export async function getJSONData() {
  const request = createRequest(operation);
  const response = await attempt(request);
  return response.data;
}
 */
declare class Transformer {
    /**
     * <p>Enables developers to modify the data of a request prior to sending. The
     * current body data and headers map will be passed to this method, and the return
     * value will be used as the new request body data. You can also mutate the headers
     * map (e.g. by adding or deleting values) prior to the request being sent.</p>
     * @param data - <p>The payload passed to {@link DataLayer#createRequest}. Whatever
     * you return from this function will be used as the new request payload.</p>
     * @param headers - <p>A key-value collection of header names
     * to header values. You can modify this object directly (e.g. by adding or
     * deleting values) prior to the request being sent.</p>
     * @returns <p>The new body to send with the request.</p>
     */
    request(data: any, headers: HeadersMap): any | Promise;
    /**
     * <p>Enables developers to modify the data of a response before it is returned
     * to callers.</p>
     * @param data - <p>The response payload returned from the server. Whatever value
     * you return from this function will replace {@link Response}.data.</p>
     * @returns <p>The data to return to callers.</p>
     */
    response(data: any): any | Promise;
}

/**
 * <p>Provides optional overrides for XSRF cookie and header names. Can be passed to
 * {@link module:data/utils.withXSRF withXSRF} when wrapping a fetch operation.</p>
 * @example
 * import { fetch } from '~/path/to/datalayer';

export const safeFetch = data.utils.withXSRF(fetch, {
  cookie: 'XSRF-MY-APP',
  header: 'X-XSRF-MY-APP',
  hosts: ['*.my-app.com']
});
 */
declare class XSRFOptions {
    /**
     * <p>The name of the cookie sent by the server
     * that has the user's XSRF token value.</p>
     */
    cookie: string;
    /**
     * <p>The name of the request header to set. The server should ensure this value matches the user's expected XSRF token.</p>
     */
    header: string;
    /**
     * <p>A whitelist of patterns used to determine which host
     * names the XSRF token will be sent to even when making a cross-origin request. For
     * example, a site running on <code>www.server.com</code> would not normally include the XSRF
     * token header on any requests to the <code>api.server.com</code> subdomain since the hostnames
     * don't exactly match. However, if you added <code>api.server.com</code> or <code>*.server.com</code> to
     * the hosts array (and if the port and protocol both still matched the origin's port
     * and protocol), the header would be sent.</p>
     */
    hosts: string[];
}

/**
 * <p>Provides publish/subscribe functionality.</p>
 * @example
 * import { tracker } from '~/tracking';

const bus = events.bus();

bus.on('event', function handler(arg1, arg2) {
  console.log(`received ${arg1} and ${arg2}`);
  return arg1 + arg2;
});

// subscribers can be asynchronous
bus.on('event', async function handler(arg1, arg2) {
  const result = await someAsyncMethod(arg1);
  await someOtherAsyncMethod(result, arg2);
  return 'abc';
});

// fire and forget
bus.fire('event', 1, 2);

// catch any rejected promises returned by
// handlers (or errors thrown by handlers)
await bus.fire('event', 1, 2).catch(tracker.error);

// examine the return values of handlers
const results = await bus.fire('event', 1, 2);
console.log(results); // [3, 'abc']
 */
declare class EventBus {
    /**
     * <p>Notifies any subscribers registered through {@link EventBus#on on}
     * or {@link EventBus#on one} that the specified event has occurred. If
     * any subscribers throw an exception then the {@link EventBus#fire fire}
     * promise will be rejected, but any other subscribers will continue to be
     * notified of the initial event.</p>
     * @example
     * import { tracker } from '~/tracking';
    
    const bus = events.bus();
    
    bus.on('event', async function handler(value1, value2) {
      return await someAsyncMethod(value1, value2);
    });
    
    bus.fire('event', arg1, arg2);
    const results = await bus.fire('event', arg1, arg2);
    await bus.fire('event', arg1, arg2).catch(tracker.error);
     * @example
     * const bus = events.bus();
    
    async function dirtyCheck(container, path) {
      if (container.dirty)
        throw errors.error('save your changes');
    }
    
    async function navigate(container, path) {
      // load new route
    }
    
    bus.on('navigate', functions.sequence(dirtyCheck, navigate));
    
    export async function navigate(container, path) {
      await bus.fire('navigate', container, path);
    }
    
    // caller
    function linkHandler(e) {
      e.preventDefault();
      e.stopPropagation();
      const route = e.target.getAttribute('route');
      const container = e.target.getAttribute('container');
      navigate(container, route).then(
        () => console.info('navigation complete'),
        (err) => console.log('navigation failed', err);
      );
    }
     * @example
     * const bus1 = events.bus(null, functions.sequence);
    const bus2 = events.bus(null, functions.parallel); // the default behavior
    
    function handler1() {
      return 1;
    }
    
    function handler2() {
      return 2;
    }
    
    bus1.on('event', handler1);
    bus1.on('event', handler2);
    
    // sequence bus returns last subscriber's return value
    await bus1.fire('event'); // 2
    
    bus2.on('event', handler1);
    bus2.on('event', handler2);
    
    // parallel bus returns array
    await bus2.fire('event'); // [1, 2]
     * @param event - <p>The name of the event to fire.</p>
     * @param [args] - <p>Optional arguments to pass to subscribers.</p>
     * @returns <p>Returns <code>false</code> if the bus is stopped. Otherwise,
     * returns a Promise that will resolve with an array of values returned by
     * event subscribers, or reject with the first Promise rejection or thrown error.</p>
     */
    fire(event: string, ...args?: any[]): boolean | Promise;
    /**
     * <p>Registers a subscriber for the given event. The subscriber will be invoked
     * in the context used to create the {@link EventBus} and passed any arguments
     * provided to the {@link EventBus#fire fire method}.</p>
     * @example
     * import { createSomething } from '../someFactory';
    
    const obj = createSomething();
    const bus = events.bus(obj); // subscriber context
    
    bus.one('initialize', function init() {
      // this only runs the first time
      // the 'initialize' event is fired;
    });
    
    export const off = bus.on('some-event', function handler(arg) {
      console.log(this === obj); // true
    });
     * @param event - <p>The name of the event to listen for.</p>
     * @param subscriber - <p>The subscriber to invoke when the event is fired.</p>
     * @returns <p>Method to invoke to remove the subscriber.</p>
     */
    on(event: string, subscriber: (...params: any[]) => any): (...params: any[]) => any;
    /**
     * <p>Similar to {@link EventBus#on on}, except the subscriber
     * will be removed as soon as it is invoked.</p>
     * @param event - <p>The name of the event to listen for.</p>
     * @param subscriber - <p>The subscriber to invoke when the event is fired.</p>
     * @returns <p>Method to invoke to remove the subscriber.</p>
     */
    one(event: string, subscriber: (...params: any[]) => any): (...params: any[]) => any;
    /**
     * <p>Resumes notifying subscribers after {@link EventBus#stop stop} was called. Any
     * events fired before resuming are dropped entirely.</p>
     * @example
     * const bus = events.bus();
    
    bus.on('add', function handler(value1, value2) {
      console.log(value1 + value2);
    });
    
    bus.fire('add', 1, 2); // 3
    bus.stop();
    bus.fire('add', 1, 2); // does not invoke subscriber
    bus.resume();
    bus.fire('add', 1, 2); // 3
     */
    resume(): void;
    /**
     * <p>Stops notifying subscribers of fired events until {@link EventBus#resume resume} is called.</p>
     * @example
     * const bus = events.bus();
    
    bus.on('add', function handler(value1, value2) {
      console.log(value1 + value2);
    });
    
    bus.fire('add', 1, 2); // 3
    bus.stop();
    bus.fire('add', 1, 2); // does not invoke subscriber
     */
    stop(): void;
}

declare class InvocationData {
    /**
     * <p>The invocation context.</p>
     */
    0: any;
}

/**
 * @example
 * import { loadClientData } from '../data';
import { createRequest, fetch } from '~/path/to/data';

export async function createClientDataModel(client) {
  const request = createRequest(loadClientData, { client });
  const response = await fetch(request);
  return models.collection(...response.data); // spread values
}
 */
declare class ModelCollection extends EventBus {
    /**
     * <p>Adds items to the ModelCollection.</p>
     * @example
     * const list = models.collection(1, 2, 3);
    list.add(4, 5, 6);
    console.log(list.items()); // [1, 2, 3, 4, 5, 6]
     * @param [items] - <p>The items to add to the ModelCollection.</p>
     */
    add(...items?: any[]): void;
    /**
     * <p>Removes items from the ModelCollection.</p>
     * @example
     * const list = models.collection(1, 2, 3);
    list.add(4, 5, 6);
    list.remove(5, 1);
    console.log(list.items()); // [2, 3, 4, 6]
     * @param [items] - <p>The items to remove from the ModelCollection.</p>
     */
    remove(...items?: any[]): void;
    /**
     * <p>Removes all items from the ModelCollection.</p>
     * @example
     * const list = models.collection(1, 2, 3);
    list.add(4, 5, 6);
    console.log(list.items()); // [1, 2, 3, 4, 5, 6]
    list.clear();
    console.log(list.items()); // []
     */
    clear(): void;
    /**
     * <p>The set of items in the ModelCollection.</p>
     * <p><strong>NOTE:</strong> Returns a shallow copy of the underlying collection. That
     * means the array returned can be mutated without affecting the real
     * ModelCollection, but all the items in the array are the same by reference,
     * so mutating an object in the collection will also mutate the object
     * stored in the ModelCollection.</p>
     * @example
     * let list = models.collection(1, 2, 3);
    list.add(4, 5, 6);
    console.log(list.items()); // [1, 2, 3, 4, 5, 6]
    list = models.utils.withOrdering(list, [], ['desc']);
    console.log(list.items()); // [6, 5, 4, 3, 2, 1]
     */
    items(): void;
}

/**
 * <p>Adds &quot;active item&quot; tracking and navigation to an existing {@link ModelCollection} instance.</p>
 * <p><strong>Note on Grouping</strong>: If you want to navigate through a grouped list, you may want
 * to ensure an order has been applied beforehand. Use {@link module:models.withOrdering withOrdering}
 * and ensure your array of iteratees starts with your group selector. This ensures that
 * navigating through the list correctly moves between groups.</p>
 */
declare class ActiveModelCollection extends ModelCollection {
    /**
     * <p>Gets or sets the current active item in the list.
     * <strong>NOTE:</strong> Only currently available items can be activated. For example, if you
     * are using {@link module:models.withFiltering withFiltering} then items which
     * have been filtered out can not be activated.</p>
     * @example
     * const list = models.utils.withActive(models.collection(1, 2, 3));
    
    console.log(list.active());  // 1
    console.log(list.active(2)); // 2
    console.log(list.active(5)); // 2
     * @param [item] - <p>The item to activate. Must be present in the current list.
     * To retrieve the currently active item, do not pass any arguments.</p>
     * @returns <p>The currently active item.</p>
     */
    active(item?: any): any;
    /**
     * @example
     * const list = models.utils.withActive(models.collection(1, 2, 3));
    list.active(2);
    list.next(); // 3
    list.next(); // null (at end of list)
    list.next(true); // 1 (wraps to start)
     * @param [wrap = false] - <p>Whether to wrap back to the start of the
     * list if the currently active item is the last item.</p>
     * @returns <p>The newly activated item, or <code>null</code> if at end of list
     * and <code>wrap</code> is not truthy.</p>
     */
    next(wrap?: boolean): any;
    /**
     * @example
     * const list = models.utils.withActive(models.collection(1, 2, 3));
    list.active(2);
    list.prev(); // 1
    list.prev(); // null (at start of list)
    list.prev(true); // 3 (wraps to end)
     * @param [wrap = false] - <p>Whether to wrap back to the end of the
     * list if the currently active item is the first item.</p>
     * @returns <p>The newly activated item, or <code>null</code> if at start of list
     * and <code>wrap</code> is not truthy.</p>
     */
    prev(wrap?: boolean): any;
    /**
     * <p>Returns <code>true</code> if the currently active item is the last item in the list.</p>
     * @example
     * const list = models.utils.withActive(models.collection(1, 2, 3));
    
    list.active(); // 1
    list.atStart; // true
    list.atEnd; // false
    
    list.next(); // 2
    list.atStart; // false
    list.atEnd; // false
    
    list.next(); // 3
    list.atStart; // false
    list.atEnd; // true
     */
    readonly atEnd: boolean;
    /**
     * <p>Returns <code>true</code> if the currently active item is the first item in the list.</p>
     * @example
     * const list = models.utils.withActive(models.collection(1, 2, 3));
    
    list.active(); // 1
    list.atStart; // true
    list.atEnd; // false
    
    list.next(); // 2
    list.atStart; // false
    list.atEnd; // false
    
    list.next(); // 3
    list.atStart; // false
    list.atEnd; // true
     */
    readonly atStart: boolean;
}

/**
 * <p>Adds ordering functionality to an existing {@link ModelCollection} instance.</p>
 */
declare class OrderedModelCollection extends ModelCollection {
    /**
     * <p>Orders the internal ModelCollection collection using the information provided.</p>
     * @example
     * const list = models.collection(1, 2, 3, 4, 5, 6);
    const ordered = models.utils.withOrdering(list, [], ['desc']);
    
    ordered.items(); // [6, 5, 4, 3, 2, 1]
    
    ordered.orderBy(); // identity ascending
    ordered.items(); // [1, 2, 3, 4, 5, 6];
    
    ordered.orderBy(num => num % 3);
    ordered.items(); // [3, 6, 1, 4, 2, 5];
     * @example
     * import { loadNotifications } from '../data/notifications';
    
    export async function getNotificationsList() {
      const notifications = await loadNotifications();
      const list = models.utils.withOrdering(models.collection(notifications));
      list.orderBy(['priority', 'date', 'subject'], ['desc', 'desc', 'asc']);
      return list;
    }
     * @param [iteratees = [identity]] - <p>Optional iteratees to use as selector functions.</p>
     * @param [orders = ['asc']] - <p>Optional sort orders to use for each selector value.</p>
     */
    orderBy(iteratees?: iteratee[], orders?: ('asc' | 'desc')[]): void;
}

/**
 * <p>Adds filtering functionality to an existing {@link ModelCollection} instance.</p>
 */
declare class FilteredModelCollection extends ModelCollection {
    /**
     * <p>Filters the underlying items in the ModelCollection collection.</p>
     * @example
     * import { getNotificationsList } from '../models/notifications';
    
    export async function getUnreadNotifications() {
      // wrap an existing ModelCollection
      const list = await getNotificationsList();
      return models.utils.withFiltering(list, ['unread']);
    }
     * @example
     * const isOdd = num => num % 2;
    const list = models.withFiltering(models.collection(), isOdd);
    
    list.add(1, 2, 3, 4, 5);
    list.items(); // [1, 3, 5]
    
    list.filterBy(); // reset filtering
    list.items(); // [1, 2, 3, 4, 5]
     * @param [filterer = identity] - <p>The filter logic to apply.</p>
     */
    filterBy(filterer?: ModelCollectionPredicate): void;
}

/**
 * <p>Adds grouping functionality to an existing {@link ModelCollection} instance.</p>
 */
declare class GroupedModelCollection extends ModelCollection {
    /**
     * <p>Groups the underlying items in the ModelCollection collection.</p>
     * @example
     * import { getNotificationsList } from '../models/notifications';
    
    export async function groupNotifications() {
      // wrap an existing ModelCollection
      const list = await getNotificationsList();
      return models.utils.withGrouping(list, ['status']);
    }
     * @example
     * import { cond, conforms, constant, stubTrue } from 'lodash-es';
    import { getClientList } from '../models/client';
    
    const lessThan = (max) => (num) => num < max;
    
    // function that buckets by employeeCount
    const employeeBuckets = cond([
      [ conforms({ employeeCount: lessThan(10) }), constant('small')  ],
      [ conforms({ employeeCount: lessThan(50) }), constant('medium') ],
      [ stubTrue,                                  constant('large')  ]
    ]);
    
    export async function getBucketedClientList() {
      const list = await getClientList();
      return models.utils.withGrouping(list, employeeBuckets);
    }
    
    // CONSUMER:
    const clients = await getBucketedClientList();
    clients.groups(); // { small: [...], medium: [...], large: [...] }
    
    clients.groupBy(['region']);
    clients.groups(); // { 'east': [...], 'north': [...], 'south': [...] }
     * @param [grouper = identity] - <p>The grouping logic to apply.</p>
     */
    groupBy(grouper?: (...params: any[]) => any): void;
    /**
     * <p>Returns the groups from the underlying collection. Groups are returned
     * as an object whose keys are the group names; each value is an array of
     * the objects belonging to that group.</p>
     * @example
     * import { getNotificationsList } from '../models/notifications';
    
    export async function groupNotifications() {
      // wrap an existing ModelCollection
      const list = await getNotificationsList();
      return models.utils.withGrouping(list, ['status']);
    }
    
    // CONSUMER:
    const notifications = groupNotifications();
    notifications.groups(); // { 'read': [...], 'unread': [...] }
     * @returns <p>The grouped objects.</p>
     */
    groups(): string[];
}

/**
 * <p>Tracks which items within the wrapped {@link ModelCollection} instance
 * are selected at any given time. <strong>NOTE:</strong> Items which are not
 * available through the wrapped ModelCollection can not be selected.</p>
 */
declare class SelectionModelCollection extends ModelCollection {
    /**
     * <p>Gets or sets the currently selected items within the list.
     * <strong>NOTE:</strong> Only currently available items can be selected. For example, if you
     * are using {@link module:models.withFiltering withFiltering} then items which
     * have been filtered out can not be selected.</p>
     * @example
     * const list = models.utils.withSelection(models.collection(1, 2, 3));
    
    list.selected();  // []
    list.selected(2); // [2]
    list.selected(2, 3); // [2, 3]
     * @param [items] - <p>The items to select. Must be present in the current list.
     * To retrieve the currently selected items, do not pass any arguments.</p>
     * @returns <p>The currently selected items.</p>
     */
    selected(...items?: any[]): any[];
    /**
     * <p>Select all, none, or some of the ModelCollection items, depending on which
     * are currently selected and which are passed as arguments.</p>
     * <p>When called with no arguments, the behavior of toggle changes depending
     * on whether <em>none</em>, <em>some</em>, or <em>all</em> items are currently selected:</p>
     * <table>
     * <thead>
     * <tr>
     * <th style="text-align:left">call</th>
     * <th style="text-align:left">condition</th>
     * <th style="text-align:left">result</th>
     * </tr>
     * </thead>
     * <tbody>
     * <tr>
     * <td style="text-align:left"><code>toggle()</code></td>
     * <td style="text-align:left">selected() == []</td>
     * <td style="text-align:left">select all items</td>
     * </tr>
     * <tr>
     * <td style="text-align:left"><code>toggle()</code></td>
     * <td style="text-align:left">selected() != items()</td>
     * <td style="text-align:left">select all items</td>
     * </tr>
     * <tr>
     * <td style="text-align:left"><code>toggle()</code></td>
     * <td style="text-align:left">selected() == items()</td>
     * <td style="text-align:left">select no items</td>
     * </tr>
     * </tbody>
     * </table>
     * <p>When passed items, only those items' selection status will be toggled.
     * None of the previously selected items' selection status will change:</p>
     * <pre class="prettyprint source lang-javascript"><code>list.selected(); // [1, 2, 3]
     * list.toggle(2);  // [1, 3]
     * list.toggle(2);  // [1, 2, 3]
     * </code></pre>
     * @example
     * const list = models.utils.withSelection(models.collection(1, 2, 3));
    
    list.selected(); // []
    list.toggle(); // [1, 2, 3]
    list.toggle(2); // [1, 3]
    list.toggle(); // [1, 2, 3]
    list.toggle(); // []
    list.toggle(1, 2); // [1, 2]
     * @param [items] - <p>The items to select or deselect. Must be present
     * in the current list. To select or deselect all items, pass no arguments.</p>
     * @returns <p>The currently selected items.</p>
     */
    toggle(...items?: any[]): any[];
}

/**
 * <p>Provides paging functionality to the wrapped {@link ModelCollection} instance.</p>
 * <p><strong>Order of Operations:</strong> Typically, you should call <code>withPaging</code> <em>after</em>
 * applying any other decorators. This ensures the underling <code>items</code> collection
 * represents the correct set of items when calculating page counts.</p>
 * <p><strong>Note on Active Items:</strong> If you apply paging to a {@link ActiveModelCollection ActiveModelCollection}
 * created using the {@link module:models.withActive withActive} decorator, the
 * current page index will update automatically as you change the active item.</p>
 */
declare class PagedModelCollection extends ModelCollection {
    /**
     * <p>Gets or sets the current page size (the number of items that
     * should be visible on each page.)</p>
     * @example
     * const list = models.utils.withPaging(models.collection());
    
    list.pageSize(); // 50 (default page size)
    
    list.pageSize(5); // 5
    list.add(1, 2, 3, 4, 5, 6, 7, 8);
    list.items(); // [1, 2, 3, 4, 5]
    
    list.pageSize(3); // 3
    list.items(); // [1, 2, 3]
     * @param [size] - <p>The number of items to show on each page.
     * Pass no arguments to retrieve the current page size.</p>
     * @returns <p>The current page size.</p>
     */
    pageSize(size?: number): number;
    /**
     * <p>Moves to the next page of items. Does nothing if called on the last page.</p>
     * @example
     * const list = models.utils.withPaging(models.collection(1, 2, 3, 4, 5));
    
    list.pageSize(2);
    list.pageIndex(); // 0
    
    list.nextPage();  // 1
    list.nextPage();  // 2
    list.nextPage();  // 2 (stops on last page)
     * @returns <p>The new page index.</p>
     */
    nextPage(): number;
    /**
     * <p>Moves to the previous page of items. Does nothing if called on the first page.</p>
     * @example
     * const list = models.utils.withPaging(models.collection(1, 2, 3, 4, 5));
    
    list.pageSize(2);
    list.pageIndex(2); // start on last page
    
    list.prevPage();  // 1
    list.prevPage();  // 0
    list.prevPage();  // 0 (stops on first page)
     * @returns <p>The new page index.</p>
     */
    prevPage(): number;
    /**
     * <p>Gets or sets the current page index (base 0). If outside the available bounds,
     * the given index will be clamped between 0 and {@link PagedModelCollection#pageCount pageCount} - 1.</p>
     * @example
     * const list = models.utils.withPaging(models.collection(1, 2, 3, 4, 5));
    
    list.pageSize(2);
    list.pageIndex(); // 0
    
    list.nextPage();
    list.pageIndex(); // 1
    
    list.pageIndex(0); // 0
    list.pageIndex(15); // 2
    list.pageIndex(-1); // 0
     * @param index - <p>The new page index.</p>
     * @returns <p>The new page index.</p>
     */
    pageIndex(index: number): number;
    /**
     * <p>Returns the number of pages based on the number of {@link ModelCollection#items items}
     * and the current {@link PagedModelCollection#pageSize pageSize}.</p>
     * @example
     * const list = models.utils.withPaging(models.collection(1, 2, 3, 4));
    
    list.pageSize(10);
    console.log(list.pageCount); // 1
    
    list.pageSize(2);
    console.log(list.pageCount); // 2
    
    list.add(5);
    console.log(list.pageCount); // 3
     * @example
     * // paging over a filtered list
    
    // order matters! filter first, then page:
    const list = models.utils.withPaging(
      models.utils.withFiltering(
        models.collection()));
    
    list.pageSize(2);
    list.add(1, 2, 3, 4, 5);
    console.log(list.pageCount); // 3
    
    const isOdd = num => num % 2;
    list.filterBy(isOdd);
    console.log(list.pageCount); // 2
     */
    readonly pageCount: number;
}

/**
 * <p>Adds a uniqueness constraint to an existing {@link ModelCollection}'s items.</p>
 */
declare class UniqueModelCollection extends ModelCollection {
    /**
     * <p>Applies a uniqueness constraint to the wrapped {@link ModelCollection} items.</p>
     * @example
     * const list = models.utils.withUnique(models.collection());
    
    list.add(1, 2, 3);
    list.items(); // [1, 2, 3]
    
    list.add(1, 2, 2.5, 3, 4);
    list.items(); // [1, 2, 2.5, 3, 4]
    
    list.uniqueBy(Math.floor);
    list.items(); // [1, 2, 3, 4]
     * @param [iteratee = identity] - <p>Optional iteratee to use as a selector function.</p>
     */
    uniqueBy(iteratee?: iteratee): void;
}

/**
 * <p>Adds methods to update a {@link ModelCollection}'s items based on a more current
 * collection of items.</p>
 */
declare class UpdatingModelCollection extends UniqueModelCollection {
    /**
     * <p>Adds or updates items in the underlying collection. Does <em>not</em> remove any
     * existing items.</p>
     * @example
     * // our selector can use lodash iteratee
    const list = models.utils.withUpdating(models.collection, 'id');
    
    list.add({ id: 123, name: 'Alice' });
    list.add({ id: 456, name: 'Bob' });
    
    // update the first entry, keeping the second entry
    list.upsert({ id: 123, name: 'Alicia' });
     * @param [items] - <p>The items to add or update in the underlying collection.</p>
     */
    upsert(...items?: any[]): void;
    /**
     * <p>Adds, updates, <em>and</em> removes items in the underlying collection based on
     * the incoming items.</p>
     * @example
     * // our selector can use lodash iteratee
    const list = models.utils.withUpdating(models.collection, 'id');
    let users = [
      { id: 123, name: 'Alice' },
      { id: 456, name: 'Bob' }
    ];
    
    list.add(...users);
    
    // update the first entry and REMOVE the second entry
    users = [ { id: 123, name: 'Alicia' } ];
    list.merge(...users);
     * @param [items] - <p>The items to add or update in the underlying collection.
     * Any items in the existing collection that are <em>not</em> in the incoming collection
     * will be removed.</p>
     */
    merge(...items?: any[]): void;
}

/**
 * <p>Provides normal Promise functionality plus the ability to update,
 * cancel, or stop a running {@link module:process.process process}.</p>
 * <p><strong>NOTE:</strong> The <code>update</code> method is primarily used to change conditions
 * for a running process.</p>
 * @example
 * import { start } from '../path/to/machine';
import { dispatch } from '../path/to/workflow';

const execution = start(); // default start state, no conditions
// OR:
// const execution = dispatch(); // no args for workflow

// update the running conditions:
execution.update({ condition: 'value' });

// cancel the state machine early (rejects the promise):
execution.cancel();
execution.cancel({ error: 'property' });

// stop the machine early (resolves the promise):
execution.stop();

// of course, we can also chain off the execution promise:
execution.then(console.log, console.error);
 */
declare class ExecutionPromise extends ProcessRunner {
}

/**
 * @example
 * // automatic transition when first action ends
const transition = ['from step', 'to step'];
 * @example
 * // transition if the machine's current conditions match this set
const transition = ['from step', 'to step', { condition: 'value', another: 'condition' }];
 * @example
 * // transition if the machine's current conditions has a truthy value for 'property'
const transition =  ['from step', 'to step', 'property'];
 * @example
 * // transition if the machine's current conditions have a 'property' key with a 'value' value
const transition =  ['from step', 'to step', ['property', 'value']];
 * @example
 * // transition if the function returns true
const transition =  ['from step', 'to step', function(conditions) {
  switch(conditions.key) {
    case 'value 1': return true;
    case 'value 2': return conditions.another > 12;
    default: return false;
  }
}]
 * @example
 * // transition if the current condition values match the corresponding predicates
import { conforms, isNil, isNumber } from 'lodash-es';

const transition = ['from step', 'to step', conforms({
  'error': isNil,
  'value': isNumber,
  'property': (value) => value > 0 && value < 100
})];
 */
declare class ProcessTransition extends Array {
    /**
     * <p>The step that just completed.</p>
     */
    0: string;
}

/**
 * <p>An array of {@link ProcessTransition} array instances.</p>
 * @example
 * import { conforms, isNil, isNumber } from 'lodash-es';

const transitions = [

  // automatic transition when first action ends
  ['from step', 'to step'],

  // transition if the machine's current conditions match this set
  ['from step', 'to step', { condition: 'value', another: 'condition' }],

  // transition if the machine's current conditions has a truthy value for 'property'
  ['from step', 'to step', 'property'],

  // transition if the machine's current conditions have a 'property' key with a 'value' value
  ['from step', 'to step', ['property', 'value']],

  // transition if the function returns true
  ['from step', 'to step', function(conditions) {
    switch(conditions.key) {
      case 'value 1': return true;
      case 'value 2': return conditions.another > 12;
      default: return false;
    }
  }],

  // transition if the current condition values match the corresponding predicates
  ['from step', 'to step', conforms({
    'error': isNil,
    'value': isNumber,
    'property': (value) => value > 0 && value < 100
  })]

];
 */
declare class ProcessTransitions extends Array {
}

declare class ProcessRunner extends Promise {
    /**
     * <p>Invoked to stop the running {@link module:process.process process}, immediately rejecting the promise. No further actions will be run.</p>
     * @param [data = {}] - <p>Optional data to merge into the Error the promise will be rejected with.</p>
     */
    cancel(data?: any): void;
    /**
     * <p>Invoked to stop the running {@link module:process.process process}, immediately resolving the promise. No further actions will be run.</p>
     */
    stop(): void;
    /**
     * <p>Invoked to update the set of conditions used within the running {@link module:process.process process}.</p>
     * <p><strong>NOTE:</strong> This method updates the conditions used by the {@link ProcessLogic}
     * returned by {@link module:process.dependencies dependencies}.</p>
     * @param [conditions = {}] - <p>The conditions to merge into the process' internal set of conditions.</p>
     */
    update(conditions?: {
        [key: string]: any;
    }): void;
}

/**
 * <p>Contains information about the running {@link module:process.process process}.
 * In addition to the members listed here, the object returned by {@link ProcessLogic}'s
 * {@link ProcessLogic#contextFromArgs contextFromArgs} will be mixed in.</p>
 */
declare class ProcessContext extends ProcessRunner {
    /**
     * <p>The arguments passed to {@link ProcessStart}.</p>
     */
    args: any[];
    /**
     * <p>Any values passed to {@link ExecutionUpdate update} or
     * provided as the 2nd argument to the {@link module:process.transitions transitions} {@link ProcessContext}.</p>
     */
    conditions: {
        [key: string]: any;
    };
    /**
     * <p>A key-value map of the values returned by each {@link Action#execute execute} method.</p>
     */
    results: {
        [key: string]: any;
    };
    /**
     * <p>The names of {@link Action actions} that have been started in the current process.</p>
     */
    started: string[];
    /**
     * <p>The names of {@link Action actions} that have run to completion in the current process.</p>
     */
    completed: string[];
}

/**
 * <p>Encapsulates the business logic for a single action within a multi-step asynchronous process.</p>
 */
declare class Action {
    /**
     * <p>The name of the process action. Should be unique within a given process instance.</p>
     */
    name: string;
    /**
     * <p>Runs once per process invocation. Can be used to initialize local variables or set up starting conditions.</p>
     * @example
     * const multiply = process.action('multiply', {
      factor: 2,
      init() {
        // NOTE: args are passed to the
        // process' start function
        const [factor, _] = this.args;
        this.factor = factor || 2;
      },
      execute() {
        const [_, operand] = this.args;
        return operand * this.factor;
      }
    });
     */
    init(this: ProcessContext): any;
    /**
     * <p>Performs the bulk of the action's business logic. The value returned from
     * this method (or the resolved value of the Promise returned by this method)
     * will be assigned to the <code>results</code> map automatically.</p>
     * <p>If you return a Promise, dependent actions will not be run until the Promise
     * has resolved. If the Promise rejects or if the execute method throws an
     * Error, the action's {@link Action#retry retry} method will be run. If
     * that method throws or rejects, the entire process will be aborted.</p>
     * @example
     * import { someAsyncOperation } from '../data';
    
    const loadData = process.action('load', {
      async execute() {
        return await someAsyncOperation(...this.args);
      }
    });
     */
    execute(this: ProcessContext): any;
    /**
     * <p>This method is invoked if the {@link Action#execute execute} method throws
     * or returns a rejected Promise. If this method also throws or rejects (which is
     * the default behavior) then the entire process will be aborted.</p>
     * @example
     * import { someAsyncOperation } from '../data';
    
    const loadData = process.action('load', {
      errorCount: 0,
      init() {
        this.errorCount = 0;
      },
      async execute() {
        return await someAsyncOperation(...this.args);
      },
      retry(err) {
        err.errorCount = ++this.errorCount;
        if (this.errorCount < 3)
          return Promise.resolve(); // try again
        return Promise.reject(); // do not retry
      }
    });
     * @param error - <p>The Error raised by the {@link Action#execute execute} method
     * or returned as the rejection reason of that method's Promise.</p>
     */
    retry(this: ProcessContext, error: Error): any;
    /**
     * <p>This method is invoked if the action ran but the process was aborted.
     * You can use this opportunity to undo any behaviors performed in the
     * {@link Action#execute execute} method.</p>
     * @example
     * import { someAsyncOperation } from '../data';
    
    const loadData = process.action('load', {
      store: stores.localStore(),
      async execute() {
        const result = await someAsyncOperation(...this.args);
        await this.store.set('my data cache', result);
        return result;
      },
      async rollback() {
        await this.store.delete('my data cache');
      }
    });
     */
    rollback(this: ProcessContext): any;
    /**
     * <p>This method runs if <em>any</em> action of the process fails (even if this
     * action was not previous executed). It provides a cross-cutting way
     * to respond to errors caused by other actions.</p>
     * @example
     * import { tracker } from '~/tracking';
    
    const logger = process.action('log process failure', {
      failure(err) {
        tracker.error(err);
      }
    });
     * @param error - <p>The Error that failed the process.</p>
     */
    failure(this: ProcessContext, error: Error): any;
    /**
     * <p>This method runs if and when the entire process resolves. It provides a
     * cross-cutting way to respond to the overall success of a complex process.</p>
     * @example
     * import { tracker } from '~/tracking';
    
    const logger = process.action('log process sucess', {
      success() {
        tracker.event(`${this.process} successful`, this.results);
      }
    });
     */
    success(this: ProcessContext): any;
}

/**
 * <p>An object used by {@link module:process.process process} to determine which
 * {@link Action actions} should be executed and under what circumstances.</p>
 * @example
 * const actions = models.collection(
  process.action('a', () => console.log('running a')),
  process.action('b', () => console.log('running b')),
  process.action('c', () => console.log('running c')),
);

const inParallel = {
  getInitialActions(actions, context) {
    return actions;
  },
  contextFromArgs(args) {
    const value = args.shift();
    return { key: value };
  }
};

export const run = process.create('my process', actions, inParallel);
// USAGE: run('some value');
 */
declare class ProcessLogic {
    /**
     * <p>Returns an array of {@link Action actions} to run. This method is
     * called when {@link ExecutionUpdate update} is invoked (if no actions
     * are currently running) as well as whenever the previous set of actions
     * resolves. Return an empty array if the process should not do anything.</p>
     * @example
     * function getNextActions(actions, context) {
      // restrict parallel actions to a maximum of 5 at once:
      return actions
        .filter(action => !context.started.includes(action.name))
        .slice(0, 5);
    }
     * @param actions - <p>The actions available for the process.</p>
     * @param context - <p>Information about the running process.</p>
     * @returns <p>An array of actions to run.</p>
     */
    getNextActions(actions: Action[], context: ProcessContext): Action[];
    /**
     * <p>Returns an array of {@link Action actions} to run when the process
     * is started. Return an empty array if the process should not do anything.</p>
     * @example
     * // retrieve the action at the index passed
    // to the start method returned by process(...)
    // -- e.g. start(3) uses the 4th action
    function getInitialActions(actions, context) {
      const index = context.args[0] || 0;
      const first = actions[index] || actions[0];
      return [ first ]; // always return an array
    }
     * @param actions - <p>The actions available for the process.</p>
     * @param context - <p>Information about the running process.</p>
     * @returns <p>An array of actions to run.</p>
     */
    getInitialActions(actions: Action[], context: ProcessContext): Action[];
    /**
     * <p>Generates the appropriate context object based on the arguments the user
     * has passed to the {@link ProcessStart} method.</p>
     * @example
     * import { merge } from 'lodash-es';
    
    // use whatever arguments were passed to start() as the context;
    // e.g. start({key: 'value'}, {another: 'value'}) would return a
    // context that combines both those objects
    function contextFromArgs(args) {
      return merge({}, ...args);
    }
     * @param args - <p>The arguments the user passed to the {@link ProcessStart} method.</p>
     * @returns <p>An object that will be mixed into the running process's context
     * and passed to any {@link Action} methods as <code>this</code>.</p>
     */
    contextFromArgs(args: any[]): any;
}

/**
 * <p>Represents the abstract base class other Signal classes are derived from. Allows
 * all signals to be waited on.</p>
 * <h2>Child Classes:</h2>
 * <ul>
 * <li>{@link Semaphore}</li>
 * <li>{@link CountdownSignal}</li>
 * <li>{@link AutoResetSignal}</li>
 * <li>{@link ManualResetSignal}</li>
 * </ul>
 */
declare class Signal {
    /**
     * <p>Queues the caller until the signal is placed into a signaled state.</p>
     * @example
     * const signals = [
      signals.manualReset(),
      signals.autoReset(),
      signals.semaphore(),
      signals.countdown(),
    ];
    
    await Promise.all(signals.map(signal => signal.ready()));
     * @returns <p>A Promise that will be resolved when the signal is placed
     * into a signaled state.</p>
     */
    ready(): Promise;
}

/**
 * <p>Queues all callers until signaled. Once signaled, all callers proceed in the
 * order they were queued. Future callers will proceed immediately while this
 * object remains in a signaled state.</p>
 * <p>Think of the manual reset signal as a traffic light. While it is red, all cars
 * are queued in the order they arrive. Once the light is signaled green, the cars
 * can proceed in the order they arrived. And as long as the light remains green,
 * any future cars can proceed.</p>
 * @example
 * const signal = signals.manualReset();

export function bootstrap() {
  // do some preliminary stuff
  signal.set(); // unblock any callers
}

export async function doSomething() {
  // block callers until signaled:
  await signal.ready();
  // bootstrap has now been called and
  // completed, so we can safely perform
  // an operation here
}
 * @example
 * // simple pause/resume functionality

const signal = signals.manualReset(true); // start unblocked

export async function doSomething() {
  await signal.ready();
  // do stuff here
}

export function pause() {
  signal.reset();
}

export function resume() {
  signal.set();
}
 */
declare class ManualResetSignal extends Signal {
    /**
     * <p>Places the signal into a signaled state. This invokes any queued callers
     * in the order they were queued and allows future callers to proceed immediately.</p>
     * @example
     * import { tracker } from '../path/to/tracker';
    
    const signal = signals.manualReset(); // starts blocked
    
    export async function bootstrap() {
      // do bootstrap stuff here
      signal.set(); // unblock the signal
    }
    
    export function onReady(callback) {
      signal.ready() // block until signaled
        .then(callback)
        .catch(errors.rethrow(errors.ignore()))
        .catch(tracker.error);
    }
     */
    set(): void;
    /**
     * <p>Places the signal into a blocked (unsignaled) state. This begins queueing
     * any future callers.</p>
     * @example
     * // simple pause/resume functionality
    
    const signal = signals.manualReset(true); // start unblocked
    
    export async function doSomething() {
      await signal.ready();
      // do stuff here
    }
    
    export function pause() {
      signal.reset();
    }
    
    export function resume() {
      signal.set();
    }
     */
    reset(): void;
    /**
     * <p>Queues the caller until the signal is placed into a signaled state.</p>
     * @example
     * import { tracker } from '../path/to/tracker';
    
    const signal = signals.manualReset(); // starts blocked
    
    export async function bootstrap() {
      // do bootstrap stuff here
      signal.set(); // unblock the signal
    }
    
    export function onReady(callback) {
      signal.ready() // block until signaled
        .then(callback)
        .catch(errors.rethrow(errors.ignore()))
        .catch(tracker.error);
    }
     * @returns <p>A Promise that will be resolved when the signal is placed
     * into a signaled state.</p>
     */
    ready(): Promise;
}

/**
 * <p>Releases 1 queued caller each time it is signaled.</p>
 * <p>The auto reset signal can be used to create a <code>critical section</code> -- i.e. a block
 * of code that can only be executed by 1 caller at a time. Every other caller will
 * be queued in the order they arrive, and the next caller in the queue will only
 * be allowed to enter the critical section when the previous caller leaves the
 * critical section.</p>
 * @example
 * import { fetch, createRequest } from '../path/to/datalayer';

const signal = signals.autoReset(true); // start unblocked

const operation = {
  method: 'POST',
  base: 'my-app',
  path: '/some/endpoint'
};

// ensure each network call completes
// before the next call is performed:
export async function networkCall() {
  await signal.ready(); // blocks other callers
  try {
    const data = { ... }; // payload to POST to the endpoint
    const request = createRequest(operation, null, data);
    const response = await fetch(request);
    return response.data;
  } finally {
    signal.set(); // unblock the next caller
  }
}
 */
declare class AutoResetSignal extends Signal {
    /**
     * <p>Places the signal into a signaled state. This will release only 1 queued caller
     * and then immediately reset the signal.</p>
     * @example
     * const signal = signals.autoReset(true); // start unblocked
    
    export async function doSomething() {
      await signal.ready(); // blocks other callers
      try {
        // critical section here
      } finally {
        signal.set(); // unblock the signal so the next caller can proceed
      }
    }
     */
    set(): void;
    /**
     * <p>Places the signal into a blocked (unsignaled) state. This begins queueing
     * any future callers.</p>
     * <p><strong>NOTE:</strong> You often won't need to call this method directly since this
     * signal will reset automatically each time it is set.</p>
     * @example
     * const signal = signals.autoReset(true); // start unblocked
    
    export async function doSomething() {
      await signal.ready();
      // do stuff here
      signal.set();
    }
    
    export function cancel() {
      // this perpetually blocks the signal
      // unless set() gets called again
      signal.reset();
    }
     */
    reset(): void;
    /**
     * <p>Queues the caller until the signal is placed into a signaled state.</p>
     * @example
     * const signal = signals.autoReset(true); // start unblocked
    
    export async function doSomething() {
      await signal.ready(); // blocks other callers
      try {
        // critical section here
      } finally {
        signal.set(); // unblock the signal so the next caller can proceed
      }
    }
     * @returns <p>A Promise that will be resolved when the signal is placed
     * into a signaled state.</p>
     */
    ready(): Promise;
}

/**
 * <p>Queues callers until the counter reaches 0.</p>
 * @example
 * export function downloadAll(files = []) {
  const signal = signals.countdown(files.length);
  files.forEach(file =>
    download(file).finally(() =>
      signal.decrement()));
  return signal.ready();
}
 * @example
 * import { registry } from '../some/component/registry';

const signal = signals.countdown();

export function loadComponent(component) {
  if (component in registry) {
    signal.increment();
    const script = document.createElement('script');
    script.async = true;
    script.type = 'text/javascript';
    script.src = registry[component];
    script.onload = () => signal.decrement(); // countdown
    document.body.appendChild(script);
  }
  return signal.ready();
}
 */
declare class CountdownSignal extends Signal {
    /**
     * <p>Places the signal into a blocked state. The signal will need to be decremented
     * by a corresponding amount in order to unblock it.</p>
     * @example
     * const signal = signals.countdown();
    
    export function appendFilesToDownload(files = []) {
      signal.increment(files.length);
      files.forEach(file =>
        download(file).finally(() =>
          signal.decrement()));
      return signal.ready();
    }
     * @param [count = 1] - <p>The number to add to the internal counter. Must be a positive integer.</p>
     */
    increment(count?: number): void;
    /**
     * <p>Subtracts the specified amount from the counter. When the counter reaches 0 it
     * will be placed into an unblocked state, enabling any queued callers to proceed.</p>
     * @example
     * const signal = signals.countdown(3);
    
    async function doTask1() {
      // do stuff
      signal.decrement();
    }
    
    async function doTask2() {
      // do stuff
      signal.decrement();
    }
    
    async function doTask3() {
      // do stuff
      signal.decrement();
    }
    
    doTask1();
    doTask2();
    doTask3();
    
    export function ready() {
      return signal.ready();
    }
     * @param [count = 1] - <p>The number to subtract from the internal counter. Must be a positive integer.</p>
     */
    decrement(count?: number): void;
    /**
     * <p>Queues the caller until the counter reaches 0. Once the counter reaches 0, all
     * callers will be invoked in the order they were queued.</p>
     * @example
     * export function downloadAll(files = []) {
      const signal = signals.countdown(files.length);
      files.forEach(file =>
        download(file).finally(() =>
          signal.decrement()));
      return signal.ready();
    }
     * @returns <p>A Promise that will be resolved when the counter reaches 0.</p>
     */
    ready(): Promise;
}

/**
 * <p>Limits access to a pool of resources by restricting how many callers can run at a time.
 * Any callers above the allowed amount will be queued until a spot is released.</p>
 * <p><strong>Best Practices</strong></p>
 * <ul>
 * <li>Whether your operation succeeds or fails, <em>always</em> call {@link Semaphore#release release()}
 * to ensure the next caller can proceed. Calling <code>release()</code> inside a <code>finally</code> block makes this easy.
 * See the example below.</li>
 * </ul>
 * @example
 * import { fetch, createRequest } from '~/path/to/datalayer';
import { tracker } from '~/path/to/tracker';

const uploadSpots = signals.semaphore(5);
const operation = {
  base: 'files',
  method: 'POST',
  path: '/save/:id'
};

export async function uploadFile(blob) {
  const data = new FormData();
  const params = { id: tracker.uuid() };
  data.append('file', blob, params.id);
  try {
    await uploadSpots.ready();
    await fetch(createRequest(operation, params, data));
    return params.id;
  } finally {
    uploadSpots.release(); // always release
  }
}
 */
declare class Semaphore extends Signal {
    /**
     * <p>The number of spots currently available for callers before they will be queued.</p>
     * @example
     * const spots = signals.semaphore(10);
    
    spots.ready().then(doSomething).finally(spots.release);
    
    console.log(spots.queued); // 0
    console.log(spots.running); // 1
    console.log(spots.available); // 9
     */
    available: number;
    /**
     * <p>The number of callers currently running. Callers must always remember to call
     * {@link Semaphore#release release()} when done to ensure this number
     * is decremented appropriately.</p>
     * @example
     * const spots = signals.semaphore(10);
    
    spots.ready().then(doSomething).finally(spots.release);
    
    console.log(spots.queued); // 0
    console.log(spots.running); // 1
    console.log(spots.available); // 9
     */
    running: number;
    /**
     * <p>The number of callers that are still waiting to run.</p>
     * @example
     * const spots = signals.semaphore(2);
    
    spots.ready().then(doSomething).finally(spots.release);
    spots.ready().then(doSomethingElse).finally(spots.release);
    spots.ready().then(doAnotherThing).finally(spots.release);
    
    console.log(spots.queued); // 1
    console.log(spots.running); // 2
    console.log(spots.available); // 0
     */
    queued: number;
    /**
     * <p>Notifies the semaphore that the given number of slots have become available.
     * If any callers have been queued, they will be run in the newly available slots.</p>
     * @example
     * const spots = signals.semaphore(2);
    
    spots.ready()
      .then(doSomething)
      .finally(spots.release);
     * @example
     * const spots = signals.semaphore();
    
    Promise.all([
      spots.ready().then(firstOperation),
      spots.ready().then(secondOperation)
    ]).finally(() => spots.release(2));
     * @example
     * const spots = signals.semaphore(10);
    
    export async function doSomething() {
      await spots.ready();
      try {
        // code
      } finally {
        spots.release();
      }
    }
     * @param [count = 1] - <p>The number to spots to make available.</p>
     */
    release(count?: number): void;
    /**
     * <p>Queues the caller until a spot is available.</p>
     * @example
     * const spots = signals.semaphore(2);
    
    export async function doSomething() {
      await spots.ready();
      try {
        // do stuff
      } finally {
        spots.release();
      }
    }
     * @returns <p>A Promise that will be resolved when a slot is available.</p>
     */
    ready(): Promise;
}

/**
 * @example
 * const iv = window.crypto.getRandomBytes(new UintArray(16));
const key = window.crypto.getRandomBytes(new UintArray(8));

export const lockbox = stores.utils.withEncryption(stores.memoryStore(), { key, iv });
 */
declare class EncryptionConfiguration {
    /**
     * <p>The private key to use to encrypt
     * values in the store. The same key will need to be provided
     * on subsequent encrypted store instantiations, so a value
     * that is unique to the user (and unguessable by other users)
     * is recommended. Any string of any length can be used.</p>
     */
    static key: string;
    /**
     * <p>The initialization vector to use when
     * encrypting. Must be at least 7 characters long. The same value
     * should be provided on subsequent store instantiations, so a
     * value that is unique to the user (such as a GUID) is recommended.</p>
     */
    static iv: string;
}

/**
 * <p>Provides asynchronous data storage.</p>
 */
declare class Store {
    /**
     * <p>Retrieves data from the Store.</p>
     * @example
     * import { user } from '../data/user';
    
    const store = stores.utils.withPrefix(stores.localStore(), user.guid);
    
    function defaultFalse(result) {
      return (result === undefined) ? false : result;
    }
    
    export async function termsAccepted() {
      return await store.get('terms_accepted')
        .then(defaultFalse)
        .catch(errors.rethrow({ tags: ['legal'] }));
    }
     * @param key - <p>The item to retrieve from storage.</p>
     * @returns <p>A promise that will be resolved
     * with the value of the item in storage (or undefined, if
     * the item does not exist), or rejected if an error occurs.</p>
     */
    get(key: string): Promise<any>;
    /**
     * <p>Puts data into the Store.</p>
     * @example
     * import { user } from '../data/user';
    
    const store = stores.utils.withPrefix(stores.localStore(), user.guid);
    
    export async function markTermsAndConditionsRead() {
      return await store.set('terms_accepted', true)
        .catch(errors.rethrow({ tags: ['legal'] }));
    }
     * @param key - <p>The key that uniquely identifies the item to store.</p>
     * @param value - <p>The value to store under the associated key.</p>
     * @returns <p>A Promise that will be resolved with the key when the
     * item is stored, or rejected if the storage operation fails.</p>
     */
    set(key: string, value: any): Promise;
    /**
     * <p>Removes an item from the Store.</p>
     * @example
     * import { user } from '../data/user';
    
    const store = stores.utils.withPrefix(stores.localStore(), user.guid);
    
    export async function resetTermsAndConditions() {
      return await store.delete('terms_accepted')
        .catch(errors.rethrow({ tags: ['legal'] }));
    }
     * @param key - <p>The item to remove.</p>
     * @returns <p>A Promise that will be resolved when the item
     * is removed from storage successfully <em>or</em> if the item is not found.
     * This promise should only be rejected if the delete operation fails.</p>
     */
    delete(key: string): Promise;
}

/**
 * <p>Stores and retrieves Response objects.</p>
 * @example
 * const store = stores.indexedDB({store: 'my-objects'});
const ignore = () => {};

export const cache = {
  async get(request) {
    return await store.get(request.url).catch(ignore);
  },
  async set(request, response) {
    return await store.set(request.url, response).catch(ignore);
  }
}
 */
declare class Cache {
    /**
     * <p>Retrieves a Response object from the cache. You should resolve
     * with <code>undefined</code> if the cached value is not found, expired, or
     * invalid. Do NOT reject the returned Promise.</p>
     * @example
     * const store = stores.indexedDB({store: 'my-objects'});
    const ignore = () => {};
    
    export const cache = {
      async get(request) {
        return await store.get(request.url).catch(ignore);
      },
      async set(request, response) {
        return await store.set(request.url, response).catch(ignore);
      }
    }
     * @param request - <p>Contains information you can use to create
     * a cache key. Typically, the <code>url</code> is unique enough to act as a key.
     * See the example code.</p>
     * @returns <p>Promise resolved with <code>undefined</code> if
     * the key could not be found in the cache or is invalid; otherwise,
     * resolved with the {@link Response} object passed to {@link Cache#set}.</p>
     */
    get(request: Request): Promise<?Response>;
    /**
     * <p>Stores a Response object in the cache. Resolve the returned promise
     * when the object has been cached OR if the caching operation fails. Do
     * NOT reject the returned Promise.</p>
     * @example
     * const store = stores.indexedDB({store: 'my-objects'});
    const ignore = () => {};
    
    export const cache = {
      async get(request) {
        return await store.get(request.url).catch(ignore);
      },
      async set(request, response) {
        return await store.set(request.url, response).catch(ignore);
      }
    }
     * @param request - <p>Contains information you can use to create
     * a cache key. Typically, the <code>url</code> is unique enough to act as a key.
     * See the example code.</p>
     * @param response - <p>The Response to cache. This is the value
     * that should be returned from {@link Cache#get}.</p>
     * @returns <p>A promise resolved when the value is cached.</p>
     */
    set(request: Request, response: Response): Promise;
}

/**
 * <p>Provides options for controlling how a {@link Spy} behaves when invoked.</p>
 */
declare class SpyBehaviors {
    /**
     * <p>Throws the specified value when the {@link Spy} is invoked.</p>
     * @example
     * import { spy } from '@paychex/core/test/utils';
    
    const method = spy().throws(new Error());
    
    method.onCall(1).throws(new Error('2nd call'));
     * @param value - <p>The value to throw, typically an Error instance.</p>
     * @returns <p>The original context, for chaining.</p>
     */
    throws(value: any): Spy | SpyBehaviors;
    /**
     * <p>Returns the specified value when the {@link Spy} is invoked.</p>
     * @example
     * import { spy } from '@paychex/core/test/utils';
    
    const method = spy().returns('abc');
    
    method.onCall(1).returns('def');
     * @param value - <p>The value to return.</p>
     * @returns <p>The original context, for chaining.</p>
     */
    returns(value: any): Spy | SpyBehaviors;
    /**
     * <p>Calls the specified method when the {@link Spy} is invoked.</p>
     * @example
     * import { spy } from '@paychex/core/test/utils';
    
    const method = spy().invokes(function(...args) {
      console.log('method called with', args);
    });
    
    method.onCall(1).invokes(function(...args) {
      console.log('method called 2nd time', args);
    });
     * @param func - <p>The function to invoke. Will be passed
     * the same arguments and invoked in the same context the spy was.</p>
     * @returns <p>The original context, for chaining.</p>
     */
    invokes(func: (...params: any[]) => any): Spy | SpyBehaviors;
}

/**
 * @example
 * import { spy } from '@paychex/core/test/utils';

const method = spy();

method('abc');
method('def');

method.args; // ["def"]
method.calls[0].args; // ["abc"]
method.calls[0].callTime; // Date

method.call(window, "ghi");
method.calls.mostRecent().context; // Window
 */
declare class SpyCall {
    /**
     * <p>The arguments passed to this invocation of the spy.</p>
     */
    args: any[];
    /**
     * <p>The <code>this</code> context used for this invocation of the spy.</p>
     */
    context: any;
    /**
     * <p>When the spy was invoked.</p>
     */
    callTime: Date;
}

/**
 * <p>Used to provide custom behaviors at test time to control code flow and ensure
 * code coverage. Can also be used to verify individual call data (args and context)
 * as well as overall invocation counts.</p>
 * @example
 * import { spy } from '@paychex/core/test/utils';

const method = spy(); // create a new Spy instance

method.returns(123); // default behavior
method.onCall(1).throws(new Error()); // throw error on 2nd call

method.called; // false

method(); // 123

method.called; // true
method.callCount; // 1

try {
  method();
} catch (e) {
  // 2nd invocation throws error
}

method.call({}, 'abc');
method.callCount; // 3

method.calls(2).args; // ['abc']
method.calls(2).context; // {}
method.calls(2).callTime; // Date

method('def');
method.calls.mostRecent().args; // ['def']

// invoke a different function when the
// spy is called
method.invokes(function(...args) {
  console.log('proxy method called', args);
});

method('abc', 123); // "proxy method called ['abc', 123]"

method.reset();
method.called; // false
method.callCount; // 0

method(); // undefined
 */
declare class Spy extends SpyBehaviors, SpyCall {
    /**
     * <p>The number of times the spy was invoked.</p>
     */
    callCount: number;
    /**
     * <p><code>true</code> if the spy was invoked.</p>
     */
    called: boolean;
    /**
     * <p>Collection of data about each call.</p>
     */
    calls: SpyCall[];
    /**
     * <p>Changes the behaviors for a specific invocation of the Spy.</p>
     * @example
     * import { spy } from '@paychex/core/test/utils';
    
    const method = spy().returns(123);
    method.onCall(2).returns(456);
    method.onCall(3).invokes(console.log);
    method.onCall(4).throws(new Error());
    
    method(); // 123
    method(); // 123
    method(); // 456
    method('hello'); // "hello"
    method(); // throws
     * @param index - <p>The index of the call whose behavior should be changed.</p>
     * @returns <p>The possible behaviors to invoke for this call.</p>
     */
    onCall(index: number): SpyBehaviors;
}

/**
 * <p>Encapsulates tracking information. The {@link TrackingSubscriber}
 * will be invoked with an instance for each {@link Tracker} (or child
 * Tracker) method invoked.</p>
 */
declare class TrackingInfo {
    /**
     * <p>A random [RFC 4122 UUID]{@link https://tools.ietf.org/html/rfc4122#section-4.4}.</p>
     */
    id: string;
    /**
     * <p>The type of tracking information provided in this object. Either <code>'event'</code>, <code>'timer'</code>, or <code>'error'</code>.</p>
     */
    type: string;
    /**
     * <p>The description of this tracking entry.</p>
     */
    label: string;
    /**
     * <p>The number of milliseconds between January 1, 1970 00:00:00 UTC and when this entry was created.</p>
     */
    start: number;
    /**
     * <p>The number of milliseconds between January 1, 1970 00:00:00 UTC and when this entry was ended.</p>
     */
    stop: number;
    /**
     * <p>The difference in milliseconds between start and stop.</p>
     */
    duration: number;
    /**
     * <p>The number of times this entry has been logged.</p>
     */
    count: number;
    /**
     * <p>Optional additional data associated with this tracking entry.</p>
     */
    data: {
        [key: string]: any;
    };
}

/**
 * <p>Array of functions returned by calling {@link NestedTimingTracker#start start}
 * on a {@link NestedTimingTracker} instance. The first function stops the current
 * timer. The second function starts a new nested timer.</p>
 */
declare class NestedStartResult {
    /**
     * <p>Stops the nested timer.</p>
     */
    0: TimerStopFunction;
    /**
     * <p>Start a new nested timer.</p>
     */
    1: NestedStart;
}

/**
 * <p>Provides methods for logging events, errors, and performance.</p>
 * <p><strong>Best Practices</strong></p>
 * <ul>
 * <li>Combine {@link Tracker#child tracker.child()} with {@link Tracker#context tracker.context()}
 * to set cross-cutting information specific to your application and to each high-level business
 * process or transaction you have to track. You can create any number of child trackers that
 * inherit settings from their ancestors.</li>
 * </ul>
 * @example
 * // app/index.js

export const tracker = trackers.create();

tracker.context({
  app: 'my-app'
});
 * @example
 * // app/components/search.js

// import the root tracker with 'app' defined
import { tracker } from '../index';
import { fetch, createRequest } from '../data';

// create a child tracker for use
// only within this file
const fileTracker = tracker.child();

// all calls to child tracker methods
// will include this 'component', along
// with 'app' set by the root tracker
fileTracker.context({
  component: 'my-app-search'
});

const operation = {
  base: 'my-app',
  path: '/search'
};

export async function getSearchResults(query) {

  // create a child tracker for use only within
  // the lifetime of this function (ensures each
  // call to this function gets its own context)
  const methodTracker = fileTracker.child();

  // set data specific to this invocation
  methodTracker.context({ query });

  // the following event will include 'query'
  // and 'component' from ancestor trackers
  // as well as 'app' from the root tracker
  methodTracker.event('search');

  const params = { query };
  const stop = methodTracker.start('perform search');
  const request = createRequest(operation, params);
  const response = await fetch(request).catch(errors.rethrow(params));
  const results = response.data;

  // the following timer will include 'query',
  // 'component', 'app', and -- only on this
  // timer -- a 'status' value
  stop({ status: results.length ? 'Found' : 'Not Found' });

  return models.utils.withOrdering(models.collection(...results), ['priority'], ['desc']);
}
 */
declare class Tracker {
    /**
     * <p>Generates a random RFC 4122 UUID guaranteed to be unique.</p>
     * @example
     * import { tracker } from '~/tracking';
    import { proxy } from '~/path/to/data';
    
    proxy.use({
      headers: {
        'x-session-id': tracker.uuid()
      },
      match: {
        base: '^my\-app' // can use regular expression syntax
      }
    });
     * @returns <p>A [RFC 4122 v4 UUID]{@link https://tools.ietf.org/html/rfc4122#section-4.4}</p>
     */
    uuid(): string;
    /**
     * <p>Creates a child Tracker instance.</p>
     * @example
     * import { tracker } from '~/tracking';
    
    // this tracker will inherit any context data
    // set in landing's tracker while also mixing
    // in any contextual data of its own
    export const myAppTracker = tracker.child();
    
    myAppTracker.context({ app: 'my-app' });
    myAppTracker.event('app tracker created');
     * @returns <p>A new Tracker instance that will notify the same
     * root subscriber of {@link TrackingInfo} entries, mixing in ancestor
     * contextual data as needed.</p>
     */
    child(): Tracker;
    /**
     * <p>Sets contextual data to be mixed into each TrackingInfo created
     * by this Tracker or any child Trackers.</p>
     * @example
     * import { get } from 'lodash-es';
    import { store, tracker } from '~/tracking';
    
    store.subscribe(() => {
      const state = store.getState();
      const app = get(state, 'routes.stage');
      const drawer = get(state, 'routes.drawer');
      tracker.context({ app, drawer });
    });
     * @param data - <p>The data to merge into any
     * {@link TrackingInfo} instances created by this (or child) Tracker
     * methods.</p>
     */
    context(data: {
        [key: string]: any;
    }): void;
    /**
     * <p>Logs an event. Events usually represent important points in an application's
     * lifecycle or user-initiated actions such as button clicks.</p>
     * <p><strong>NOTE:</strong> This method also creates a [browser performance mark]{@link https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark} with the given message name.</p>
     * @example
     * import { tracker } from '~/tracking';
    
    window.addEventListener('click', (e) => {
      if (e.target.matches('button, a')) {
        // could grab additional contextual data
        // by looking at ancestor elements' attributes
        const type = e.target.tagName.toLowerCase();
        tracker.event('click', {
          tags: ['ui', type],
          label: e.target.innerText
        });
      }
    });
     * @param label - <p>The name of the event to log.</p>
     * @param [data] - <p>Optional information to associate with this {@link TrackingInfo}.</p>
     */
    event(label: string, data?: {
        [key: string]: any;
    }): void;
    /**
     * <p>Logs an [Error]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error}.</p>
     * @example
     * import { tracker } from '~/tracking';
    
    export function doSomething(param) {
      somePromiseMethod()
        .catch(errors.rethrow({ param }))
        .catch(tracker.error);
    }
     * @param err - <p>The Error instance to log.</p>
     */
    error(err: Error): void;
    /**
     * <p>Starts a timer to measure performance.</p>
     * @example
     * import { tracker } from '~/tracking';
    
    export async function doSomething(param) {
      const stop = tracker.start('doSomething');
      const results = await somePromiseMethod();
      stop({ count: results.length, param });
      return results;
    }
     * @param label - <p>The name of the timer to create.</p>
     * @returns <p>Method to invoke to stop and log the timer.</p>
     */
    start(label: string): TimerStopFunction;
}

/**
 * <p><strong>NOTE:</strong> The only difference between this class and the normal {@link Tracker}
 * is how the {@link NestedTimingTracker#start start} method works. Creating nested
 * timings introduces new edge cases that are important for you to understand:</p>
 * <h3>Edge Cases</h3>
 * <h4>Calling stop() Multiple Times</h4>
 * <p>Normally, invoking the <code>stop()</code> function returned from <code>start()</code> multiple times
 * will create a separate timing entry for each invocation and increase the entry's
 * <code>count</code> property.</p>
 * <p>With a nested timer, that only holds true for the root timing. For <em>nested</em> timings,
 * calling <code>stop()</code> multiple times creates <em>sibling</em> entries, incrementing <code>count</code>
 * with each invocation:</p>
 * <pre class="prettyprint source lang-javascript"><code>import { tracker } from '~/tracker';
 *
 * const logger = trackers.utils.withNesting(tracker);
 *
 * async function makeParallelDataCalls(start) {
 *     const [stop] = start('parallel calls');
 *     await Promise.all([
 *         someDataCall().then(() => stop()),
 *         someOtherDataCall().then(() => stop()),
 *         someLastDataCall().then(() => stop())
 *     ]);
 * }
 *
 * export async function loadData() {
 *     const [stop, start] = logger.start('load data');
 *     await makeParallelDataCalls(start);
 *     stop();
 * }
 *
 * // timing tree:
 * {
 *   &quot;id&quot;: &quot;9c6f8a25-5003-4b17-b3d6-838144c54a7d&quot;,
 *   &quot;label&quot;: &quot;load data&quot;,
 *   &quot;start&quot;: 1562933463457,
 *   &quot;stop&quot;: 1562933463490,
 *   &quot;duration&quot;: 33,
 *   &quot;type&quot;: &quot;timer&quot;,
 *   &quot;count&quot;: 1,
 *   &quot;data&quot;: {
 *     &quot;children&quot;: [
 *       {
 *         &quot;label&quot;: &quot;parallel calls&quot;,
 *         &quot;count&quot;: 1,
 *         &quot;start&quot;: 1562933463458,
 *         &quot;stop&quot;: 1562933463488,
 *         &quot;duration&quot;: 30,
 *         &quot;data&quot;: {
 *           &quot;children&quot;: []
 *         }
 *       },
 *       {
 *         &quot;label&quot;: &quot;parallel calls&quot;,
 *         &quot;count&quot;: 2,
 *         &quot;start&quot;: 1562933463458,
 *         &quot;stop&quot;: 1562933463490,
 *         &quot;duration&quot;: 32,
 *         &quot;data&quot;: {
 *           &quot;children&quot;: []
 *         }
 *       },
 *       {
 *         &quot;label&quot;: &quot;parallel calls&quot;,
 *         &quot;count&quot;: 3,
 *         &quot;start&quot;: 1562933463458,
 *         &quot;stop&quot;: 1562933463490,
 *         &quot;duration&quot;: 32,
 *         &quot;data&quot;: {
 *           &quot;children&quot;: []
 *         }
 *       }
 *     ]
 *   }
 * }
 * </code></pre>
 * <h4>Stopping Parents Before Children</h4>
 * <p>It is okay for nested timings to stop <em>after</em> an ancestor timing stops. However,
 * when the <em>root</em> timing is stopped, only completed timings will appear in the timing
 * tree. In other words, any nested timings that are still running will <em>not</em> appear
 * in the timing tree.</p>
 * <pre class="prettyprint source lang-javascript"><code>import { tracker } from '~/tracker';
 *
 * const logger = trackers.utils.withNesting(tracker);
 *
 * async function childData(start) {
 *     const [stop] = start('child timing');
 *     await someDataCall();
 *     stop();
 * }
 *
 * export async function loadData() {
 *     const [stop, start] = logger.start('load data');
 *     childData(start); // BUG! we forgot to await this async function!
 *     // because we didn't wait for childData to complete, the next line
 *     // will invoke stop WHILE the async function is still running...
 *     stop();
 * }
 *
 * // timing tree:
 * {
 *   &quot;id&quot;: &quot;ca0f72ad-eb9a-4b07-96ec-6292b8d2317f&quot;,
 *   &quot;label&quot;: &quot;load data&quot;,
 *   &quot;start&quot;: 1562936590429,
 *   &quot;stop&quot;: 1562936590440,
 *   &quot;duration&quot;: 11,
 *   &quot;type&quot;: &quot;timer&quot;,
 *   &quot;count&quot;: 1,
 *   &quot;data&quot;: {
 *     &quot;children&quot;: []
 *   }
 * }
 * </code></pre>
 * <h4>Creating Child Trackers</h4>
 * <p>Even on a NestedTimingTracker, calling {@link Tracker#child child()} creates
 * a normal {@link Tracker} instance. So, if you call <code>start()</code> on a child Tracker,
 * it will not use nested timings. If you want to combine child Trackers with
 * nested timings, you should change your call order:</p>
 * <pre class="prettyprint source lang-javascript"><code>import { tracker } from '~/tracker';
 *
 * // INCORRECT ✘
 * const logger = trackers.utils.withNesting(tracker);
 * const child = logger.child();
 *
 * // CORRECT ✓
 * const child = tracker.child();
 * const logger = trackers.utils.withNesting(child);
 * </code></pre>
 * <h3>Best Practices</h3>
 * <p>If you need to create a nested timing, that is a good indication that the
 * code should exist in a separate function. When you call this function, you
 * should pass the nested <code>start</code> function so that function can continue the
 * pattern by creating any nested timings it needs (now or in the future):</p>
 * <pre class="prettyprint source lang-javascript"><code>import { tracker } from '~/tracker';
 *
 * const logger = trackers.utils.withNesting(tracker);
 *
 * // INCORRECT ✘
 * export async function loadData() {
 *   const [stop, start] = logger.start('load data');
 *   start('nested timing');
 *   await someDataCall();
 *   stop();
 * }
 *
 * // CORRECT ✓
 * export async function loadData() {
 *   const [stop, start] = logger.start('load data');
 *   await loadChildData(start);
 *   stop();
 * }
 *
 * async function loadChildData(start) {
 *   const [stop, nest] = start('nested timing');
 *   // now we can pass `nest` to another function to
 *   // continue our pattern of creating nested timings
 *   await someDataCall();
 *   stop();
 * }
 * </code></pre>
 */
declare class NestedTimingTracker extends Tracker {
    /**
     * <p>Starts a timing tree. Unlike the normal {@link Tracker#start start} method, this
     * method does <em>not</em> return a stop function. Instead, it returns an array. The first
     * value in the array is the stop function; the second argument is another start function
     * you can invoke to begin a new nested timing.</p>
     * @example
     * import { tracker } from '~/tracking';
    import { someDataCall, someOtherDataCall } from '~/data/operations';
    
    const child = tracker.child();
    const logger = trackers.utils.withNesting(child);
    
    export async function loadData(id) {
      try {
        const [stop, start] = logger.start('load data');
        const data = await someDataCall(id);
        const results = await loadNestedData(start, data);
        stop({ id, results });
        return results;
      } catch (e) {
        logger.error(e);
      }
    }
    
    async function loadNestedData(start, data) {
      const [stop, ] = start('load nested data');
      const results = await someOtherDataCall(data);
      stop();
      return results;
    }
     * @param label - <p>The label of the nested timer to create.</p>
     * @returns <p>The <code>[stop, start]</code> methods you can use to
     * end the current timing or start a nested timing. The first function
     * is a normal {@link TimerStopFunction} and the second function is
     * another {@link NestedTimingTracker#start} function.</p>
     */
    start(label: string): NestedStartResult;
}

