/**
 * Processes a Request and returns a Promise resolving to a Response object.
 *
 * @async
 * @global
 * @ignore
 * @callback Adapter
 * @param {Request} request The data operation request to fulfill.
 * @returns {Promise<Response>} A Promise resolved with a Response instance.
 */

/**
 * @ignore
 * @type {Adapter}
 */
export async function Adapter(request) {}

/**
* Converts a {@link Request} into a {@link Response} by running the
* request through an appropriate {@link Adapter}.
*
* @async
* @global
* @ignore
* @callback Fetch
* @param {Request} request The Request to pass to an {@link Adapter}
* and convert into a {@link Response}.
* @returns {Promise.<Response>} Information about the data operation.
* @throws Adapter not found.
* @throws Invalid request passed to fetch.
* @throws (if the Response.status is not 2xx)
* @example
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
*/

/**
 * @ignore
 * @type {Fetch}
 */
export async function Fetch(request) { }

/**
 * Metadata used to construct a {@link Request} instance.
 *
 * @global
 * @class
 * @hideconstructor
 */
export class DataDefinition {

    /**
     * Used in conjunction with {@link ProxyRule ProxyRules} to determine the
     * domain name for the resulting {@link Request} URL. If an empty string is provided then a relative
     * URL (one without a protocol or domain name) will be created using the existing domain name and protocol.
     *
     * @type {string}
     * @memberof DataDefinition#
     */
    base = ''

    /**
     * Combined with the base path (if provided) to construct an absolute or relative URL.
     *
     * @type {string}
     * @memberof DataDefinition#
     */
    path = ''

    /**
     * The adapter to use to complete the request.
     *
     * @type {string}
     * @memberof DataDefinition#
     */
    adapter = 'default'

    /**
     * The HTTP headers to use on the request.
     *
     * @type {Object.<string,string|string[]>}
     * @memberof DataDefinition#
     */
    headers = { accept: 'application/json, text/plain, */*' }

    /**
     * Can be used to skip certain behaviors. See documentation for details.
     *
     * @type {Object.<string,boolean>}
     * @memberof DataDefinition#
     */
    ignore = {}

    /**
     * The HTTP verb to use.
     *
     * @type {string}
     * @memberof DataDefinition#
     */
    method = 'GET'

    /**
     * The desired response type. Can be one of `''` (the default),
     * `'text'`, `'json'`, `'arraybuffer'`, `'blob'` or `'document'`. See {@link https://xhr.spec.whatwg.org/#response-body the XHR spec}
     * for more information. Setting this will change the {@link Response Response.data} type.
     *
     * @type {string}
     * @memberof DataDefinition#
     */
    responseType = ''

    /**
     * The number of milliseconds to wait before aborting the data call.
     *
     * @type {number}
     * @memberof DataDefinition#
     */
    timeout = 0

    /**
     * Whether to send Cookies with the request.
     *
     * @type {boolean}
     * @memberof DataDefinition#
     */
    withCredentials = false

}

/**
 * Encapsulates the information used by {@link Adapter Adapters} to complete a data call.
 *
 * **WARNING:** Do not construct a Request object manually. Instead, pass a {@link DataDefinition}
 * object to {@link DataLayer#createRequest createRequest()} directly.
 *
 * **IMPORTANT:** The Request object is frozen. Any attempt to modify existing Request values
 * will result in an Error. If you need to modify a Request as part of a data pipeline, use
 * {@link https://lodash.com/docs/4.17.11#cloneDeep cloneDeep} (or similar) to make a copy of
 * the Request that can be safely modified.
 *
 * @global
 * @class
 * @hideconstructor
 * @extends DataDefinition
 */
export class Request extends DataDefinition {

    /**
     * The URL to open, constructed using {@link DataProxy#url Proxy.url()} and any
     * {@link ProxyRule ProxyRules} that match the given Request properties as well as any optional
     * parameters passed to {@link DataLayer#createRequest createRequest()}.
     *
     * @type {string}
     * @memberof Request#
     */
    url = ''

    /**
     * An optional payload to send to the URL, set when calling {@link DataLayer#createRequest createRequest()}.
     *
     * @type {*}
     * @memberof Request#
     */
    body = null

}

/**
 * Contains information returned from endpoints (typically only when an error occurs).
 * Messages should NOT be presented to end users directly (although message codes could
 * translated and presented if they provide useful guidance on how to recover from an
 * error).
 *
 * @class
 * @global
 * @hideconstructor
 */
export class Message {

    /**
     * A unique code to identify this message. May be used during
     * translation to present recovery information to the end user.
     *
     * @type {string}
     * @memberof Message#
     */
    code = ''

    /**
     * The message severity. Possible values are ERROR, FATAL, and NONE.
     *
     * @type {string}
     * @memberof Message
     */
    severity = 'NONE'

    /**
     * Any additional information the server believes may be useful
     * when triaging the error later.
     *
     * @type {Array.<*>}
     * @memberof Message#
     */
    data = []

}

/**
 * Additional Response information.
 *
 * @class
 * @global
 * @hideconstructor
 */
export class MetaData {

    /**
     * Whether the response should be considered a failure.
     *
     * @type {boolean}
     * @memberof MetaData#
     */
    error = false

    /**
     * Whether the response contains cached data.
     *
     * @type {boolean}
     * @memberof MetaData#
     */
    cached = false

    /**
     * Whether the response timed out. When this is true,
     * [Response.status]{@link Response} should be 0 and `meta.error` should be true.
     *
     * @type {boolean}
     * @memberof MetaData#
     */
    timeout = false

    /**
     * Map of response headers returned by the network call.
     *
     * @memberof MetaData#
     * @type {HeadersMap}
     */
    headers = {}

    /**
     * Collection of {@link Message} instances; may be empty.
     *
     * @memberof MetaData
     * @type {Message[]}
     */
    messages = []

}

/**
 * Represents the results of an Adapter's data operation. Ensures each adapter returns
 * a consistent format to the data layer for further processing (caching, error handling,
 * etc.).
 *
 * **NOTE:** This entire object should be serializable (i.e. no functions or complex built-in
 * objects) so the caching layer can retrieve the full Response on subsequent calls.
 *
 * @class
 * @global
 * @hideconstructor
 */
export class Response {

    /**
     * The response payload; may be `null`. Can be modified by setting `'responseType`'
     * on the {@link DataDefinition} object. See {@link https://xhr.spec.whatwg.org/#the-response-attribute the spec}
     * for more information on the types that can be returned.
     *
     * @memberof Response
     * @type {*}
     */
    data = null

    /**
     * A standard status code the {@link DataLayer#fetch} method will
    * examine to determine how to proceed. For example, a status code of 0 indicates an aborted
    * request and may prompt network diagnostics or a dialog prompting the user to restore their
    * network connection.
     *
     * @type {number}
     * @memberof Response#
     */
    status = 0

    /**
     * A message that will be used to generate an Error message,
     * if [`meta.error`]{@link MetaData#error} is `true`.
     *
     * @type {string}
     * @memberof Response#
     */
    statusText = ''

    /**
     * Additional information about the response.
     *
     * @memberof Response#
     * @type {MetaData}
     */
    meta = {}
}

/**
 * Contains the minimum functionality necessary to convert a
 * {@link DataDefinition} object into a {@link Request} and to
 * execute that Request against an {@link Adapter}, returning
 * a {@link Response} with the requested data.
 *
 * @class
 * @global
 * @hideconstructor
 */
export class DataLayer {

    /**
    * Converts a {@link Request} into a {@link Response} by running the
    * request through an appropriate {@link Adapter}.
    *
    * @async
    * @method DataLayer#fetch
    * @param {Request} request The Request to pass to an {@link Adapter}
    * and convert into a {@link Response}.
    * @returns {Promise.<Response>} Information about the data operation.
    * @throws Adapter not found.
    * @throws Invalid request passed to fetch.
    * @throws (if the Response.status is not 2xx)
    * @example
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
    */
    fetch(request) { }

    /**
     * Converts a {@link DataDefinition} object into a {@link Request} object that can be
     * passed to {@link DataLayer#fetch fetch}. The {@link Proxy} passed to
     * {@link module:data.createDataLayer createDataLayer} will be used to fill out the
     * Request using any configured {@link ProxyRule ProxyRules}.
     *
     * Keeping your data definition objects separate from request objects enables us to
     * construct dynamic requests based on ProxyRules set at runtime. This means we can change
     * the endpoints and protocols using configuration data rather than code.
     *
     * @method DataLayer#createRequest
     * @param {DataDefinition} definition The DataDefinition to convert into a Request using ProxyRules.
     * @param {Object<string, any>} [params={}] Optional parameters used to tokenize the URL or to append to the QueryString.
     * @param {*} [body=null] Optional data to send with the request.
     * @returns {Request} A fully formed Request that can be passed to {@link DataLayer#fetch fetch}.
     * @throws A valid DataDefinition object must be passed to createRequest.
     * @example
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
     * @example
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
     */
    createRequest(definition, params, body) { }

    /**
     * Registers an {@link Adapter} with the given name. The {@link DataLayer#fetch fetch}
     * method will match the `'adapter'` value on the {@link Request} it is given with
     * any Adapters registered here.
     *
     * **NOTE:** The default adapter for a Request is the adapter used to construct the
     * data layer, which is always registered as `'default'`.
     *
     * @method DataLayer#setAdapter
     * @param {string} name The name of the Adapter to register.
     * @param {Adapter} adapter The Adapter to register.
     * @example
     * // create a custom Adapter that uses the
     * // popular Axios library to make data calls
     * // https://github.com/axios/axios
     *
     * import axios from 'axios';
     * import { cloneDeep } from 'lodash-es';
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
     *
     */
    setAdapter(name, adapter) { }

}

/**
 * Represents a single rule in a proxy instance. A Proxy rule looks like a normal {@link Request}
 * object with an additional property `match` that specifies the property values on a Request
 * instance that must match in order for the rule to be applied.
 *
 * @global
 * @class
 * @hideconstructor
 * @extends Request
 */
export class ProxyRule extends Request {

    /**
     * 'http', 'https', 'file', etc.
     *
     * @memberof ProxyRule#
     * @type {string}
     */
    protocol = ''

    /**
     * 'myapps.myserver.com', 'localhost', etc.
     *
     * @memberof ProxyRule#
     * @type {string}
     */
    host = ''

    /**
     * 80, 8080, etc.
     *
     * @memberof ProxyRule#
     * @type {number}
     */
    port = 80

    /**
     * One or more keys in a request object whose values must match
     * the given regular expression patterns.E.g.: `{base: 'cdn'}` or`{base: 'myapp', path: 'load.+'}`
     *
     * @memberof ProxyRule#
     * @type {Object.<string, string>}
     */
    match = {};

}

/**
 * The Proxy provides an intercept layer based on build- and run-time configurations to enable
 * easier local development, impersonation, dynamic endpoints, static data redirects, and user-
 * and environment-specific versioning.
 *
 * ```js
 * const proxy = data.createProxy();
 * ```
 *
 * @class
 * @global
 * @hideconstructor
 */
export class DataProxy {

    /**
     * Uses the current proxy rules to construct a URL based on the given arguments.
     *
     * @param {string|Request} base Either a Request instance, or a base value, e.g. 'cdn' or 'myapp'.
     * @param {...string} [paths] If a `string` base value is provided, one or more URL paths to combine into the final URL.
     * @returns {string} A URL with the appropriate protocol, host, port, and paths
     * given the currently configured proxy rules.
     * @example
     * const url = proxy.url('cdn', 'images', 'logo.svg');
     * @example
     * const url = proxy.url({
     *   base: 'cdn',
     *   protocol: 'https',
     *   path: '/some/path'
     * });
     * @example
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
     *
     * ```html
     *   <img src="{{ getImageURL('avatars', 'e13d429a') }}" alt="" />
     *   <!-- https://images.myserver.com:8118/avatars/e13d429a -->
     * ```
     * export function getImageURL(bucket, id) {
     *   return proxy.url('images', bucket, id);
     * }
     */
    url(base, ...paths) { }

    /**
     * Add {@link ProxyRule rules} to the proxy instance. The order rules are added determines
     * the order they are applied.
     *
     * @param {...ProxyRule} rules The rules to use to configure this proxy instance.
     * @example
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
     */
    use(...rules) { }

    /**
    * Modifies the input Request object according to any matching Proxy rules.
    * Rules are applied in the order they were added to the Proxy, so later rules will
    * always override earlier rules.
    *
    * **NOTE:** You will not typically call this method directly. Instead, the
    * DataLayer.createRequest method will invoke this function on your behalf. See
    * that method for details.
    *
    * @param {Request} request The request object whose key/value pairs will be used
    * to determine which proxy rules should be used to determine the version.
    * @returns {Request} The input Request object, with properties modified according
    * to the matching Proxy rules.
    * @see {@link DataLayer#createRequest createRequest} — invokes the apply
    * method for you
    * @example
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
    */
    apply(request) { }

}

/**
 * Map of strings representing either {@link Request} headers
 * or {@link Response} {@link MetaData meta} headers. The header name is the key
 * and the header data is the value. If you pass an array of strings as the value,
 * the strings will be combined and separated by commas.
 *
 * @global
 * @typedef {Object.<string, string|string[]>} HeadersMap
 * @example
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
 */

/**
 * @class
 * @global
 * @hideconstructor
 * @example
 * import { isString } from 'lodash-es';
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
 */
export class Transformer {

    /**
     * Enables developers to modify the data of a request prior to sending. The
     * current body data and headers map will be passed to this method, and the return
     * value will be used as the new request body data. You can also mutate the headers
     * map (e.g. by adding or deleting values) prior to the request being sent.
     *
     * @async
     * @param {*} data The payload passed to {@link DataLayer#createRequest}. Whatever
     * you return from this function will be used as the new request payload.
     * @param {HeadersMap} headers A key-value collection of header names
     * to header values. You can modify this object directly (e.g. by adding or
     * deleting values) prior to the request being sent.
     * @returns {*|Promise} The new body to send with the request.
     */
    request(data, headers) {}

    /**
    * Enables developers to modify the data of a response before it is returned
    * to callers.
    *
    * @async
    * @param {*} data The response payload returned from the server. Whatever value
    * you return from this function will replace {@link Response}.data.
    * @returns {*|Promise} The data to return to callers.
    */
    response(data) {}

}

/**
 * Provides optional overrides for XSRF cookie and header names. Can be passed to
 * {@link module:data/utils.withXSRF withXSRF} when wrapping a fetch operation.
 *
 * @class
 * @global
 * @hideconstructor
 * @example
 * import { fetch } from '~/path/to/datalayer';
 *
 * export const safeFetch = data.utils.withXSRF(fetch, {
 *   cookie: 'XSRF-MY-APP',
 *   header: 'X-XSRF-MY-APP',
 *   hosts: ['*.my-app.com']
 * });
 */
export class XSRFOptions {

    /**
     * The name of the cookie sent by the server
     * that has the user's XSRF token value.
     *
     * @type {string}
     * @memberof XSRFOptions#
     */
    cookie = 'XSRF-TOKEN'

    /**
     * The name of the request header to set. The server should ensure this value matches the user's expected XSRF token.
     *
     * @type {string}
     * @memberof XSRFOptions#
     */
    header = 'x-xsrf-token'

    /**
     * A whitelist of patterns used to determine which host
     * names the XSRF token will be sent to even when making a cross-origin request. For
     * example, a site running on `www.server.com` would not normally include the XSRF
     * token header on any requests to the `api.server.com` subdomain since the hostnames
     * don't exactly match. However, if you added `api.server.com` or `*.server.com` to
     * the hosts array (and if the port and protocol both still matched the origin's port
     * and protocol), the header would be sent.
     *
     * @memberof XSRFOptions#
     * @type {string[]}
     */
    hosts = []

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
async function RetryFunction(request, response) { }

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
async function Reconnect() { }

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
async function Reauthenticate() { }

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
async function Diagnostics(request) { }
