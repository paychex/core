import tokenize from './Tokenizer';

const ABORTED = 0;
const AUTH_ERROR = 401;
const VALIDATION_ERROR = 422;
const VERSION_MISMATCH = 505;

function getError(message, props = {}) {
    const error = new Error(message);
    return Object.assign(error, props);
}

function verifyResponse(response) {
    // TODO: decide whether to bring in a validation library
    //  - only useful if we need runtime validation in multiple places
    if (!response) throw getError('A Response object is expected.');
    const reqResp = ['status', 'statusText', 'meta', 'data'].find(prop => !(prop in response));
    if (reqResp) throw getError('Response object is missing a required field.', {field: reqResp});
    const reqMeta = ['error', 'cached', 'messages'].find(prop => !(prop in response.meta));
    if (reqMeta) throw getError('Response meta object is missing a required field.', {field: reqMeta});
}

/**
 * Enables developers to modify the data of a request prior to sending. The
 * current body data and headers map will be passed to this method, and the return
 * value will be used as the new request body data. You can also mutate the headers
 * map (e.g. by adding or deleting values) prior to the request being sent.
 * 
 * @callback RequestTransform
 * @param {*} data
 * @param {Object.<string, string>} headers
 * @returns {?*} The new body to send with the request.
 */

/**
 * Enables developers to modify the data of a response before it is returned
 * to callers.
 * 
 * @callback ResponseTransform
 * @param {*} data
 * @returns {?*} The data to return to callers.
 */

 /**
  * Tells the data layer how to cache GET Responses. Subsequent fetches with the
  * same cache key will be returned from cache while the caching period is valid,
  * preventing unnecessary data calls. If not specified on a DDO, the default
  * cache key will be the full request URL (including the querystring).
  * 
  * @typedef {Object} CacheMap
  * @property {string} key The key used to store the Response.
  * @property {string} method Either 'store' or 'session'.
  * @property {boolean} encrypt Whether to encrypt the cached Response.
  * @property {(number|Date)} expires Only applies when method=store. The number
  * of minutes the Response should be considered valid, or the date on which the
  * Response should be expired.
  */

/**
 * Encapsulates the information used by Adapters to complete a data call.
 * 
 * @typedef {Object} Request
 * @property {string} adapter
 * @property {string} url
 * @property {string} version
 * @property {string} method
 * @property {boolean} withCredentials
 * @property {*} body
 * @property {RequestTransform} transformRequest
 * @property {ResponseTransform} transformResponse
 * @property {CacheMap} cache
 * @property {Object.<string, *>} ignore
 * @property {Object.<string, string>} headers
 */

/**
 * Contains information returned from endpoints (typically only when an error occurs).
 * Messages should NOT be presented to end users directly (although message codes could
 * translated and presented if they provide useful guidance on how to recover from an
 * error). A `messages` collection will be added to the Error instance the fetch Promise
 * is rejected with.
 * 
 * @typedef {Object} Message
 * @property {string} code A unique code to identify this message. May be used during
 * translation to present recovery information to the end user.
 * @property {string} [severity=NONE] The message severity. Possible values are ERROR,
 * CRITICAL_ERROR, and NONE.
 * @property {Array.<*>} data Any additional information the server believes may be useful
 * when triaging the error later.
 */

/**
 * Additional Response information.
 * 
 * @typedef {Object} MetaData
 * @property {boolean} error
 * @property {cached} boolean
 * @property {Message[]} messages
 */

/**
 * Represents the results of an Adapter's data operation. Ensures each adapter returns
 * a consistent format to the data layer for further processing (caching, error handling,
 * etc.).
 * 
 * NOTE: This entire object should be serializable (i.e. no functions or complex built-in
 * objects) so the caching layer can retrieve the full Response on subsequent calls.
 * 
 * @typedef {Object} Response
 * @property {*} data
 * @property {string} status
 * @property {string} statusText
 * @property {MetaData} meta
 */

/**
 * Processes a Request and returns a Promise resolving to a Response object.
 * Responsible for all data calls to endpoints of a specific type.
 * 
 * @async
 * @callback Adapter
 * @param {Request} request The data operation request to fulfill.
 * @param {Proxy} proxy The Proxy instance used to construct the request.
 * @returns {Promise<Response>} A Promise resolved with a Response instance.
 */

/**
 * Provides end-to-end data operations for Paychex applications.
 * 
 * @class DataLayer
 * @hideconstructor
 */

/**
 * Stores and retrieves Response objects.
 * 
 * @class Cache
 * @hideconstructor
 */

/**
 * Retrieves a Response object from the cache. You should return
 * undefined if the specified request does not specify to use the
 * cache or if the cached value is expired or invalid. Do NOT
 * reject the returned Promise.
 * 
 * @async
 * @method Cache#get
 * @param {Request} request
 * @param {Proxy} proxy
 * @returns {Promise<?Response>}
 */

/**
 * Stores a Response object in the cache. You should not cache
 * the specified response if the request does not specify to use
 * the cache or if the response does not want to be cached. Do
 * NOT reject the returned Promise.
 * 
 * @async
 * @method Cache#set
 * @param {Request} request
 * @param {Response} response
 * @param {Proxy} proxy
 * @returns {Promise}
 */

/**
 * Invoked when a network connection is lost. Should resolve when the
 * network connection is re-established. NOTE: This method may be called
 * multiple times while the connection is down; its logic should handle
 * this scenario (e.g. only showing a dialog to the user once per outage).
 * 
 * @async
 * @callback Reconnect
 * @returns {Promise}
 */

/**
 * Invoked when a connection to Paychex is aborted but the user has a
 * connection to the Internet. NOTE: This method may be called multiple
 * times; its logic should ensure it only runs diagnostics once. Also,
 * this method is responsible for logging results (or for caching the
 * results if a connection to Paychex could not be established).
 * 
 * @callback Diagnostics
 * @param {Request} request
 */

/**
 * Invoked when an endpoint returns a 505 error code, indicating there
 * is a version mismatch between the client's expected endpoint version
 * and the actual endpoint version. NOTE: This method may be called
 * multiple times, so logic for how frequently to notify the user (e.g.
 * once per session vs. once per endpoint) should be implemented.
 * 
 * @callback Upgrade
 * @param {Request} request
 * @param {Response} response
 */

/**
 * A map of dependencies used by the DataLayer. It is the responsibility
 * of the creator/consumer of the DataLayer to provide the necessary
 * functionality.
 * 
 * @typedef {Object} Configuration
 * @property {Proxy} proxy
 * @property {Cache} cache
 * @property {Upgrade} upgrade
 * @property {Reconnect} reconnect
 * @property {Diagnostics} diagnostics
 */

/**
 * Constructs a new DataLayer instance using the specified Configuration.
 * 
 * @exports data/DataLayer
 * @param {Configuration} config The configuration to use.
 * @returns {DataLayer}
 * @example
 * import {createDataLayer} from '@paychex/core/data'
 * import {proxy, cache, upgrade, reconnect, diagnostics} from '~/config/data'
 * const dataLayer = createDataLayer({
 *   proxy,
 *   cache,
 *   upgrade,
 *   reconnect,
 *   diagnostics
 *  });
 */
export default function createDataLayer({
    proxy,
    cache,
    upgrade,
    reconnect,
    diagnostics
}) {

    if (!proxy) throw getError('Creating a new data layer requires a proxy.');
    if (!cache) throw getError('Creating a new data layer requires a cache.');
    if (!upgrade) throw getError('Creating a new data layer requires an upgrade method.');
    if (!reconnect) throw getError('Creating a new data layer requires a reconnect method.');
    if (!diagnostics) throw getError('Creating a new data layer requires a diagnostics method.');

    const adapters = new Map();
    
    async function connected() {
        if (!window.navigator.onLine)
            await reconnect();
    }

    /**
     * Performs a data operation for the given Request instance.
     * 
     * @async
     * @param {Request} request The request to send to a associated adapter.
     * @returns {Promise<*>} A Promise resolved with data from the response.
     * The response object will be set on the original request if you need to
     * inspect specific response values other than the data (e.g. headers).
     * @memberof DataLayer.prototype
     * @example
     * import { fetch, createRequest } from '@paychex/core/data'
     * import { myDDO } from './data'
     * 
     * function getData(params, data) {
     *   const request = createRequest(myDDO, params, data);
     *   return fetch(request).then(data => {
     *     console.log('success!', data);
     *     return data;
     *   });
     * }
     * @example
     * import { fetch, createRequest } from '@paychex/core/data'
     * import { ddoSaveWorker } from './data/workers'
     * 
     * async function saveWorker(worker) {
     *   const request = createRequest(ddoSaveWorker, {id: worker.id}, worker);
     *   try {
     *     await fetch(request);
     *   } catch (e) {
     *     const response = request.response;
     *     console.log('saveWorker error', response.statusText, e);
     *   }
     * }
     */
    async function fetch(request) {

        let response;
        if (response = await cache.get(request, proxy))
            return response.data;

        const adapter = adapters.get(request.adapter);
        if (!adapter) throw getError('Requested adapter type not found.', {adapter: request.adapter});

        await connected();

        let attemptCount = 0,
            authCount = 0;

        while (++attemptCount) {

            response = await adapter(request, proxy);
            if (verifyResponse(response))
                request.response = response;

            if (response.status >= 200 && response.status < 300) {
                if (request.method === 'GET' && !response.meta.error)
                    await cache.set(request, response, proxy);
                return response.data;
            } else if (response.status === AUTH_ERROR) {
                if (++authCount > 1) break;
                await proxy.auth(true);
                continue;
            } else if (response.status === VALIDATION_ERROR) {
                break;
            } else if (response.status === VERSION_MISMATCH) {
                upgrade(request, response);
                break;
            } else if (response.status <= ABORTED && window.navigator.onLine) {
                diagnostics(request);
                continue;
            } else if (response.status <= ABORTED && !window.navigator.onLine) {
                await connected();
                continue;
            } else if (request.retry && attemptCount <= request.retry) {
                continue;
            } else {
                break;
            }

        }

        const error = response.error = getError(response.statusText, {
            status: response.status,
            meta: response.meta
        });

        throw error;

    }

    /**
     * Converts the Data Definition Object into a Request instance. You can
     * pass the returned Request instance directly to the `fetch` method.
     * 
     * @param {Object} ddo The data definition object to transform.
     * @param {Object} [params] Optional parameters. Parameter values will be
     * used to tokenize the URL; any untokenized values will be appended to
     * the URL as the querystring.
     * @param {*} [body] Optional data to send with your request.
     * @returns {Request} A Request instance.
     * @memberof DataLayer.prototype
     * @example
     * import { createRequest } from '@paychex/core/data'
     * // ...import ddo, create params and data...
     * const request = createRequest(ddo, params, data);
     * @example
     * import { createRequest } from '@paychex/core/data'
     * const request = createRequest(ddo, {id: '001235'});
     * @example
     * import { createRequest } from '@paychex/core/data'
     * const payload = { ... };
     * const request = createRequest(ddo, null, payload);
     */
    function createRequest(ddo, params = {}, body = undefined) {
        const version = proxy.version(ddo);
        const url = tokenize(proxy.url(ddo.base, ddo.path), {...params});
        const key = `${url}@${version || 'latest'}`;
        return {
            method: 'GET',
            withCredentials: false,
            ...ddo,
            url,
            version,
            ignore: { ...ddo.ignore },
            headers: { ...ddo.headers },
            cache: { key, ...ddo.cache },
            body
        };
    }

    /**
     * Assigns an Adapter instance for the specified type. Any Request objects
     * whose `adapter` value matches the specified type will be routed through
     * this Adapter instance.
     * 
     * @param {string} type The adapter type to register, e.g. '@paychex/rest'
     * @param {Adapter} adapter The adapter to assign to the given type.
     * @memberof DataLayer.prototype
     * @example
     * import { setAdapter } from '@paychex/core/data'
     * setAdapter('@paychex/myproject', function MyAPIAdapter(request, proxy) {
     *   return new Promise(function RestEndpointPromise(resolve) {
     *     // do data call
     *     // always resolve with a Response object
     *     // never reject this promise or throw an Error
     *   });
     * });
     * // later...
     * const request = createRequest({
     *   adapter: '@paychex/myproject',
     *   url: 'path/to/endpoint'
     * });
     * @example
     * import { setAdapter } from '@paychex/core/data'
     * setAdapter('@paychex/myproject', async function MyAPIAdapter(request, proxy) {
     *   try {
     *     const response = await someXHRMethod(request);
     *     const {status, statusText} = response;
     *     const data = await response.json();
     *     return {
     *       data,
     *       status,
     *       statusText,
     *       meta: {}
     *     };
     *   } catch (e) {
     *     return {
     *       data: undefined,
     *       status: e.status,
     *       statusText: e.message,
     *       meta: {
     *         error: true
     *       }
     *     };
     *   }
     * });
     * // later...
     * const request = createRequest({
     *   adapter: '@paychex/myproject',
     *   url: 'path/to/endpoint'
     * });
     */
    function setAdapter(type, adapter) {
        adapters.set(type, adapter);
    }

    return {
        fetch,
        createRequest,
        setAdapter
    };

};
