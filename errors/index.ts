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
 * ```js
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
 * ```
 */

import { curry, isError, isPlainObject } from 'lodash';

export type Properties = Record<string, any>;
export type ErrorProperties = Properties & { severity: string };
export type SeverityError = Error & ErrorProperties;

/**
 * Indicates an Error that cannot be recovered from.
 *
 * @constant
 * @example
 * ```js
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
 * ```
 */
export const FATAL = 'FATAL';

/**
 * Indicates an error that was unexpected but recoverable.
 *
 * @constant
 * @example
 * ```js
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
 * ```
 */
export const ERROR = 'ERROR';

/**
 * Indicates an error that was expected and recoverable.
 *
 * @constant
 * @example
 * ```js
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
 * ```
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
 * @param error An Error to decorate and rethrow.
 * @param} props Properties to mix into the Error instance.
 * @throws An Error with the properties mixed in.
 * @example
 * ```js
 * somePromiseMethod(params)
 *   .then(handleResult)
 *   .catch(errors.rethrow({ params }));
 * ```
 * @example
 * ```js
 * try {
 *   someMethod(params);
 * } catch (e) {
 *   errors.rethrow(e, { params });
 * }
 * ```
 * @example
 * ```js
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
 * ```
 */
export const rethrow = curry<Error|Properties, Error|Properties, never>(
    function throwWithProps(_1: Error|Properties, _2: Error|Properties) {
        const err: Error = Array.prototype.find.call(arguments, isError);
        const data: Properties = Array.prototype.find.call(arguments, isPlainObject);
        throw Object.assign(err, data);
    }, 2);

function enumerable(value: string) {
    return {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
    };
}

/**
 * Creates a new Error instance with the optional key-value pairs mixed in.
 * The returned Error will have the default severity of {@link ERROR},
 * which indicates it is unexpected but also recoverable.
 *
 * @param message The error message.
 * @param data Optional data to assign to the Error.
 * @returns A new Error instance.
 * @example
 * ```js
 * import { isNil } from 'lodash';
 *
 * export function loadClientData(clientId) {
 *   if (isNil(clientId))
 *     throw errors.error('Parameter clientId is required.');
 *   // ...working logic here...
 * }
 * ```
 * @example
 * ```js
 * // change error severity to FATAL
 * import { isNil } from 'lodash';
 *
 * export function loadUserPermissions(userId) {
 *   return new Promise((resolve, reject) => {
 *     if (isNil(userId))
 *       reject(errors.error('Parameter userId is required.', errors.fatal()));
 *     // ...working logic here...
 *   });
 * }
 * ```
 */
export function error<T extends Properties>(message: string, data: T = null): SeverityError & T {
    const err = new Error(message);
    Object.defineProperties(err, {
        name: enumerable(err.name),
        stack: enumerable(err.stack),
        message: enumerable(err.message),
    });
    return Object.assign(err, { severity: ERROR }, data);
}

/**
 * Returns an object literal containing the optionally specified key-value
 * pairs along with a severity of {@link FATAL},
 * indicating an Error that cannot be recovered from.
 *
 * @param data Optional data to assign.
 * @returns An object map of the optionally provided key-value pairs
 * along with a severity of {@link FATAL}.
 * @example
 * ```js
 * import { isNil } from 'lodash';
 *
 * export function loadUserPermissions(userId) {
 *   if (isNil(userId))
 *     throw errors.error('Parameter userId is required.', errors.fatal());
 *   // ...working logic here...
 * }
 * ```
 * @example
 * ```js
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
 * ```
 */
export function fatal(data: Properties = {}): ErrorProperties {
    return Object.assign({}, data, { severity: FATAL });
}

/**
 * Returns an object literal containing the optionally specified key-value
 * pairs along with a severity of {@link IGNORE},
 * indicating an Error that was expected and can be safely ignored.
 *
 * @param data Optional data to assign.
 * @returns An object map of the optionally provided key-value pairs
 * along with a severity of {@link IGNORE}.
 * @example
 * ```js
 * import { isNil } from 'lodash';
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
 * ```
 */
export function ignore(data: Properties = {}): ErrorProperties {
    return Object.assign({}, data, { severity: IGNORE });
}
