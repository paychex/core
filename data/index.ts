/**
 * Provides methods for creating and configuring a data layer, providing applications
 * the ability to invoke data operations for various endpoints.
 *
 * ```js
 * // esm
 * import { data } from '@paychex/core';
 *
 * // cjs
 * const { data } = require('@paychex/core');
 *
 * // iife
 * const { data } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ data }) { ... });
 * define(['@paychex/core'], function({ data }) { ... });
 * ```
 *
 * **Basic Concepts**
 *
 * A `proxy` is a runtime set of {@link ProxyRule rules} that will be applied (in order)
 * to transform {@link Request Requests} prior to sending them to an {@link Adapter}.
 * You can configure the proxy rules at any time.
 *
 * An `adapter` converts a Request into a Promise resolved with
 * a {@link Response}. It should never throw an Error; instead, if a failure occurs, it
 * should set the appropriate properties on the Response. The following adapter repositories
 * can be used:
 *
 * | adapter | description |
 * | --- | --- |
 * | @paychex/adapter-xhr | Uses `XMLHttpRequest` to fulfill a data operation. Works in web browsers. |
 * | @paychex/adapter-node | Uses `https` to fulfill a data operation. Works in NodeJS. |
 *
 * A `data pipeline` is a sequence of steps whose job is to retrieve data. For that
 * reason, even the simplest data pipeline requires these 3 steps:
 *
 * 1. convert a {@link DataDefinition} object into a {@link Request}
 * 2. pass that Request to the appropriate {@link Adapter}, which will
 * 3. perform an operation (typically a network call) and return a {@link Response}
 *
 * The `data` module contains a factory method that creates a
 * {@link DataLayer}. The DataLayer can perform all 3 steps above.
 *
 * However, data pipelines usually are more complex and require additional business
 * logic to be applied correctly. Some additional logic you may want to apply to your
 * pipelines includes:
 *
 * - caching responses
 * - retrying on certain failures
 * - reauthenticating if a 401 is returned
 *
 * These features and more are available through wrapper functions in the
 * {@link utils} module.
 *
 * Combine functions from both modules to create a generic data pipeline that meets your
 * most common needs. Consumers of your pipeline can bolt on additional wrapping functions
 * to meet their unique requirements.
 *
 * ```js
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
 * pipeline = data.utils.withCustomErrors(pipeline);
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
 * ```
 *
 * ```js
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
 *     .catch(errors.rethrow(fatal(params)));
 *   return response.data;
 * }
 * ```
 * @module data
 */

import {
    get,
    cond,
    omit,
    defaults,
    isEmpty,
    isString,
    isFunction,
    isArray,
    isNumber,
    isObject,
    matches,
    constant,
    stubTrue,
    mergeWith,
    conforms,
    isObjectLike,
    isNil,
} from 'lodash';

import { tokenize } from './utils';
import { error, fatal } from '../errors/index';

export * as utils from './utils';

/**
 * Processes a Request and returns a Promise resolving to a Response object.
 *
 * **IMPORTANT:** An adapter should _never_ throw an Error or return a
 * rejected promise. Instead, set the {@link Response.meta.error} property
 * to `true` or else return a status code outside of the 200-299 range.
 *
 * @param request The data operation request to fulfill.
 * @returns A Promise resolved with a Response instance.
 */
export interface Adapter { (request: Request): Promise<Response> }

/**
* Converts a {@link Request} into a {@link Response} by running the
* request through an appropriate {@link Adapter}.
*
* @param request The Request to pass to an {@link Adapter}
* and convert into a {@link Response}.
* @returns A Promise resolved with response information for the request.
* @throws Adapter not found.
* @throws Invalid request passed to fetch.
* @throws (if the Response.status is not 2xx)
* @example
* ```js
* import xhr from '@paychex/adapter-xhr';
* import tracker from '~/path/to/tracker';
* import proxy from '~/path/to/proxy';
*
* // NOTE: you will probably already have access to
* // a datalayer and not need to create one yourself
* const { fetch, createRequest } = data.createDataLayer(proxy, xhr);
*
* const request = createRequest({
*   base: 'my-app',
*   path: '/live',
* });
*
* fetch(request)
*   .then(response => {
*     tracker.event('app is live', {
*       status: response.status,
*       message: response.statusText,
*       moreInfo: response.data,
*     });
*   })
*   .catch(tracker.error);
* ```
*/
export interface Fetch extends Adapter {}

/**
 * Metadata used to construct a {@link Request} instance.
 */
export interface DataDefinition {

    [key: string]: any

    /**
     * Used in conjunction with {@link ProxyRule ProxyRules} to determine the
     * domain name for the resulting {@link Request} URL. If an empty string is provided then a relative
     * URL (one without a protocol or domain name) will be created using the existing domain name and protocol.
     */
    base?: string

    /**
     * Combined with the base path (if provided) to construct an absolute or relative URL.
     */
    path?: string

    /**
     * The adapter to use to complete the request.
     *
     * @default 'default'
     */
    adapter?: string

    /**
     * The HTTP headers to use on the request.
     *
     * @default { accept: 'application/json, text/plain, ⁎/⁎' }
     */
    headers?: Record<string, string|string[]>

    /**
     * Can be used to skip certain behaviors. See documentation for details.
     */
    ignore?: Record<string, boolean>

    /**
     * The HTTP verb to use.
     *
     * @default 'GET'
     */
    method?: string

    /**
     * The desired response type. Can be one of `''` (the default),
     * `'text'`, `'json'`, `'arraybuffer'`, `'blob'` or `'document'`. See {@link https://xhr.spec.whatwg.org/#response-body the XHR spec}
     * for more information. Setting this will change the {@link Response Response.data} type.
     */
    responseType?: XMLHttpRequestResponseType

    /**
     * The number of milliseconds to wait before aborting the data call.
     *
     * @default 0 - no timeout
     */
    timeout?: number

    /**
     * Whether to send Cookies with the request.
     *
     * @default false
     */
    withCredentials?: boolean

}

/**
 * Encapsulates the information used by {@link Adapter Adapters} to complete a data call.
 *
 * **WARNING:** Do not construct a Request object manually. Instead, pass a {@link DataDefinition}
 * object to {@link DataLayer.createRequest createRequest()} directly.
 *
 * **IMPORTANT:** The Request object is frozen. Any attempt to modify existing Request values
 * will result in an Error. If you need to modify a Request as part of a data pipeline, use
 * {@link https://lodash.com/docs/4.17.11#cloneDeep cloneDeep} (or similar) to make a copy of
 * the Request that can be safely modified.
 */
export interface Request extends DataDefinition {

    /**
     * The URL to open, constructed using {@link DataProxy.url Proxy.url()} and any
     * {@link ProxyRule ProxyRules} that match the given Request properties as well as any optional
     * parameters passed to {@link DataLayer.createRequest createRequest()}.
     */
    url?: string

    /**
     * An optional payload to send to the URL, set when calling {@link DataLayer.createRequest createRequest()}.
     *
     * @default null
     */
    body?: any

}

/**
 * Contains information returned from endpoints (typically only when an error occurs).
 * Messages should NOT be presented to end users directly (although message codes could
 * translated and presented if they provide useful guidance on how to recover from an
 * error).
 */
export interface Message {

    /**
     * A unique code to identify this message. May be used during
     * translation to present recovery information to the end user.
     */
    code: string

    /**
     * The message severity. Possible values are ERROR, FATAL, and NONE.
     */
    severity: 'ERROR' | 'FATAL' | 'NONE'

    /**
     * Any additional information the server believes may be useful
     * when triaging the error later.
     */
    data: any[]

}

/**
 * Additional Response information.
 */
export interface MetaData {

    [key: string]: any,

    /**
     * Whether the response should be considered a failure.
     *
     * @default false
     */
    error?: boolean

    /**
     * Whether the response contains cached data.
     *
     * @default false
     */
    cached?: boolean

    /**
     * Whether the response timed out. When this is true,
     * [Response.status]{@link Response} should be 0 and `meta.error` should be true.
     *
     * @default false
     */
    timeout?: boolean

    /**
     * Map of response headers returned by the network call.
     */
    headers?: HeadersMap

    /**
     * Collection of {@link Message} instances; may be empty.
     */
    messages?: Message[]

}

/**
 * Represents the results of an Adapter's data operation. Ensures each adapter returns
 * a consistent format to the data layer for further processing (caching, error handling,
 * etc.).
 *
 * **NOTE:** This entire object should be serializable (i.e. no functions or complex built-in
 * objects) so the caching layer can retrieve the full Response on subsequent calls.
 */
export interface Response {

    /**
     * The response payload; may be `null`. Can be modified by setting `'responseType`'
     * on the {@link DataDefinition} object. See {@link https://xhr.spec.whatwg.org/#the-response-attribute the spec}
     * for more information on the types that can be returned.
     */
    data: any

    /**
     * A standard status code the {@link DataLayer.fetch} method will
    * examine to determine how to proceed. For example, a status code of 0 indicates an aborted
    * request and may prompt network diagnostics or a dialog prompting the user to restore their
    * network connection.
     */
    status: number

    /**
     * A message that will be used to generate an Error message,
     * if [`meta.error`]{@link MetaData.error} is `true`.
     */
    statusText: string

    /**
     * Additional information about the response.
     */
    meta: MetaData
}

/**
 * Adds {@link Response} information to a failed {@link Fetch} operation.
 */
export interface DataError extends Error {
    response?: Response
}

/**
 * Represents the results of a call to the DataLayer's {@link DataLayer.fetch fetch} method.
 */
export interface DataPromise extends Promise<Response> {
    catch(onrejected: (error: DataError) => void): Promise<void>
    catch(onrejected: (error: DataError) => never | PromiseLike<never> | undefined | null): Promise<Response|never>
}

/**
 * Contains the minimum functionality necessary to convert a
 * {@link DataDefinition} object into a {@link Request} and to
 * execute that Request against an {@link Adapter}, returning
 * a {@link Response} with the requested data.
 */
export interface DataLayer {

    /**
    * Converts a {@link Request} into a {@link Response} by running the
    * request through an appropriate {@link Adapter}.
    *
    * @param request The Request to pass to an {@link Adapter}
    * and convert into a {@link Response}.
    * @returns Information about the data operation.
    * @throws Adapter not found.
    * @throws Invalid request passed to fetch.
    * @throws (if the Response.status is not 2xx)
    * @example
    * ```js
    * import xhr from '@paychex/adapter-xhr';
    * import tracker from '~/path/to/tracker';
    * import proxy from '~/path/to/proxy';
    *
    * // NOTE: you will probably already have access to
    * // a datalayer and not need to create one yourself
    * const { fetch, createRequest } = data.createDataLayer(proxy, xhr);
    *
    * const request = createRequest({
    *   base: 'my-app',
    *   path: '/live',
    * });
    *
    * fetch(request)
    *   .then(response => {
    *     tracker.event('app is live', {
    *       status: response.status,
    *       message: response.statusText,
    *       moreInfo: response.data,
    *     });
    *   })
    *   .catch(tracker.error);
    * ```
    */
    fetch(request: Request): DataPromise

    /**
     * Converts a {@link DataDefinition} object into a {@link Request} object that can be
     * passed to {@link DataLayer.fetch fetch}. The {@link DataProxy proxy} passed to
     * {@link createDataLayer} will be used to fill out the
     * Request using any configured {@link ProxyRule ProxyRules}.
     *
     * Keeping your data definition objects separate from request objects enables us to
     * construct dynamic requests based on ProxyRules set at runtime. This means we can change
     * the endpoints and protocols using configuration data rather than code.
     *
     * @param definition The DataDefinition to convert into a Request using ProxyRules.
     * @param params Optional parameters used to tokenize the URL or to append to the QueryString.
     * @param body Optional data to send with the request.
     * @returns A fully formed Request that can be passed to {@link DataLayer.fetch fetch}.
     * @throws A valid DataDefinition object must be passed to createRequest.
     * @example
     * ```js
     * // save modified user data using a PATCH
     *
     * import { createPatch } from 'some/json-patch/library';
     * import { createRequest, fetch } from '~/path/to/datalayer';
     *
     * const operation = {
     *   base: 'my-app',
     *   method: 'PATCH',
     *   path: '/users/:id'
     * };
     *
     * export async function saveUserData(id, modified, original) {
     *   const params = { id };
     *   const body = createPatch(original, modified);
     *   const request = createRequest(operation, params, body);
     *   const response = await fetch(request).catch(errors.rethrow(errors.fatal(params)));
     *   return response.data;
     * }
     * ```
     * @example
     * ```js
     * // load data using the current domain and protocol
     *
     * import { createRequest, fetch } from '~/path/to/datalayer';
     *
     * const operation = {
     *   method: 'GET',
     *   // by not specifying a `base` value the resulting
     *   // URL will be relative to the current domain and
     *   // protocol
     *   path: '/users/:id'
     * };
     *
     * export async function loadUserData(id) {
     *   const params = { id };
     *   const request = createRequest(operation, params);
     *   const response = await fetch(request).catch(errors.rethrow(params));
     *   return response.data;
     * }
     * ```
     */
    createRequest(definition: DataDefinition, params?: Record<string, any>, body?: any): Request

    /**
     * Registers an {@link Adapter} with the given name. The {@link DataLayer.fetch fetch}
     * method will match the `'adapter'` value on the {@link Request} it is given with
     * any Adapters registered here.
     *
     * **NOTE:** The default adapter for a Request is the adapter used to construct the
     * data layer, which is always registered as `'default'`.
     *
     * @param name The name of the Adapter to register.
     * @param adapter The Adapter to register.
     * @example
     * ```js
     * // create a custom Adapter that uses the
     * // popular Axios library to make data calls
     * // https://github.com/axios/axios
     *
     * import axios from 'axios';
     * import { cloneDeep } from 'lodash';
     * import { setAdapter, createRequest, fetch } from '~/path/to/datalayer';
     *
     * const http = axios.create({
     *   withCredentials: true,
     *   headers: { accept: 'application/json' }
     * });
     *
     * // construct and return a Response object
     * // using the values provided by Axios
     * function createResponseFromSuccess(axiosResponse) { ... }
     * function createResponseFromFailure(axiosError) { ... }
     *
     * setAdapter('axios', function useAxios(request) {
     *   // convert the Request into a config
     *   // that Axios understands -- e.g. axios
     *   // uses request.data instead of request.body
     *   const config = cloneDeep(request);
     *   config.data = request.body;
     *   return axios(config)
     *     // always resolve with a Response,
     *     // regardless of any errors:
     *     .then(createResponseFromSuccess)
     *     .catch(createResponseFromFailure);
     * });
     *
     * // usage:
     * const definition = {
     *   base: 'my-app',
     *   path: '/path/to/data',
     *   adapter: 'axios', // <-- use our custom adapter
     *   method: 'POST',
     * };
     *
     * export async function saveData(data) {
     *   // our code looks the same regardless of which adapter
     *   // is used to make the data call; the adapter could even
     *   // be changed dynamically by the rules in our Proxy
     *   const request = createRequest(definition, null, data);
     *   const response = await fetch(request);
     *   return response.meta.headers['e-tag'];
     * }
     * ```
     */
    setAdapter(name: string, adapter: Adapter): void

}

/**
 * Represents a single rule in a proxy instance. A Proxy rule looks like a normal {@link Request}
 * object with an additional property `match` that specifies the property values on a Request
 * instance that must match in order for the rule to be applied.
 */
export interface ProxyRule extends Request {

    /**
     * Can be used to specify the protocol, host name, and port number
     * in one setting, rather than 3 different settings.
     */
    origin?: string

    /**
     * 'http', 'https', 'file', etc.
     */
    protocol?: string

    /**
     * 'myapps.myserver.com', 'localhost', etc.
     */
    host?: string

    /**
     * 80, 8080, etc.
     *
     * @default 80
     */
    port?: number

    /**
     * One or more keys in a request object whose values must match
     * the given regular expression patterns.E.g.: `{base: 'cdn'}` or`{base: 'myapp', path: 'load.+'}`
     */
    match?: Record<string, string>;

}

/**
 * The Proxy provides an intercept layer based on build- and run-time configurations to enable
 * easier local development, impersonation, dynamic endpoints, static data redirects, and user-
 * and environment-specific versioning.
 *
 * ```js
 * const proxy = data.createProxy();
 * ```
 */
export interface DataProxy {

    /**
     * Uses the current proxy rules to construct a URL based on the given arguments.
     *
     * @param base Either a Request instance, or a base value, e.g. 'cdn' or 'myapp'.
     * @param paths If a `string` base value is provided, one or more URL paths to combine into the final URL.
     * @returns A URL with the appropriate protocol, host, port, and paths
     * given the currently configured proxy rules.
     * @example
     * ```js
     * const url = proxy.url('cdn', 'images', 'logo.svg');
     * ```
     * @example
     * ```js
     * const url = proxy.url({
     *   base: 'cdn',
     *   protocol: 'https',
     *   path: '/some/path'
     * });
     * ```
     * @example
     * ```js
     * import { proxy } from '~/path/to/data';
     *
     * proxy.use({
     *   port: 8118,
     *   protocol: 'https',
     *   host: 'images.myserver.com',
     *   match: {
     *     base: 'images'
     *   }
     * });
     * ```
     *
     * ```html
     * <img src="{{ getImageURL('avatars', 'e13d429a') }}" alt="" />
     * <!-- https://images.myserver.com:8118/avatars/e13d429a -->
     * ```
     *
     * ```js
     * export function getImageURL(bucket, id) {
     *   return proxy.url('images', bucket, id);
     * }
     * ```
     */
    url(...args: any[]): string

    /**
     * Add {@link ProxyRule rules} to the proxy instance. The order rules are added determines
     * the order they are applied.
     *
     * @param rules The rules to use to configure this proxy instance.
     * @example
     * ```js
     * import { proxy } from '~/path/to/data';
     *
     * // any {@link Request Requests} with base == 'files'
     * // will be routed to https://files.myserver.com:8118
     * proxy.use({
     *   port: 8118,
     *   protocol: 'https',
     *   host: 'files.myserver.com',
     *   match: {
     *     base: 'files'
     *   }
     * });
     * ```
     */
    use(...rules: ProxyRule[]): void

    /**
    * Modifies the input Request object according to any matching Proxy rules.
    * Rules are applied in the order they were added to the Proxy, so later rules will
    * always override earlier rules.
    *
    * **NOTE:** You will not typically call this method directly. Instead, the
    * DataLayer.createRequest method will invoke this function on your behalf. See
    * that method for details.
    *
    * @param request The request object whose key/value pairs will be used
    * to determine which proxy rules should be used to determine the version.
    * @returns The input Request object, with properties modified according
    * to the matching Proxy rules.
    * @see {@link DataLayer.createRequest createRequest} — invokes the apply
    * method for you
    * @example
    * ```js
    * import { proxy, createRequest, fetch } from '~/path/to/data';
    * import switches from '../config/features.mjson';
    *
    * if (switches.useV2endpoint) {
    *   // switch from Remote to REST endpoint
    *   proxy.use({
    *     path: '/v2/endpoint',
    *     match: {
    *       base: 'my-project',
    *       path: '/endpoint',
    *     }
    *   });
    * }
    *
    * export async function getEndpointData() {
    *   // createRequest modifies the Request
    *   // object generated by the DDO using
    *   // Proxy rules, including the one above
    *   const request = createRequest({
    *     base: 'my-project',
    *     path: '/endpoint',
    *   });
    *   const response = await fetch(request)
    *     .catch(errors.rethrow(errors.fatal()));
    *   return response.data;
    * }
    * ```
    */
    apply(request: Request): Request

}

/**
 * Map of strings representing either {@link Request} headers
 * or {@link Response} {@link MetaData meta} headers. The header name is the key
 * and the header data is the value. If you pass an array of strings as the value,
 * the strings will be combined and separated by commas.
 *
 * @example
 * ```js
 * import { fetch, createRequest } from '~/path/to/datalayer';
 *
 * async function loadData() {
 *   const request = createRequest({
 *     base: 'my-app',
 *     path: '/path/to/data',
 *     headers: {
 *       'content-type': 'application/json',
 *       'accept': [
 *         'application/json',
 *         'text/plain',
 *         '*∕*'
 *       ]
 *     }
 *   });
 *   const response = await fetch(request);
 *   console.log(response.meta.headers);
 *   return response.data;
 * }
 * ```
 */
export type HeadersMap = Record<string, string|string[]>

/**
 * @example
 * ```js
 * import { isString } from 'lodash';
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
 * const attempt = data.utils.withTransform(fetch, transformer);
 *
 * export async function getJSONData() {
 *   const request = createRequest(operation);
 *   const response = await attempt(request);
 *   return response.data;
 * }
 * ```
 */
export interface Transformer {

    /**
     * Enables developers to modify the data of a request prior to sending. The
     * current body data and headers map will be passed to this method, and the return
     * value will be used as the new request body data. You can also mutate the headers
     * map (e.g. by adding or deleting values) prior to the request being sent.
     *
     * @param data The payload passed to {@link DataLayer.createRequest}. Whatever
     * you return from this function will be used as the new request payload.
     * @param headers A key-value collection of header names
     * to header values. You can modify this object directly (e.g. by adding or
     * deleting values) prior to the request being sent.
     * @returns The new body to send with the request.
     */
    request(data: any, headers: Record<string, string>): Promise<any> | any

    /**
    * Enables developers to modify the data of a response before it is returned
    * to callers.
    *
    * @param data The response payload returned from the server. Whatever value
    * you return from this function will replace {@link Response}.data.
    * @returns The data to return to callers.
    */
    response(data: any): Promise<any> | any

}

/**
 * Provides optional overrides for XSRF cookie and header names. Can be passed to
 * {@link module:data/utils.withXSRF withXSRF} when wrapping a fetch operation.
 *
 * @example
 * ```js
 * import { fetch } from '~/path/to/datalayer';
 *
 * export const safeFetch = data.utils.withXSRF(fetch, {
 *   cookie: 'XSRF-MY-APP',
 *   header: 'X-XSRF-MY-APP',
 *   hosts: ['*.my-app.com']
 * });
 * ```
 */
export interface XSRFOptions {

    /**
     * The name of the cookie sent by the server
     * that has the user's XSRF token value.
     *
     * @default 'XSRF-TOKEN'
     */
    cookie?: string

    /**
     * The name of the request header to set. The server should ensure this value matches the user's expected XSRF token.
     *
     * @default 'x-xsrf-token'
     */
    header?: string

    /**
     * A whitelist of patterns used to determine which host
     * names the XSRF token will be sent to even when making a cross-origin request. For
     * example, a site running on `www.server.com` would not normally include the XSRF
     * token header on any requests to the `api.server.com` subdomain since the hostnames
     * don't exactly match. However, if you added `api.server.com` or `*.server.com` to
     * the hosts array (and if the port and protocol both still matched the origin's port
     * and protocol), the header would be sent.
     */
    hosts?: string[]

    /** @ignore */
    provider?: (name: string) => string

}

/**
 * Determines whether a failed data operation should be
 * retried. Returning a resolved promise means to retry
 * the data operation. A rejected promise means not to
 * retry the data operation.
 *
 * @param request The Request object.
 * @param response The Response object.
 * @returns Resolving the promise means to
 * retry the data operation. Rejecting the promise means
 * not to retry the data operation.
 */
export interface RetryFunction { (request: Request, response: Response): Promise<void> }

/**
 * Invoked when a network connection is lost. Should resolve when the
 * network connection is re-established. NOTE: This method may be called
 * multiple times while the connection is down; its logic should handle
 * this scenario (e.g. only showing a dialog to the user once per outage).
 *
 * @param request The request to inspect.
 * @returns A promise that will be resolved when the user's
 * network connection is restored.
 */
export interface Reconnect { (request: Request): Promise<void> }

/**
 * Invoked when a 401 error is returned on a {@link Response}. Indicates that
 * the user's authentication token is invalid and should be regenerated.
 * Typically, a reauth function will add a {@link ProxyRule Proxy rule} to ensure
 * the token is applied in the correct format (e.g. as an Authorize header) and on
 * the correct {@link Request Requests} (e.g. Requests with a specific `base`).
 * Another approach is to make a network call that returns an updated Set-Cookie
 * response header so that future requests contain an updated JWT value.
 *
 * @param request The request that failed with an authentication error.
 * @returns A promise that will be resolved when the user's
 * authentication token has been retrieved and any corresponding Proxy
 * rules have been applied.
 */
export interface Reauthenticate { (request: Request): Promise<void> }

/**
 * Invoked when a data call is aborted ({@link Response} status is 0) but the user
 * has a connection to the Internet. NOTE: This method may be called multiple
 * times; its logic should ensure it only runs diagnostics the desired number of
 * times (e.g. once per failed domain). Also, this method is responsible for logging
 * results (or for caching the results if a connection could not be established).
 *
 * @param request The request that failed without receiving
 * a response. The user still has a network connection, so we need to
 * determine why the connection may have failed.
 * @returns A Promise resolved when the diagnostics suite has
 * completed. NOTE: {@link module:data/utils.withDiagnostics withDiagnostics}
 * will proceed without waiting for this promise to resolve.
 */
export interface Diagnostics { (request: Request): Promise<void> }

const isNonEmptyString = (value: any) => isString(value) && !isEmpty(value);

const isProxy = conforms({
    url: isFunction,
    apply: isFunction,
});

const isRequest = conforms({
    url: isNonEmptyString,
    method: isNonEmptyString,
    adapter: isNonEmptyString,
});

const STATUS_MESSAGES = {
    100: "Continue",
    101: "Switching Protocols",
    103: "Early Hints",
    200: "OK",
    201: "Created",
    202: "Accepted",
    203: "Non-Authoritative Information",
    204: "No Content",
    205: "Reset Content",
    206: "Partial Content",
    300: "Multiple Choices",
    301: "Moved Permanently",
    302: "Found",
    303: "See Other",
    304: "Not Modified",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Payload Too Large",
    414: "URI Too Long",
    415: "Unsupported Media Type",
    416: "Range Not Satisfiable",
    417: "Expectation Failed",
    418: "I'm a Teapot",
    422: "Unprocessable Entity",
    425: "Too Early",
    426: "Upgrade Required",
    428: "Precondition Required",
    429: "Too Many Requests",
    431: "Request Header Fields Too Large",
    451: "Unavailable For Legal Reasons",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
    511: "Network Authentication Required",
};

function isErrorResponse(response: Response): boolean {
    return get(response, 'meta.error', false) ||
        get(response, 'status', 0) < 200 ||
        get(response, 'status', 0) > 299;
}

function getErrorMessage(response: Response): string {
    // some responses don't provide a statusText so we
    // may need to use the status code to create one
    const message = get(STATUS_MESSAGES, response.status, 'Unknown HTTP Error');
    return isEmpty(response.statusText) ? message : response.statusText;
}

/**
 * Creates a new DataLayer instance that can retrieve data from
 * various sources.
 *
 * @param proxy The Proxy to use to construct requests.
 * @param adapter The default adapter to use for requests.
 * @returns A DataLayer that can be used to retrieve
 * data asynchronously.
 * @throws A proxy must be passed to createDataLayer.
 * @example
 * ```js
 * // datalayer.js
 *
 * import xhr from '@paychex/adapter-xhr';
 * import proxy from '~/path/to/my/proxy';
 *
 * const { fetch, createRequest } = data.createDataLayer(proxy, xhr);
 *
 * // we can extend the base functionality of fetch before
 * // returning it to consumers:
 *
 * const pipeline = data.utils.withHeaders(fetch, {
 *   'x-app-platform': 'android',
 *   'content-type': 'application/json'
 * });
 *
 * export {
 *   createRequest,
 *   fetch: pipeline
 * }
 * ```
 */
export function createDataLayer(proxy: DataProxy, adapter: Adapter): DataLayer {

    if (!isProxy(proxy))
        throw error('A proxy must be passed to createDataLayer.', fatal());

    if (!isFunction(adapter))
        throw error('An adapter must be passed to createDataLayer.', fatal());

    const adapters: Map<string, Adapter> = arguments[2] || new Map<string, Adapter>()

    function fetch(request: Request): DataPromise {

        if (!isRequest(request as any))
            throw error('Invalid request passed to fetch.', fatal());

        const requestedAdapter = adapters.get(request.adapter);
        if (!isFunction(requestedAdapter))
            throw error('Adapter not found.', fatal({ adapter: request.adapter }));

        return Promise.resolve(requestedAdapter(request))
            .then((response: Response) => {
                if (isErrorResponse(response))
                    throw error(getErrorMessage(response), { response });
                return response;
            }) as DataPromise;

    }

    function createRequest(definition: DataDefinition, params = {}, body: any = null) {

        if (!isObjectLike(definition))
            throw error('A valid DataDefinition object must be passed to createRequest.');

        const request = defaults({}, definition, {
            body,
            url: null,
            ignore: {},
            timeout: 0,
            method: 'GET',
            adapter: 'default',
            responseType: '',
            withCredentials: false,
            headers: { accept: 'application/json, text/plain, */*' },
        });

        proxy.apply(request);

        request.url = tokenize(proxy.url(request), params);

        return Object.freeze(request);

    }

    function setAdapter(name: string, instance: Adapter) {
        adapters.set(name, instance);
    }

    setAdapter('default', adapter);

    return {
        fetch,
        setAdapter,
        createRequest,
    };

}

const DOUBLE_SLASH = /\/\//g;
const LEADING_SLASHES = /^\/+/;

const merge = (lhs: any, rhs: any) => mergeWith(lhs, rhs, arrayConcat);

function forceConcat(lhs: any, rhs: any) {
    return isNil(lhs)
        ? undefined
        : Array.prototype.concat.call([], lhs, rhs);
}

function arrayConcat(lhs: any, rhs: any, key: string) {
    switch (true) {
        case isArray(lhs): return lhs.concat(rhs);
        case key === 'headers': return mergeWith(lhs, rhs, forceConcat);
    }
}

function patternMatches([key, pattern]: [string, string]) {
    return new RegExp(pattern, 'i').test(this[key]);
}

function ruleMatches(rule: ProxyRule): boolean {
    const { match = {} } = rule;
    return Object.entries(match).every(patternMatches, this);
}

function withoutMatchObject(rule: ProxyRule): Request {
    return omit(rule, 'match');
}

const equals = (rhs: any) => (lhs: any) => lhs === rhs;
const suffix = (after: string) => (value: string) => `${value}${after}`;
const prefix = (before: string) => (value: string) => `${before}${value}`;
const clean = (protocol: string) => protocol.replace(/[^a-zA-Z]/g, '');

const format = {
    protocol: cond([
        [matches('file'), constant('file:///')],
        [isEmpty, constant('//')],
        [stubTrue, suffix('://')]
    ]),
    port: cond([
        [equals(80), constant('')],
        [isNumber, prefix(':')],
        [stubTrue, constant('')]
    ]),
    path: cond([
        [isEmpty, constant('')],
        [stubTrue, prefix('/')]
    ])
};

/**
* Creates a new proxy instance.
*
* @example
* ```js
* import rules from '~/config/proxy'
* export const proxy = data.createProxy();
* proxy.use(rules);
* ```
*/
export function createProxy(): DataProxy {

    const config: ProxyRule[] = [];

    return {

        url(...args: any): string {
            const request: any = isObject(args[0]) ? args[0] : {
                port: 80,
                protocol: '',
                base: args.shift(),
                path: args.join('/'),
            };
            request.path = request.path
                .replace(DOUBLE_SLASH, '/')
                .replace(LEADING_SLASHES, '');
            let {
                origin = '',
                protocol = '',
                host = '',
                port = 80,
            } = config
                .filter(ruleMatches, request)
                .reduce(merge, request);
            if (origin) {
                try {
                    const url = new URL(origin);
                    host = url.host;
                    port = url.port;
                    protocol = url.protocol;
                } catch (e) {
                    throw error(`invalid origin in proxy rules`, { origin });
                }
            }
            return [
                host ? format.protocol(clean(protocol)) : '',
                host,
                format.port(port),
                format.path(request.path)
            ].join('');
        },

        apply(request: Request): Request {
            return config
                .filter(ruleMatches, request)
                .map(withoutMatchObject)
                .reduce(merge, request);
        },

        use(...rules: ProxyRule[]): void {
            config.push(...Array.prototype.concat.apply([], rules));
        },

    };

}
