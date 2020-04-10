/**
 * Provide utilities for creating application errors with
 * certain severities and optional custom information.
 *
 * @module errors
 * @example
 * import { rethrow, fatal } from '@paychex/core/errors';
 * import { tracker } from '../path/to/tracker';
 * import { fetch, createRequest } from '../path/to/datalayer';
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

import curry from 'lodash/curry.js';
import isError from 'lodash/isError.js';
import isPlainObject from 'lodash/isPlainObject.js';

/**
 * Indicates an Error that cannot be recovered from.
 *
 * @constant
 * @type {string}
 * @example
 * import createTracker from '@paychex/core/tracker';
 * import { ERROR, IGNORE, FATAL } from '@paychex/core/errors';
 *
 * export const tracker = createTracker((info) => {
 *   if (info.type === 'error') {
 *     const error = info.data;
 *     switch (error.severity) {
 *       case ERROR:
 *       case FATAL:
 *         // send to error log
 *         break;
 *       case IGNORE:
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
 * import createTracker from '@paychex/core/tracker';
 * import { ERROR, IGNORE, FATAL } from '@paychex/core/errors';
 *
 * export const tracker = createTracker((info) => {
 *   if (info.type === 'error') {
 *     const error = info.data;
 *     switch (error.severity) {
 *       case ERROR:
 *       case FATAL:
 *         // send to error log
 *         break;
 *       case IGNORE:
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
 * import createTracker from '@paychex/core/tracker';
 * import { ERROR, IGNORE, FATAL } from '@paychex/core/errors';
 *
 * export const tracker = createTracker((info) => {
 *   if (info.type === 'error') {
 *     const error = info.data;
 *     switch (error.severity) {
 *       case ERROR:
 *       case FATAL:
 *         // send to error log
 *         break;
 *       case IGNORE:
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
 * import { rethrow } from '@paychex/core/errors';
 *
 * somePromiseMethod(params)
 *   .then(handleResult)
 *   .catch(rethrow({ params }));
 * @example
 * import { rethrow } from '@paychex/core/errors';
 *
 * try {
 *   someMethod(params);
 * } catch (e) {
 *   rethrow(e, { params });
 * }
 * @example
 * import { rethrow, fatal } from '@paychex/core/errors';
 * import { fetch, createRequest } from '~/path/to/data';
 * import { loadClientOperation } from '../data/clients';
 *
 * export async function loadClientData(clientId) {
 *   const params = { clientId };
 *   const request = createRequest(loadClientOperation, params);
 *   const response = await fetch(request).catch(rethrow(fatal(params)));
 *   return response.data;
 * }
 */
export const rethrow = curry(function throwWithProps() {
    const error = Array.prototype.find.call(arguments, isError);
    const data = Array.prototype.find.call(arguments, isPlainObject);
    throw Object.assign(error, data);
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
 * import isNil from 'lodash/isNil';
 * import { error } from '@paychex/core/errors';
 *
 * export function loadClientData(clientId) {
 *   if (isNil(clientId))
 *     throw error('Parameter clientId is required.');
 *   // ...working logic here...
 * }
 * @example
 * // change error severity to FATAL
 * import isNil from 'lodash/isNil';
 * import { error, fatal } from '@paychex/core/errors';
 *
 * export function loadUserPermissions(userId) {
 *   return new Promise((resolve, reject) => {
 *     if (isNil(userId))
 *       reject(error('Parameter userId is required.', fatal()));
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
 * import isNil from 'lodash/isNil';
 * import { error, fatal } from '@paychex/core/errors';
 *
 * export function loadUserPermissions(userId) {
 *   if (isNil(userId))
 *     throw error('Parameter userId is required.', fatal());
 *   // ...working logic here...
 * }
 * @example
 * import { rethrow, fatal } from '@paychex/core/errors';
 * import { fetch, createRequest } from '~/path/to/data';
 * import { loadClientOperation } from '../data/clients';
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
 * import isNil from 'lodash/isNil';
 * import { sessionStore } from '@paychex/core/stores';
 * import { error, ignore, rethrow } from '@paychex/core/errors';
 *
 * const cache = sessionStore();
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
