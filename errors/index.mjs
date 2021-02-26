/**
 * Provide utilities for creating application errors with
 * certain severities and optional custom information.
 *
 * ```js
 * // esm
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
 * ```
 *
* @module errors
 * @example
 * import { tracker } from '../path/to/tracker';
 * import { fetch, createRequest } from '../path/to/datalayer';
 *
 * const { rethrow, fatal } = errors;
 *
 * const operation = {
 *   base: 'my-app',
 *   path: '/settings',
 *   headers: {
 *     accept: 'application/json'
 *   }
 * };
 *
 * export async function loadAppSettings() {
 *   const request = createRequest(operation);
 *   const response = await fetch(request)
 *     .catch(rethrow(fatal({ app: 'my-app' })));
 *   return response.data;
 * }
 */

import { curry, isError, isPlainObject } from 'lodash-es';

/**
 * Indicates an Error that cannot be recovered from.
 *
 * @constant
 * @type {string}
 * @example
 * export const tracker = trackers.create((info) => {
 *   if (info.type === 'error') {
 *     const error = info.data;
 *     switch (error.severity) {
 *       case errors.ERROR:
 *       case errors.FATAL:
 *         // send to error log
 *         break;
 *       case errors.IGNORE:
 *         console.log(error.message);
 *         console.log(err.stack);
 *         break;
 *     }
 *   }
 * });
 */
export const FATAL = 'FATAL';

/**
 * Indicates an error that was unexpected but recoverable.
 *
 * @constant
 * @type {string}
 * @example
 * export const tracker = trackers.create((info) => {
 *   if (info.type === 'error') {
 *     const error = info.data;
 *     switch (error.severity) {
 *       case errors.ERROR:
 *       case errors.FATAL:
 *         // send to error log
 *         break;
 *       case errors.IGNORE:
 *         console.log(error.message);
 *         console.log(err.stack);
 *         break;
 *     }
 *   }
 * });
 */
export const ERROR = 'ERROR';

/**
 * Indicates an error that was expected and recoverable.
 *
 * @constant
 * @type {string}
 * @example
 * export const tracker = trackers.create((info) => {
 *   if (info.type === 'error') {
 *     const error = info.data;
 *     switch (error.severity) {
 *       case errors.ERROR:
 *       case errors.FATAL:
 *         // send to error log
 *         break;
 *       case errors.IGNORE:
 *         console.log(error.message);
 *         console.log(err.stack);
 *         break;
 *     }
 *   }
 * });
 */
export const IGNORE = 'NONE';

/**
 * Mixes properties into an Error instance to assist with triage and debugging.
 *
 * __NOTE:__ This method expects 2 arguments (an Error and an object literal)
 * and is curried. That means you can provide the arguments at any time. They
 * can also be provided in any order. These are all the same:
 *
 * ```javascript
 * rethrow(e, { params });
 * rethrow({ params }, e);
 * rethrow(e)({ params });
 * rethrow({ params })(e);
 * ```
 *
 * @function
 * @param {Error} error An Error to decorate and rethrow.
 * @param {{string, string}} props Properties to mix into the Error instance.
 * @throws {Error} An Error with the properties mixed in.
 * @example
 * somePromiseMethod(params)
 *   .then(handleResult)
 *   .catch(errors.rethrow({ params }));
 * @example
 * try {
 *   someMethod(params);
 * } catch (e) {
 *   errors.rethrow(e, { params });
 * }
 * @example
 * import { fetch, createRequest } from '~/path/to/data';
 * import { loadClientOperation } from '../data/clients';
 *
 * const { rethrow, fatal } = errors;
 *
 * export async function loadClientData(clientId) {
 *   const params = { clientId };
 *   const request = createRequest(loadClientOperation, params);
 *   const response = await fetch(request).catch(rethrow(fatal(params)));
 *   return response.data;
 * }
 */
export const rethrow = curry(function throwWithProps() {
    const err = Array.prototype.find.call(arguments, isError);
    const data = Array.prototype.find.call(arguments, isPlainObject);
    throw Object.assign(err, data);
}, 2);

/**
 * Creates a new Error instance with the optional key-value pairs mixed in.
 * The returned Error will have the default severity of {@link module:errors.ERROR ERROR},
 * which indicates it is unexpected but also recoverable.
 *
 * @function
 * @param {string} message The error message.
 * @param {object} [data={}] Optional data to assign to the Error.
 * @returns {Error} A new Error instance.
 * @example
 * import { isNil } from 'lodash-es';
 *
 * export function loadClientData(clientId) {
 *   if (isNil(clientId))
 *     throw errors.error('Parameter clientId is required.');
 *   // ...working logic here...
 * }
 * @example
 * // change error severity to FATAL
 * import { isNil } from 'lodash-es';
 *
 * export function loadUserPermissions(userId) {
 *   return new Promise((resolve, reject) => {
 *     if (isNil(userId))
 *       reject(errors.error('Parameter userId is required.', errors.fatal()));
 *     // ...working logic here...
 *   });
 * }
 */
export function error(message, data = {}) {
    return Object.assign(new Error(message), { severity: ERROR }, data);
}

/**
 * Returns an object literal containing the optionally specified key-value
 * pairs along with a severity of {@link module:errors.FATAL FATAL},
 * indicating an Error that cannot be recovered from.
 *
 * @function
 * @param {object} [data={}] Optional data to assign.
 * @returns {object} An object map of the optionally provided key-value pairs
 * along with a severity of {@link module:errors.FATAL FATAL}.
 * @example
 * import { isNil } from 'lodash-es';
 *
 * export function loadUserPermissions(userId) {
 *   if (isNil(userId))
 *     throw errors.error('Parameter userId is required.', errors.fatal());
 *   // ...working logic here...
 * }
 * @example
 * import { fetch, createRequest } from '~/path/to/data';
 * import { loadClientOperation } from '../data/clients';
 *
 * const { rethrow, fatal } = errors;
 *
 * export async function loadClientData(clientId) {
 *   const params = { clientId };
 *   const request = createRequest(loadClientOperation, params);
 *   const response = await fetch(request).catch(rethrow(fatal(params)));
 *   return response.data;
 * }
 */
export function fatal(data = {}) {
    return Object.assign({}, data, { severity: FATAL });
}

/**
 * Returns an object literal containing the optionally specified key-value
 * pairs along with a severity of {@link module:errors.IGNORE IGNORE},
 * indicating an Error that was expected and can be safely ignored.
 *
 * @function
 * @param {object} [data={}] Optional data to assign.
 * @returns {object} An object map of the optionally provided key-value pairs
 * along with a severity of {@link module:errors.IGNORE IGNORE}.
 * @example
 * import { isNil } from 'lodash-es';
 *
 * const { error, ignore, rethrow } = errors;
 * const cache = stores.memoryStore();
 *
 * export async function cacheResults(key, data) {
 *   if (isNil(key))
 *     throw error('Argument key not provided.', ignore());
 *   return await cache.set(key, data)
 *     .catch(rethrow(ignore({ key })));
 * }
 */
export function ignore(data = {}) {
    return Object.assign({}, data, { severity: IGNORE });
}
