import get from 'lodash/get.js';
import defaults from 'lodash/defaults.js';
import conformsTo from 'lodash/conformsTo.js';
import isEmpty from 'lodash/isEmpty.js';
import isString from 'lodash/isString.js';
import isFunction from 'lodash/isFunction.js';

import { tokenize } from './utils.js';
import { error, fatal } from '../errors/index.js';

import {
    DataProxy,
    Adapter,
    DataLayer,
} from '../types/data.js';

export { createProxy } from './proxy.js';

Adapter();
class UnusedProxy extends DataProxy {}
class UnusedDataLayer extends DataLayer {}

/**
 * A Promise is an object representing the eventual completion or failure of an asynchronous operation.
 * See the links above for more information.
 *
 * @global
 * @external Promise
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise Promise}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises Using Promises}
 * @example
 * import { rethrow } from '@paychex/core/errors';
 * import { fetch, createRequest } from '../path/to/datalayer';
 *
 * const getProducts = {
 *   base: 'my-app',
 *   path: '/products/:id',
 * };
 *
 * const getFeatures = {
 *   base: 'my-app',
 *   path: '/features/:id',
 * };
 *
 * function combineResponses([ products, features ]) {
 *   return {
 *     products: products.data,
 *     features: features.data
 *   };
 * }
 *
 * export function loadAllData(id) {
 *   const params = { id };
 *   const products = createRequest(getProducts, params);
 *   const features = createRequest(getFeatures, params);
 *   return Promise.all([
 *     fetch(products),
 *     fetch(features)
 *   ])
 *     .then(combineResponses)
 *     .catch(rethrow(params));
 * }
 */

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
 * An `adapter` converts a Request into a {@link external:Promise Promise} resolved with
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
 * function withCustomErrors(fetch) {
 *   return async function useCustomErrors(request) {
 *     return await fetch(request)
 *       .catch(rethrow({ app: 'my app' }));
 *   };
 * }
 *
 * let pipeline = fetch;
 * // add custom error handling
 * pipeline = withCustomErrors(pipeline);
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
    base: isString,
    path: isNonEmptyString,
};

const REQUEST_SCHEMA = {
    url: isNonEmptyString,
    method: isNonEmptyString,
    adapter: isNonEmptyString,
};

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

function isErrorResponse(response) {
    return get(response, 'meta.error', false) ||
        get(response, 'status', 0) < 200 ||
        get(response, 'status', 0) > 299;
}

function getErrorMessage(response) {
    // some responses don't provide a statusText so we
    // may need to use the status code to create one
    const message = get(STATUS_MESSAGES, response.status, 'Unknown HTTP Error');
    return isEmpty(response.statusText) ? message : response.statusText;
}

/**
 * Creates a new DataLayer instance that can retrieve data from
 * various sources.
 *
 * @param {Proxy} proxy The Proxy to use to construct requests.
 * @param {Adapter} adapter The default adapter to use for requests.
 * @returns {DataLayer} A DataLayer that can be used to retrieve
 * data asynchronously.
 * @throws A proxy must be passed to createDataLayer.
 * @example
 * // datalayer.js
 *
 * import { createDataLayer } from '@paychex/core/data';
 * import { withHeaders } from '@paychex/core/data/utils';
 * import xhr from '@paychex/adapter-xhr';
 * import proxy from '~/path/to/my/proxy';
 *
 * const { fetch, createRequest } = createDataLayer(proxy, xhr);
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
export function createDataLayer(proxy, adapter, adapters = new Map()) {

    if (!conformsTo(proxy, PROXY_SCHEMA))
        throw error('A proxy must be passed to createDataLayer.', fatal());

    async function fetch(request) {

        if (!conformsTo(request, REQUEST_SCHEMA))
            throw error('Invalid request passed to fetch.', fatal());

        const requestedAdapter = adapters.get(request.adapter);
        if (!isFunction(requestedAdapter))
            throw error('Adapter not found.', fatal({ adapter: request.adapter }));

        const response = await requestedAdapter(request);
        if (isErrorResponse(response))
            throw error(getErrorMessage(response), { response });

        return response;

    }

    function createRequest(definition, params = {}, body = null) {

        if (!conformsTo(definition, DDO_SCHEMA))
            throw error('A valid DataDefinition object must be passed to createRequest.');

        const request = defaults({}, definition, {
            body,
            ignore: {},
            timeout: 0,
            method: 'GET',
            adapter: 'default',
            responseType: '',
            withCredentials: false,
            headers: { accept: 'application/json, text/plain, */*' },
        });

        proxy.apply(request);

        request.url = tokenize(proxy.url(request.base, request.path), params);

        return Object.freeze(request);

    }

    function setAdapter(name, instance) {
        adapters.set(name, instance);
    }

    setAdapter('default', adapter);

    return {
        fetch,
        setAdapter,
        createRequest,
    };

}