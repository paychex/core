import tokenize from './Tokenizer';

const ABORTED = 0;
const AUTH_ERROR = 401;
const VALIDATION_ERROR = 422;
const VERSION_MISMATCH = 505;

const no = () => false;
const ignore = () => {};

function getError(message, props = {}) {
    const error = new Error(message);
    return Object.assign(error, props);
}

function verifyResponse(response) {
    if (!response) throw getError('A Response object is expected.');
    const reqResp = ['status', 'statusText', 'meta', 'data'].find(prop => !(prop in response));
    if (reqResp) throw getError('Response object is missing a required field.', {field: reqResp});
    const reqMeta = ['error', 'cached', 'messages'].find(prop => !(prop in response.meta));
    if (reqMeta) throw getError('Response meta object is missing a required field.', {field: reqMeta});
    return true;
}

/**
 * Enables developers to modify the data of a request prior to sending. The
 * current body data and headers map will be passed to this method, and the return
 * value will be used as the new request body data. You can also mutate the headers
 * map (e.g. by adding or deleting values) prior to the request being sent.
 * 
 * @callback RequestTransform
 * @param {*} data The payload passed to {@link DataLayer.createRequest}. Whatever
 * you return from this function will be used as the new request payload.
 * @param {Object.<string, string>} headers A key-value collection of header names
 * to header values. You can modify this object directly (e.g. by adding or
 * deleting values) prior to the request being sent.
 * @returns {?*} The new body to send with the request.
 */

/**
 * Enables developers to modify the data of a response before it is returned
 * to callers.
 * 
 * @callback ResponseTransform
 * @param {*} data The response payload returned from the server. Whatever value
 * you return from this function will be sent to callers instead.
 * @returns {?*} The data to return to callers.
 */

/**
 * Encapsulates the information used by Adapters to complete a data call.
 * 
 * @typedef {Object} Request
 * @property {string|Adapter} adapter The name of the adapter to use to complete this data
 * call, or a direct Adapter instance. If a name is provided, it should match the name passed
 * to {@link DataLayer.setAdapter}.
 * @property {string} url The endpoint to hit, constructed using the {@link Proxy} instance
 * passed to {@link module:data.createDataLayer}.
 * @property {string} version The version of the endpoint to invoke, constructed using the
 * {@link Proxy} instance passed to {@link module:data/createDataLayer}.
 * @property {string} method The HTTP method for the operation (e.g. 'GET', 'POST', or 'PATCH').
 * @property {boolean} withCredentials Whether to include cookies with the request.
 * @property {*} body An optional payload to send with the request.
 * @property {RequestTransform} transformRequest Enables optional transformation of the request
 * payload and/or the request headers prior to sending.
 * @property {ResponseTransform} transformResponse Enables optional transformation of the
 * response payload before passing it back to callers.
 * @property {Cache} cache An optional Cache instance with logic for if and/or when to cache
 * the adapter Response.
 * @property {Object.<string, *>} ignore A map of values that adapters may use to skip or
 * configure specific steps in the data pipeline.
 * @property {Object.<string, string>} headers A map of header names and values to send with
 * the request. This object may be modified by adapters.
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
 * FATAL, and NONE.
 * @property {Array.<*>} data Any additional information the server believes may be useful
 * when triaging the error later.
 */

/**
 * Additional Response information.
 * 
 * @typedef {Object} MetaData
 * @property {boolean} error Whether the response should be considered a failure.
 * @property {boolean} cached Whether the response contains cached data.
 * @property {boolean} timeout Whether the response timed out. When this is true,
 * [Response.status]{@link Response} should be 0 and `meta.error` should be true.
 * @property {Message[]} messages Collection of {@link Message} instances; may be empty.
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
 * @property {*} data The server payload; may be `undefined`.
 * @property {number} status A standard status code the {@link DataLayer.fetch} method will
 * examine to determine how to proceed. For example, a status code of 0 indicates an aborted
 * request and may prompt network diagnostics or a dialog prompting the user to restore their
 * network connection.
 * @property {string} statusText A message that will be used to generated an Error message,
 * if [`meta.error`]{@link MetaData.error} is `true`.
 * @property {MetaData} meta Additional information about the response.
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
 * @interface DataLayer
 */

/**
 * Stores and retrieves Response objects.
 * 
 * @interface Cache
 * @example
 * import { indexedDB } from '@paychex/core/stores'
 * 
 * const store = indexedDB({store: 'my-objects'});
 * const ignore = () => {};
 * 
 * export const cache = {
 *   async get(request, proxy) {
 *     const version = request.version && `@${request.version}` || '';
 *     const key = `${request.url}${version}`;
 *     await store.get(key).catch(ignore);
 *   },
 *   async set(request, response, proxy) {
 *     const version = request.version && `@${request.version}` || '';
 *     const key = `${request.url}${version}`;
 *     await store.set(key, response).catch(ignore);
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
 * a cache key. Typical cache keys combine the `url` and `version`
 * properties. See the example code.
 * @param {Proxy} proxy The Proxy used to construct the request `url`
 * and `version`.
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
 *   async get(request, proxy) {
 *     const version = request.version && `@${request.version}` || '';
 *     const key = `${request.url}${version}`;
 *     await store.get(key).catch(ignore);
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
 * a cache key. Typical cache keys combine the `url` and `version`
 * properties. See the example code.
 * @param {Response} response The Response to cache. This is the value
 * that should be returned from {@link Cache.get}.
 * @param {Proxy} proxy The Proxy used to handle the request.
 * @returns {Promise} A promise resolved when the value is cached.
 * @example
 * import { indexedDB } from '@paychex/core/stores'
 * 
 * const store = indexedDB({store: 'my-objects'});
 * const ignore = () => {};
 * 
 * export const cache = {
 *   async set(request, response, proxy) {
 *     const version = request.version && `@${request.version}` || '';
 *     const key = `${request.url}${version}`;
 *     await store.set(key, response).catch(ignore);
 *   }
 * }
 */

/**
 * Invoked when a network connection is lost. Should resolve when the
 * network connection is re-established. NOTE: This method may be called
 * multiple times while the connection is down; its logic should handle
 * this scenario (e.g. only showing a dialog to the user once per outage).
 * 
 * @async
 * @callback Reconnect
 * @returns {Promise} A promise that will be resolved when the user's
 * network connection is restored.
 */

/**
 * Invoked when a connection to Paychex is aborted but the user has a
 * connection to the Internet. NOTE: This method may be called multiple
 * times; its logic should ensure it only runs diagnostics once. Also,
 * this method is responsible for logging results (or for caching the
 * results if a connection to Paychex could not be established).
 * 
 * @callback Diagnostics
 * @param {Request} request The request that failed without receiving
 * a response. The user still has a network connection, so we need to
 * determine why the connection to Paychex may have failed.
 */

/**
 * Invoked when an endpoint returns a 505 error code, indicating there
 * is a version mismatch between the client's expected endpoint version
 * and the actual endpoint version. NOTE: This method may be called
 * multiple times, so logic for how frequently to notify the user (e.g.
 * once per session vs. once per endpoint) should be implemented.
 * 
 * @callback Upgrade
 * @param {Request} request The Request that returned a 505 error response.
 * @param {Response} response The Response whose status code is 505.
 */

/**
 * A map of dependencies used by the DataLayer. It is the responsibility
 * of the creator/consumer of the DataLayer to provide the necessary
 * functionality.
 * 
 * @typedef {Object} DataLayerConfiguration
 * @property {Proxy} proxy The proxy to use to construct {@link Request} objects.
 * @property {Upgrade} upgrade Method to invoke when a 505 Version Mismatch is returned from an {@link Adapter}.
 * @property {Reconnect} reconnect Method to invoke when the user's network connection fails.
 * @property {Diagnostics} diagnostics Method to invoke when a request is aborted but the user has a network connection.
 */

export default function createDataLayer({
    proxy,
    upgrade,
    reconnect,
    diagnostics
} = {}) {

    if (!proxy) throw getError('Creating a new data layer requires a proxy.');
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
     * import { fetch, createRequest } from '@paychex/landing/data'
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
     * import { fetch, createRequest } from '@paychex/landing/data'
     * import { ddoSaveWorker } from './data/workers'
     * 
     * async function saveWorker(worker) {
     *   const params = {id: worker.id};
     *   const request = createRequest(ddoSaveWorker, params, worker);
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
        if (request.cache) {
            if (response = await request.cache.get(request, proxy).catch(ignore))
                return response.data;
        }

        const adapter = adapters.get(request.adapter) || request.adapter;
        if (typeof adapter !== 'function')
            throw getError('Adapter not found.', { adapter: request.adapter });

        await connected();

        let retry,
            authCount = 0;

        do {

            retry = false;

            response = await adapter(request, proxy);
            if (verifyResponse(response))
                request.response = response;

            if (!response.meta.error) {
                if (request.cache)
                    await request.cache.set(request, response, proxy).catch(ignore);
                return response.data;
            } else if (response.status === AUTH_ERROR) {
                if (++authCount > 1)
                    break;
                await proxy.auth(true);
                retry = true;
                continue;
            } else if (response.status === VALIDATION_ERROR) {
                break;
            } else if (response.status === VERSION_MISMATCH) {
                upgrade(request, response);
                break;
            } else if (response.status <= ABORTED) {
                if (response.meta.timeout) {
                    // rely on retry logic
                } else if (window.navigator.onLine) {
                    diagnostics(request);
                    break;
                } else if (!window.navigator.onLine) {
                    await connected();
                }
            }

            if (request.retry)
                retry = await request.retry(request, response, proxy).catch(no);

        } while (retry);

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
     * import { createRequest } from '@paychex/landing/data'
     * // ...import ddo, create params and data...
     * const request = createRequest(ddo, params, data);
     * @example
     * import { createRequest } from '@paychex/landing/data'
     * const request = createRequest(ddo, {id: '001235'});
     * @example
     * import { createRequest } from '@paychex/landing/data'
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
     * import { setAdapter } from '@paychex/landing/data'
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
     * import { setAdapter } from '@paychex/landing/data'
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
