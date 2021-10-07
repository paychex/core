/**
 * Contains information about a failed validation.
 *
 * @class
 * @global
 * @extends Error
 * @hideconstructor
 */
export class ValidationError extends Error {

    /**
     * The value that was invalid.
     *
     * @type {any}
     * @memberof ValidationError#
     */
    proposed = null

    /**
     * The current value of whatever is being validated, if known.
     *
     * @type {any}
     * @memberof ValidationError#
     */
    current = null

}

/**
 * Contains information about a failed validation.
 *
 * @class
 * @global
 * @extends ValidationError
 * @hideconstructor
 */
export class AggregateValidationError extends ValidationError {

    /**
     * The nested validation errors that caused this validation to fail, if any exists.
     *
     * @type {ValidationError[]}
     * @memberof AggregateValidationError#
     */
    inner = []

}

/**
 * Function used to ensure a value conforms to a specific rule.
 *
 * @global
 * @async
 * @function Validator
 * @template ErrorType
 * @param {*} proposed The value to validate.
 * @param {*} [current] The current value, if known.
 * @param {*} [source] The source of the value change, if available.
 * @returns {Promise<any,ErrorType>} A promise that is rejected if the value is not valid.
 * @example
 * export function valueMatches(field, message) {
 *   // return a validator that matches the given value
 *   // against another value in the source object; if
 *   // they aren't equal, throws a ValidationError
 *   return async function valuesMatch(proposed, current, source) {
 *     if (!isEqual(proposed, get(source, field)))
 *       throw errors.error(message, {
 *         field,
 *         current,
 *         proposed,
 *         name: 'ValidationError',
 *       });
 *   };
 * }
 *
 * // usage:
 * const signup = validators.object({
 *   email: validators.string('email is required'),
 *   confirm: valueMatches('email', 'emails do not match'),
 * });
 */
export async function Validator(proposed, current, source) {
    return Promise.resolve();
}
