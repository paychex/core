/**
 * Provide utilities for handling application errors.
 *
 * @module errors
 */

import curry from 'lodash/curry';
import isError from 'lodash/isError';
import isPlainObject from 'lodash/isPlainObject';

const rethrow = curry(function throwWithProps() {
    const error = Array.prototype.find.call(arguments, isError);
    const data = Array.prototype.find.call(arguments, isPlainObject);
    throw Object.assign(error, data);
}, 2);

export {

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
     */
    rethrow

};