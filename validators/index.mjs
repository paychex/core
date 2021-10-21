import {
    flatten,
    get,
    isArray,
    isDate,
    isEmpty,
    isEqual,
    isFunction,
    isNil,
    isNumber,
    isPlainObject,
    isRegExp,
    isString,
    negate,
    noop,
} from 'lodash-es';

import { countdown } from '../signals/index.mjs';
import { error, rethrow } from '../errors/index.mjs';

/**
 * Contains {@link Validator} factories useful for verifying that
 * values conform to desired specifications.
 *
 * ```js
 * // esm
 * import { validators } from '@paychex/core';
 *
 * // cjs
 * const { validators } = require('@paychex/core');
 *
 * // iife
 * const { validators } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ validators }) { ... });
 * define(['@paychex/core'], function({ validators }) { ... });
 * ```
 *
 * @module validators
 */

const rxISO8601 = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(([+-]\d\d:\d\d)|Z)?$/i;

function isJSONEncoded(value) {
    return rxISO8601.test(String(value));
}

function asKeyValuePromise([property, value]) {
    const { schema, current, source } = this;
    const currentValue = get(current, property);
    const validator = get(schema, property, noop);
    return Promise.resolve(validator(value, currentValue, source))
        .catch(rethrow({ property }));
}

function asArrayEntryPromise(value, property, source) {
    const { current, validator } = this;
    return Promise.resolve(validator(value, get(current, property), source))
        .catch(rethrow({ property }));
}

function asIterationPromise(validator) {
    const { proposed, current, source } = this;
    return validator(proposed, current, source);
}

function invoke(fn) {
    return fn(this);
}

function equals(value) {
    return isEqual(value, this);
}

function isIn(key) {
    return key in this;
}

function isSubset(obj1, obj2) {
    const keys = Object.keys(obj1);
    return keys.every(isIn, obj2);
}

function isStrictSubset(lhs, rhs) {
    return isSubset(lhs, rhs) && !isSubset(rhs, lhs);
}

function validate(...predicates) {
    const value = predicates.shift();
    const message = predicates.pop();
    if (!predicates.every(invoke, value))
        throw error(message);
}

function areAllFunctions(arr) {
    return arr.every(isFunction);
}

function valuesAreFunctions(obj) {
    return areAllFunctions(Object.values(obj));
}

function attachHandlers(promise) {
    const { reject, rejections, maxRejections, signal } = this;
    promise.catch(function handleValidationError(err) {
        rejections.push(err);
        if (rejections.length >= maxRejections)
            reject(rejections);
    }).finally(signal.decrement);
}

async function AggregatePromise(resolve, reject) {
    const { promises, minRejections, maxRejections } = this;
    const rejections = [];
    const signal = countdown(promises.length);
    promises.forEach(attachHandlers, {
        reject,
        signal,
        rejections,
        maxRejections,
    });
    await signal.ready();
    if (rejections.length >= minRejections)
        return reject(rejections);
    resolve();
}

function aggregatePromise(promises, minRejections = 1, maxRejections = promises.length) {
    const context = { promises, minRejections, maxRejections };
    return new Promise(AggregatePromise.bind(context));
}

function validationError(message, data = {}) {
    return error(message, { name: 'ValidationError', ...data });
}

/**
 * Ensures an object conforms to the specified schema, where each property
 * is run against the associated Validator.
 *
 * **NOTE:** The proposed object will only be checked against the property
 * names specified in the schema. If the object has additional properties,
 * it will still be considered conforming so long as the schema is satisfied.
 * _However_, if the object has fewer properties than specified in the schema,
 * it will be considered invalid.
 *
 * @example
 * // use an empty schema to allow _any_ object type
 * const isobject = validators.object({}, 'object expected');
 *
 * // conforming
 * await isobject({ key: 'value' });
 *
 * // non-conforming
 * isobject([]).catch(console.error);
 * > ValidationError: object expected
 * @example
 * const user = validators.object({
 *   age: validators.number('age must be numeric'),
 *   name: validators.string('name must be a string'),
 * }, 'user is invalid');
 *
 * // non-object provided
 * user([]).catch(console.error);
 * > ValidationError: user is invalid
 *
 * // object is missing a `name` property,
 * // which was defined in the schema
 * user({ age: 41 }).catch(console.error);
 * > ValidationError: user is invalid
 * @example
 * const user = validators.object({
 *   age: validators.number('age must be numeric'),
 *   name: validators.string('name must be a string'),
 * }, 'user is invalid');
 *
 * // non-conforming value
 * user({
 *   age: 21,
 *   name: new Date(),
 * }).catch(console.error);
 * > ValidationError: user is invalid
 *   - inner: [ValidationError: name must be a string]
 *
 * // conforming value
 * const valid = await user({
 *   age: 21,
 *   name: 'John',
 *   created: new Date(), // not in schema; ignored
 * }).then(() => true, () => false);
 *
 * @function
 * @param {Object.<string,Validator>} schema A map of property
 * names to Validator functions. Each validator will be run for
 * the value of the associated property on the proposed object.
 * @param {string} message The error message to use if the validation fails.
 * @throws {Error} An error message must be provided.
 * @throws {Error} Schema must be an object whose values are Validator functions.
 * @returns {Validator<AggregateValidationError>} A validation function
 */
export function object(schema, message) {
    validate(message, isString, 'An error message must be provided.');
    validate(schema, isPlainObject, valuesAreFunctions, 'Schema must be an object whose values are Validator functions.');
    return async function validObject(proposed, current) {
        if (!isPlainObject(proposed) || isStrictSubset(proposed, schema))
            throw validationError(message, { proposed, current });
        try {
            const context = { schema, current, source: proposed };
            const promises = Object.entries(proposed).map(asKeyValuePromise, context);
            await aggregatePromise(promises);
        } catch (inner) {
            throw validationError(message, { proposed, current, inner });
        }
    };
}

/**
 * Ensures the value is an array and that each item in the array matches
 * the specified validator.
 *
 * @example
 * // if you do not specify a validator to apply, the
 * // value will still be validated as an array
 * const items = validators.array('items must be an array');
 *
 * // invalid
 * items({}).catch(console.log);
 * > ValidationError: items must be an array
 *
 * @example
 * const item = validators.object({
 *   sku: validators.string('sku is required'),
 *   amount: validators.number('amount is missing'),
 * });
 *
 * const cart = validators.object({
 *   items: validators.array(item, 'invalid cart items'),
 * }, 'cart is invalid');
 *
 * // non-conforming value
 * cart({
 *   items: [{ amount: 2 }], // missing sku
 * }).catch(console.error);
 * > ValidationError: cart is invalid
 *   - inner: [ValidationError: invalid cart items]
 *     - inner: [ValidationError: sku is required]
 *
 * // conforming value
 * const valid = await cart({
 *   items: [{ sku: '123', amount: 2 }]
 * }).then(() => true, () => false);
 *
 * @function
 * @param {Validator} [validator] The validation function to apply to each
 * element in the array.
 * @param {string} message The error message to use if the validation fails.
 * @throws {Error} An error message must be provided.
 * @returns {Validator<AggregateValidationError>} A validation function
 */
export function array(...args) {
    const message = args.find(isString);
    const validator = args.find(isFunction) || noop;
    validate(message, isString, 'An error message must be provided.');
    return async function validArray(proposed, current) {
        if (!isArray(proposed))
            throw validationError(message, { proposed, current });
        try {
            const context = { current, validator };
            const promises = proposed.map(asArrayEntryPromise, context);
            await aggregatePromise(promises);
        } catch (inner) {
            throw validationError(message, { proposed, current, inner });
        }
    };
}

/**
 * Ensures a value is a string.
 *
 * @example
 * const name = validators.string('name must be a string');
 *
 * // non-conforming value
 * name(123).catch(console.error);
 * > ValidationError: name must be a string
 *
 * // conforming value
 * const valid = await name('John')
 *   .then(() => true, () => false);
 *
 * // as part of object schema
 * const user = validators.object({
 *   firstname: validators.string('string firstname expected'),
 *   lastname: validators.string('string lastname expected'),
 * }, 'user is invalid');
 *
 * @function
 * @param {string} message The error message to use if the validation fails.
 * @throws {Error} An error message must be provided.
 * @returns {Validator<ValidationError>} A validation function
 */
export function string(message) {
    validate(message, isString, 'An error message must be provided.');
    return async function validString(proposed, current) {
        if (!isString(proposed))
            throw validationError(message, { proposed, current });
    };
}

/**
 * Ensures a value is a number.
 *
 * @example
 * const age = validators.number('age is required');
 *
 * // non-conforming value
 * age('123').catch(console.error);
 * > ValidationError: age is required
 *
 * // conforming value
 * const valid = await age(29)
 *   .then(() => true, () => false);
 *
 * // as part of object schema
 * const cartItem = validators.object({
 *   sku: validators.string('sku is required'),
 *   name: validators.string('item name is required'),
 *   amount: validators.number('amount is required'),
 * }, 'cart item is invalid');
 *
 * @function
 * @param {string} message The error message to use if the validation fails.
 * @throws {Error} An error message must be provided.
 * @returns {Validator<ValidationError>} A validation function
 */
export function number(message) {
    validate(message, isString, 'An error message must be provided.');
    return async function validNumber(proposed, current) {
        if (!isNumber(proposed))
            throw validationError(message, { proposed, current });
    };
}

/**
 * Ensures a value is a date.
 *
 * @example
 * const timestamp = validators.date('timestamp is required');
 *
 * // non-conforming value
 * timestamp('123').catch(console.error);
 * > ValidationError: timestamp is required
 *
 * // conforming value
 * const valid = await timestamp(new Date())
 *   .then(() => true, () => false);
 *
 * // as part of object schema
 * const record = validators.object({
 *   id: validators.string('id is required'),
 *   created: validators.date('creation date is missing'),
 * }, 'record is invalid');
 *
 * @function
 * @param {string} message The error message to use if the validation fails.
 * @throws {Error} An error message must be provided.
 * @returns {Validator<ValidationError>} A validation function
 */
export function date(message) {
    validate(message, isString, 'An error message must be provided.');
    return async function validDate(proposed, current) {
        if (isJSONEncoded(proposed))
            proposed = new Date(proposed);
        if (!isDate(proposed))
            throw validationError(message, { proposed, current });
    };
}

/**
 * Ensures a value equals one of the given expected values.
 *
 * @example
 * // you can specify the expected values as an array or as parameters:
 * const bool = validators.oneOf(true, false, 'boolean expected');
 * const same = validators.oneOf([true, false], 'boolean expected');
 * @example
 * const level = validators.oneOf(['admin', 'user', 'poweruser'], 'invalid level');
 *
 * // non-conforming value
 * level('sudo').catch(console.error);
 * > ValidationError: invalid level
 *
 * // conforming value
 * const valid = await level('user')
 *   .then(() => true, () => false);
 *
 * // as part of object schema
 * const user = validators.object({
 *   username: validators.string('username is required'),
 *   level: validators.oneOf('admin', 'user', 'poweruser', 'invalid level'),
 * }, 'user is invalid');
 *
 * @function
 * @param {...any[]} values The allowed set of values that the proposed value can be one of.
 * @param {string} message The error message to use if the validation fails.
 * @throws {Error} An error message must be provided.
 * @throws {Error} A non-empty array of expected values must be provided.
 * @returns {Validator<ValidationError>} A validation function
 */
// expected values can be array or paramarray
export function oneOf(...args) {
    const message = args.pop();
    const values = flatten(args);
    validate(message, isString, 'An error message must be provided.');
    validate(values, isArray, negate(isEmpty), 'A non-empty array of expected values must be provided.');
    return async function isOneOf(proposed, current) {
        if (!values.some(equals, proposed))
            throw validationError(message, { proposed, current });
    };
}

/**
 * Negates the specified validator. In other words, if the validator
 * rejects, this validation will resolve. If the validator resolves,
 * this validation will reject with the specified error message.
 *
 * @function
 * @param {Validator} validator The validator to negate.
 * @param {string} message The error message to use if the validation fails.
 * @returns {Validator<ValidationError>} A validation function
 * @throws An error message must be provided.
 * @throws A validator function must be provided.
 * @example
 * const isEmpty = validators.empty('value is not empty');
 * const isNotEmpty = validators.not(isEmpty, 'value is empty');
 *
 * // conforming
 * await isNotEmpty([1, 2, 3]);
 *
 * // not conforming
 * isNotEmpty([]).catch(console.error);
 * > ValidationError: value is empty
 *
 * isNotEmpty({}).catch(console.error);
 * > ValidationError: value is empty
 *
 * isNotEmpty(null).catch(console.error);
 * > ValidationError: value is empty
 */
export function not(validator, message) {
    validate(message, isString, 'An error message must be provided.');
    validate(validator, isFunction, 'A validator function must be provided.');
    return async function isNot(proposed, current, source) {
        function reject() {
            throw validationError(message, { current, proposed });
        }
        await Promise.resolve(validator(proposed, current, source))
            .then(reject, noop);
    };
}

/**
 * Ensures the value is in the specified range. If no minimum value is
 * specified, no lower limit will be applied. Same if no maximum value
 * is specified. The bounds are inclusive, so think of it as `[min, max]`,
 * not `(min, max)`.
 *
 * @function
 * @param {any} min The minimum value in the range, inclusive.
 * @param {any} max The maximum value in the range, inclusive.
 * @param {string} message The error message to use if the validation fails.
 * @returns {Validator<ValidationError>} A validation function
 * @throws An error message must be provided.
 * @example
 * const isAdult = validators.range(18, null, 'not an adult');
 * const isTodayOrEarlier = validators.range(null, new Date(), 'after today');
 *
 * // conforming
 * await isAdult(31);
 *
 * // not conforming
 * isAdult(4).catch(console.error);
 * > ValidationError: not an adult
 *
 * // non-conforming date
 * const ONE_DAY = 24 * 60 * 60 * 1000;
 * const tomorrow = new Date(Date.now() + ONE_DAY);
 *
 * isTodayOrEarlier(tomorrow).catch(console.error);
 * > ValidationError: after today
 */
export function range(min, max, message) {
    validate(message, isString, 'An error message must be provided.');
    return async function inRange(proposed, current) {
        const gteMin = isNil(min) || proposed >= min;
        const lteMax = isNil(max) || proposed <= max;
        if (!gteMin || !lteMax)
            throw validationError(message, { current, proposed, min, max });
    };
}

/**
 * Matches the proposed value against a regular expression.
 *
 * @function
 * @param {RegExp} rx The Regular Expression to match against.
 * @param {string} message The error message to use if the validation fails.
 * @returns {Validator<ValidationError>} A validation function
 * @throws {Error} An error message must be provided.
 * @throws {Error} A regular expression must be provided.
 * @example
 * const rx = /^[\da-f]{8}-[\da-f]{4}-[0-5][\da-f]{3}-[089ab][\da-f]{3}-[\da-f]{12}$/i;
 * const uuid = validators.matches(rx, 'a uuid is required');
 *
 * // conforming
 * const valid = await uuid('35543cdb-5ac3-477f-ac86-ce8796b68cc6')
 *   .then(() => true, () => false);
 *
 * // non-conforming
 * uuid('abc').catch(console.error);
 * > ValidationError: a uuid is required
 */
export function matches(rx, message) {
    validate(message, isString, 'An error message must be provided.');
    validate(rx, isRegExp, 'A regular expression must be provided.');
    return async function isMatch(proposed, current) {
        if (!rx.test(proposed))
            throw validationError(message, { current, proposed });
    };
}

/**
 * Ensures the proposed value passes at least one of the specified
 * validators.
 *
 * **NOTE:** If no validators are specified, the value will always
 * be considered invalid.
 *
 * **NOTE:** You can use this validator to extend existing validations.
 * For example, you can enable multiple versions of a schema until
 * support for older versions can be removed.
 *
 * See the examples for details.
 *
 * @function
 * @param {...Validator[]} validators Zero or more {@link Validator}
 * functions to apply. You can specify an array or just pass the
 * validators as direct arguments.
 * @param {string} message The error message to use if the validation fails.
 * @returns {Validator<AggregateValidationError>} A validation function
 * @throws {Error} An error message must be provided.
 * @throws {Error} A non-validator was provided.
 * @example
 * // if provided, feedback must be a string
 * const bugReport = validators.object({
 *   error: validators.instanceOf(Error, 'error is required'),
 *   feedback: validators.some(
 *     validators.empty(''),
 *     validators.string('feedback should be a string'),
 *     'invalid feedback',
 *   ),
 * }, 'invalid bug report');
 * @example
 * // allowing multiple versions of a schema
 *
 * // compose validators for re-use
 * function isRequiredString(name) {
 *   return validators.every(
 *     validators.not(validators.empty(''), `${name} is required`),
 *     validators.string(`${name} must be a string`),
 *     `${name} is a required string`,
 *   )
 * }
 *
 * const version1 = validators.object({
 *   fullname: isRequiredString('fullname'),
 * });
 *
 * // version 2 split fullname into firstname and lastname:
 * const version2 = validators.object({
 *   firstname: isRequiredString('firstname'),
 *   lastname: isRequiredString('lastname'),
 * });
 *
 * const isKnownVersion = validators.some([
 *   version1, // single fullname field
 *   version2, // firstname and lastname fields
 * ], 'invalid version provided');
 *
 * export async function validatePerson(person) {
 *   await isKnownVersion(person);
 * }
 */
export function some(...args) {
    const validators = flatten(args);
    const message = validators.pop();
    validate(message, isString, 'An error message must be provided.');
    validate(validators, areAllFunctions, 'A non-validator was provided.');
    return async function someValid(proposed, current, source) {
        try {
            const context = { proposed, current, source };
            const promises = validators.map(asIterationPromise, context);
            await aggregatePromise(promises, promises.length);
        } catch (inner) {
            throw validationError(message, { current, proposed, inner });
        }
    };
}

/**
 * Ensures the proposed value passes all of the specified validators.
 *
 * **NOTE:** If no validators are specified, the value will always be valid.
 * You can use this to indicate that _any_ value is acceptable.
 *
 * **NOTE:** You can use this validator to _extend_ an existing set of validations
 * with additional validation checks.
 *
 * See the examples for details.
 *
 * @function
 * @param {...Validator[]} validators Zero or more {@link Validator}
 * functions to apply. You can specify an array or just pass the
 * validators as direct arguments.
 * @param {string} message The error message to use if the validation fails.
 * @returns {Validator<AggregateValidationError>} A validation function
 * @throws {Error} An error message must be provided.
 * @throws {Error} A non-validator was provided.
 * @example
 * // compose multiple validators together
 *
 * export const nonEmptyString = (name) => validators.every([
 *   validators.string(`${name} must be a string`),
 *   validators.not(validators.empty(''), `${name} is required`),
 * ], `${name} must be a non-empty string`);
 *
 * // usage:
 * const user = validators.object({
 *   id: nonEmptyString('user id'),
 * }, 'user is invalid');
 * @example
 * // extend an existing validation
 *
 * const auditEntry = validators.object({
 *   timestamp: validators.date('timestamp is invalid'),
 *   message: validators.string('message must be a string'),
 *   allowed: validators.oneOf([true, false], 'allowed must be a boolean'),
 * }, 'invalid audit entry');
 *
 * export const baseUser = validators.object({
 *   id: validators.string('user id is required'),
 *   access: validators.oneOf(['user', 'admin'], 'invalid access level'),
 * }, 'base user is invalid');
 *
 * export const auditedUser = validators.every([
 *   baseUser, // all the validations of a base user, plus...
 *   validators.object({
 *     audits: validators.array(auditEntry, 'invalid audit trail'),
 *   }, 'audit trail missing'),
 * ], 'audited user is invalid');
 * @example
 * // data responses can have optional payloads
 * const validateResponse = validators.object({
 *   meta: validators.object({}, 'object expected'),
 *   data: validators.every('any value is allowed'),
 * }, 'response is invalid');
 *
 * async function throwIfInvalid(response) {
 *   await validateResponse(response);
 *   return response.data;
 * }
 *
 * export function loadData(arg1, arg2) {
 *   const params = { arg1, arg2 };
 *   const request = data.createRequest(operation, params);
 *   return fetch(request)
 *     .then(throwIfInvalid)
 *     .catch(errors.rethrow(params));
 * }
 */
export function every(...args) {
    const validators = flatten(args);
    const message = validators.pop();
    validate(message, isString, 'An error message must be provided.');
    validate(validators, areAllFunctions, 'A non-validator was provided.');
    return async function everyValid(proposed, current, source) {
        try {
            const context = { proposed, current, source };
            const promises = validators.map(asIterationPromise, context);
            await aggregatePromise(promises, 1, 1);
        } catch (inner) {
            throw validationError(message, { proposed, current, inner });
        }
    };
}

/**
 * Ensures the proposed value is _empty_. Empty values include `null` and `undefined`.
 * Objects are considered empty if they have no own enumerable string keyed properties.
 * Array-like values such as arguments objects, arrays, buffers, strings, or jQuery-like
 * collections are considered empty if they have a length of 0. Similarly, maps and sets
 * are considered empty if they have a size of 0.
 *
 * @function
 * @param {string} message The error message to use if the validation fails.
 * @returns {Validator<ValidationError>} A validation function
 * @throws {Error} An error message must be provided.
 * @example
 * const validResult = validators.object({
 *   data: validators.every('any value is allowed'),
 *   error: validators.empty('should not have an error'),
 * }, 'result is invalid');
 * @example
 * // use not(empty(''), '...') to ensure a value is provided
 * const feedback = validators.object({
 *   timestamp: validators.date('valid timestamp required'),
 *   comments: validators.not(validators.empty(''), 'comments are required'),
 * }, 'invalid feedback');
 * @example
 * // combine validators together to ensure a value of a specific
 * // type is provided _and_ is not empty
 * export const nonEmptyString = (name) => validators.every([
 *   validators.string(`${name} must be a string`),
 *   validators.not(validators.empty(''), `${name} is required`),
 * ], `${name} must be a non-empty string`);
 */
export function empty(message) {
    validate(message, isString, 'An error message must be provided.');
    return async function validEmpty(proposed, current) {
        if (!isEmpty(proposed))
            throw validationError(message, { proposed, current });
    };
}

/**
 * Ensures the proposed value is an instance of the specified type.
 *
 * @function
 * @param {Function} type The type function to check against.
 * @param {string} message The error message to use if the validation fails.
 * @returns {Validator<ValidationError>} A validation function
 * @throws {Error} An error message must be provided.
 * @throws {Error} A class type must be provided.
 * @example
 * const regex = validators.instanceOf(RegExp, 'invalid regular expression');
 *
 * // conforming
 * await regex(/rx/);
 *
 * // non-conforming
 * regex('abc').catch(console.error);
 * > ValidationError: invalid regular expression
 * @example
 * // utility validator
 * const error = (message) => validators.instanceOf(Error, message);
 *
 * // usage
 * const bugReport = validators.object({
 *   failure: error('failure reason expected'),
 *   comments: validators.string('invalid user comments'),
 * }, 'invalid bug report');
 */
export function instanceOf(type, message) {
    validate(message, isString, 'An error message must be provided.');
    validate(type, isFunction, 'A class type must be provided.');
    return async function isInstanceOf(proposed, current) {
        if (!(proposed instanceof type))
            throw validationError(message, { proposed, current });
    };
}