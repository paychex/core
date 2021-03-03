/**
 * @class
 * @global
 * @hideconstructor
 */
export class InvocationData extends Array {

    /**
     * The invocation context.
     *
     * @type {*}
     * @memberof InvocationData#
     */
    [0] = null

    /**
     * The arguments passed to this invocation.
     *
     * @type {Array.<*>}
     * @memberof InvocationData#
     */
    [1] = []

}

/**
 * Allows the consumer to invoke one or more functions together, passing any
 * supplied arguments to the underlying functions. The consumer can also add
 * or remove functions from the underlying Set dynamically.
 *
 * @class
 * @extends Function
 * @hideconstructor
 */
export class CollectionFunction extends Function {

    /**
     * Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original CollectionFunction for chaining.
     *
     * @param {...Function} fns One or more functions to add to the underlying collection.
     * @returns {CollectionFunction} The original CollectionFunction instance.
     */
    add(...fns) {}

    /**
     * Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original CollectionFunction for chaining.
     *
     * @param {...Function} fns One or more functions to remove from the underlying Set.
     * @returns {CollectionFunction} The original CollectionFunction instance.
     */
    remove(...fns) {}

    /**
     * Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original CollectionFunction for chaining.
     *
     * @param {number} index The position at which to begin inserting functions.
     * @param {...Function} fns One or more functions to insert into the underlying Set.
     * @returns {CollectionFunction} The original CollectionFunction instance.
     */
    insert(index, ...fns) {}

    /**
     * Creates and returns a new copy of the CollectionFunction. Methods can be added or removed
     * from this function without modifying the original.
     */
    clone() {}

}

/**
 * @async
 * @global
 * @callback ParallelFunction
 * @property {Function} add Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original ParallelFunction for chaining.
 * @property {Function} remove Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original ParallelFunction for chaining.
 * @property {Function} insert Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original ParallelFunction for chaining.
 * @property {Function} clone Creates and returns a new copy of the ParallelFunction. Methods can be added or removed
 * from this function without modifying the original.
 * @param {...any} args The arguments to pass to the original functions.
 * @returns {Promise} A Promise resolved with the array of settled return
 * values or else rejecting with the first rejection reason or thrown error.
 * @example
 * const isValidUserName = functions.parallel(isNonEmpty, allCharactersValid);
 *
 * // add more functions to the collection:
 * isValidUserName.add(isNotTaken, passesProfanityFilter);
 *
 * export async function validate(username) {
 *   try {
 *     const results = await isValidUserName(username);
 *     return result.every(Boolean);
 *   } catch (e) {
 *     return false;
 *   }
 * }
 */
export class ParallelFunction extends CollectionFunction {}

/**
 * @async
 * @global
 * @callback SequentialFunction
 * @property {Function} add Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original SequentialFunction for chaining.
 * @property {Function} remove Removes one or more functions from the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set} and returns the original SequentialFunction for chaining.
 * @property {Function} insert Adds one or more functions to the underlying {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set Set}, starting at the given index, and returns the original SequentialFunction for chaining.
 * @property {Function} clone Creates and returns a new copy of the SequentialFunction. Methods can be added or removed
 * from this function without modifying the original.
 * @param {...any} args The arguments to pass to the original functions.
 * @returns {Promise} A Promise resolved with the last function's settled
 * return value, or rejected if any function rejects or throws an error.
 * The functions will be passed the incoming arguments along with the value
 * returned by the previous function.
 * @example
 * // as a standalone function
 *
 * const process = functions.sequence();
 *
 * async function handler1(...args, lastHandlerResult) {
 *   console.log(args, lastHandlerResult);
 *   await someAsyncMethod(...args);
 *   return 1;
 * }
 *
 * function handler2(...args, lastHandlerResult) {
 *   console.log(args, lastHandlerResult);
 *   return 2;
 * }
 *
 * process.add(handler1);
 * process.add(handler2);
 *
 * await process('abc', 'def'); // 2
 * // output from handler1: ['abc', 'def'], undefined
 * // output from handler2: ['abc', 'def'], 1
 * @example
 * // as a combination event handler
 *
 * function handler1(...args) {
 *   return 'some value';
 * }
 *
 * function handler2(...args, previousValue) {
 *   return previousValue === 'some value';
 * }
 *
 * const bus = events.bus();
 *
 * bus.on('event', functions.sequence(handler1, handler2));
 * await bus.fire('event', 'arg1', 'arg2'); // [true]
 */
export class SequentialFunction extends CollectionFunction {}


/**
 * Function returned by {@link module:index~buffer buffer}.
 *
 * @async
 * @global
 * @callback BufferFunction
 * @param {...any} args The arguments to pass to the wrapped function.
 * @returns {Promise} A promise resolved when all the queued invocations
 * are complete, or rejected if any queued invocation throws an error or
 * returns a rejected Promise.
 */
async function BufferFunction() { }

/**
 * Filters the queued invocations when a {@link module:index~buffer buffer}'s
 * signals are ready.
 *
 * @global
 * @callback BufferFilter
 * @param {InvocationData[]} invocations The queued invocations.
 * @returns {InvocationData[]} A subset of queued invocations to invoke.
 * Filters can modify the invocation contexts and arguments.
 */
function BufferFilter(invocations) { }
