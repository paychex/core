import get from 'lodash/get';
import defaults from 'lodash/defaults';
import conformsTo from 'lodash/conformsTo';
import isEmpty from 'lodash/isEmpty';
import isString from 'lodash/isString';
import isFunction from 'lodash/isFunction';

import { xhr } from './xhr';
import { tokenize } from './utils';
import { error, fatal } from '../errors';

export { createProxy } from './proxy';

/**
 * Provides methods for creating and configuring a data layer, providing applications
 * the ability to invoke data operations for various endpoints.
 *
 * **Basic Concepts**
 *
 * A `proxy` is a runtime set of {@link ProxyRule rules} that will be applied (in order)
 * to transform {@link Request Requests} prior to sending them to an {@link Adapter}.
 * You can configure the proxy rules at any time.
 *
 * A `data pipeline` is a sequence of steps whose job is to retrieve data. For that
 * reason, even the simplest data pipeline requires these 3 steps:
 *
 * 1. convert a {@link DataDefinition} object into a {@link Request}
 * 2. pass that Request to the appropriate {@link Adapter}, which will
 * 3. perform an operation (typically a network call) and return a {@link Response}
 *
 * The `@paychex/core/data` module contains a factory method that creates a
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
 * {@link module:data/utils @paychex/core/data/utils} module.
 *
 * Combine functions from both modules to create a generic data pipeline that meets your
 * most common needs. Consumers of your pipeline can bolt on additional wrapping functions
 * to meet their unique requirements.
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
 * @module data
 */

const isNonEmptyString = value => isString(value) && !isEmpty(value);

const PROXY_SCHEMA = {
    url: isFunction,
    apply: isFunction,
};

const DDO_SCHEMA = {
    base: isNonEmptyString,
    path: isNonEmptyString,
};

const REQUEST_SCHEMA = {
    url: isNonEmptyString,
    method: isNonEmptyString,
    adapter: isNonEmptyString,
};

function isErrorResponse(response) {
    return get(response, 'meta.error', false) ||
        get(response, 'status', 0) < 200 ||
        get(response, 'status', 0) > 299;
}

/**
 * Contains the minimum functionality necessary to convert a
 * {@link DataDefinition} object into a {@link Request} and to
 * execute that Request against an {@link Adapter}, returning
 * a {@link Response} with the requested data.
 *
 * @global
 * @interface DataLayer
 */

/**
 * Metadata used to construct a {@link Request} instance.
 *
 * @global
 * @typedef {object} DataDefinition
 * @property {string} base Used by the Proxy to determine a base path.
 * @property {string} path Combined with the base path to construct a full URL.
 * @property {string} [adapter='xhr'] The adapter to use to complete the request.
 * @property {HeadersMap} [headers={accept: 'application/json'}] The HTTP headers to use on the request.
 * @property {object} [ignore={}] Can be used to skip certain behaviors. See documentation for details.
 * @property {string} [method='GET'] The HTTP verb to use.
 * @property {number} [timeout=0] The number of milliseconds to wait before aborting the data call.
 * @property {boolean} [withCredentials=false] Whether to send Cookies with the request.
 */

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
 * @typedef {DataDefinition} Request
 * @property {string} url The URL to open, constructed using {@link Proxy#url Proxy.url()} and any
 * {@link ProxyRule ProxyRules} that match the given Request properties as well as any optional
 * parameters passed to {@link DataLayer#createRequest createRequest()}.
 * @property {*} body An optional payload to send to the URL, set when calling {@link DataLayer#createRequest createRequest()}.
 */

/**
 * Contains information returned from endpoints (typically only when an error occurs).
 * Messages should NOT be presented to end users directly (although message codes could
 * translated and presented if they provide useful guidance on how to recover from an
 * error).
 *
 * @global
 * @typedef {object} Message
 * @property {string} code A unique code to identify this message. May be used during
 * translation to present recovery information to the end user.
 * @property {string} [severity=NONE] The message severity. Possible values are ERROR,
 * FATAL, and NONE.
 * @property {Array.<*>} data Any additional information the server believes may be useful
 * when triaging the error later.
 */

/**
 * Additional Response information.
 *
 * @global
 * @typedef {object} MetaData
 * @property {boolean} error Whether the response should be considered a failure.
 * @property {boolean} cached Whether the response contains cached data.
 * @property {boolean} timeout Whether the response timed out. When this is true,
 * [Response.status]{@link Response} should be 0 and `meta.error` should be true.
 * @property {HeadersMap} headers Map of response headers returned by the network call.
 * @property {Message[]} messages Collection of {@link Message} instances; may be empty.
 */

/**
 * Represents the results of an Adapter's data operation. Ensures each adapter returns
 * a consistent format to the data layer for further processing (caching, error handling,
 * etc.).
 *
 * **NOTE:** This entire object should be serializable (i.e. no functions or complex built-in
 * objects) so the caching layer can retrieve the full Response on subsequent calls.
 *
 * @global
 * @typedef {object} Response
 * @property {*} data The response payload; may be `null`.
 * @property {number} status A standard status code the {@link DataLayer.fetch} method will
 * examine to determine how to proceed. For example, a status code of 0 indicates an aborted
 * request and may prompt network diagnostics or a dialog prompting the user to restore their
 * network connection.
 * @property {string} statusText A message that will be used to generate an Error message,
 * if [`meta.error`]{@link MetaData.error} is `true`.
 * @property {MetaData} meta Additional information about the response.
 */

/**
 * Processes a Request and returns a Promise resolving to a Response object.
 *
 * @async
 * @global
 * @callback Adapter
 * @param {Request} request The data operation request to fulfill.
 * @returns {Promise<Response>} A Promise resolved with a Response instance.
 */

/**
 * Creates a new DataLayer instance that can retrieve data from
 * various sources.
 *
 * @function
 * @param {Proxy} proxy The Proxy to use to construct requests.
 * @returns {DataLayer} A DataLayer that can be used to retrieve
 * data asynchronously.
 * @throws A proxy must be passed to createDataLayer.
 * @example
 * // datalayer.js
 *
 * import { createDataLayer } from '@paychex/core/data';
 * import proxy from '~/path/to/my/proxy';
 *
 * const { fetch, createRequest } = createDataLayer(proxy);
 *
 * // we can extend the base functionality of fetch before
 * // returning it to consumers:
 *
 * const pipeline = withHeaders(fetch, {
 *   'x-app-platform': 'android',
 *   'content-type': 'application/json'
 * });
 *
 * export {
 *   createRequest,
 *   fetch: pipeline
 * }
 */
export function createDataLayer(proxy, adapters = new Map()) {

    if (!conformsTo(proxy, PROXY_SCHEMA))
        throw error('A proxy must be passed to createDataLayer.', fatal());

    /**
     * Converts a {@link Request} into a {@link Response} by running the
     * request through an appropriate {@link Adapter}.
     *
     * @async
     * @function DataLayer#fetch
     * @param {Request} request The Request to pass to an {@link Adapter}
     * and convert into a {@link Response}.
     * @returns {Promise.<Response>} Information about the data operation.
     * @throws Adapter not found.
     * @throws Invalid request passed to fetch.
     * @throws (if the Response.status is not 2xx)
     * @example
     * import { createDataLayer } from '@paychex/core/data';
     * import tracker from '~/path/to/tracker';
     * import proxy from '~/path/to/proxy';
     *
     * // NOTE: you will probably already have access to
     * // a datalayer and not need to create one yourself
     * const { fetch, createRequest } = createDataLayer(proxy);
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
    async function fetch(request) {

        if (!conformsTo(request, REQUEST_SCHEMA))
            throw error('Invalid request passed to fetch.', fatal());

        const adapter = adapters.get(request.adapter);
        if (!isFunction(adapter))
            throw error('Adapter not found.', fatal({ adapter: request.adapter }));

        const response = request.response = await adapter(request);
        if (isErrorResponse(response))
            throw error(response.statusText, response);

        return response;

    }

    /**
     * Converts a {@link DataDefinition} object into a {@link Request} object that can be
     * passed to {@link DataLayer#fetch fetch}. The {@link Proxy} passed to
     * {@link module:data.createDataLayer createDataLayer} will be used to fill out the
     * Request using any configured {@link ProxyRule ProxyRules}.
     *
     * Keeping your data definition objects separate from request objects enables us to
     * construct dynamic requests based on Proxy data at runtime. This means we can change
     * the endpoints and protocols using configuration data rather than code.
     *
     * @function DataLayer#createRequest
     * @param {DataDefinition} definition The DataDefinition to convert into a Request using ProxyRules.
     * @param {object} [params={}] Optional parameters used to tokenize the URL or to append to the QueryString.
     * @param {*} [body=undefined] Optional data to send with the request.
     * @returns {Request} A fully formed Request that can be passed to {@link DataLayer#fetch fetch}.
     * @throws A valid DataDefinition object must be passed to createRequest.
     * @example
     * import { createPatch } from 'some/json-patch/library';
     * import { rethrow, fatal } from '@paychex/core/errors';
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
     *   const response = await fetch(request).catch(rethrow(fatal(params)));
     *   return response.data;
     * }
     */
    function createRequest(definition, params = {}, body = undefined) {

        if (!conformsTo(definition, DDO_SCHEMA))
            throw error('A valid DataDefinition object must be passed to createRequest.');

        const request = defaults({}, definition, {
            body,
            ignore: {},
            timeout: 0,
            method: 'GET',
            adapter: 'xhr',
            withCredentials: false,
            headers: { accept: 'application/json' },
        });

        proxy.apply(request);

        request.url = tokenize(proxy.url(request.base, request.path), params);

        return Object.freeze(request);

    }

    /**
     * Registers an {@link Adapter} with the given name. The {@link DataLayer#fetch fetch}
     * method will match the `'adapter'` value on the {@link Request} it is given with
     * any Adapters registered here.
     *
     * **NOTE:** The default adapter for a Request is `'xhr'`. If you do not specify
     * your own adapter on the {@link DataDefinition} object used to create a Request then
     * `'xhr'` will be used. A built-in XHR adapter is registered automatically with each new
     * DataLayer instance. You only need to register your own Adapter if you want to use
     * a mechanism other than an XMLHttpRequest to make network calls (e.g. the Fetch API
     * or a 3rd-party library like Axios).
     *
     * @function DataLayer#setAdapter
     * @param {string} name The name of the Adapter to register.
     * @param {Adapter} adapter The Adapter to register.
     * @example
     * // create a custom Adapter that uses the
     * // popular Axios library to make data calls
     * // https://github.com/axios/axios
     *
     * import axios from 'axios';
     * import cloneDeep from 'lodash/cloneDeep';
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
    function setAdapter(name, adapter) {
        adapters.set(name, adapter);
    }

    setAdapter('xhr', xhr);

    return {
        fetch,
        setAdapter,
        createRequest,
    };

}