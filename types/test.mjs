/**
 * Provides options for controlling how a {@link Spy} behaves when invoked.
 *
 * @global
 * @class
 * @hideconstructor
 * @see {@link Spy}
 */
export class SpyBehaviors {

    /**
     * Throws the specified value when the {@link Spy} is invoked.
     *
     * @method SpyBehaviors#throws
     * @param {any} value The value to throw, typically an Error instance.
     * @returns {Spy|SpyBehaviors} The original context, for chaining.
     * @example
     * import { spy } from '@paychex/core/test/utils';
     *
     * const method = spy().throws(new Error());
     *
     * method.onCall(1).throws(new Error('2nd call'));
     */
    throws() { }

    /**
     * Returns the specified value when the {@link Spy} is invoked.
     *
     * @method SpyBehaviors#returns
     * @param {any} value The value to return.
     * @returns {Spy|SpyBehaviors} The original context, for chaining.
     * @example
     * import { spy } from '@paychex/core/test/utils';
     *
     * const method = spy().returns('abc');
     *
     * method.onCall(1).returns('def');
     */
    returns() { }

    /**
     * Calls the specified method when the {@link Spy} is invoked.
     *
     * @method SpyBehaviors#invokes
     * @param {Function} func The function to invoke. Will be passed
     * the same arguments and invoked in the same context the spy was.
     * @returns {Spy|SpyBehaviors} The original context, for chaining.
     * @example
     * import { spy } from '@paychex/core/test/utils';
     *
     * const method = spy().invokes(function(...args) {
     *   console.log('method called with', args);
     * });
     *
     * method.onCall(1).invokes(function(...args) {
     *   console.log('method called 2nd time', args);
     * });
     */
    invokes() { }

}

/**
 * @global
 * @hideconstructor
 * @class
 * @example
 * import { spy } from '@paychex/core/test/utils';
 *
 * const method = spy();
 *
 * method('abc');
 * method('def');
 *
 * method.args; // ["def"]
 * method.calls[0].args; // ["abc"]
 * method.calls[0].callTime; // Date
 *
 * method.call(window, "ghi");
 * method.calls.mostRecent().context; // Window
 */
export class SpyCall {

    /**
     * The arguments passed to this invocation of the spy.
     *
     * @type {Array<*>}
     * @memberof SpyCall#
     */
    args = []

    /**
     * The `this` context used for this invocation of the spy.
     *
     * @type {*}
     * @memberof SpyCall#
     */
    context = null

    /**
     * When the spy was invoked.
     *
     * @type {Date}
     * @memberof SpyCall#
     */
    callTime = new Date()

}

/**
 * Used to provide custom behaviors at test time to control code flow and ensure
 * code coverage. Can also be used to verify individual call data (args and context)
 * as well as overall invocation counts.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends SpyBehaviors
 * @extends SpyCall
 * @example
 * import { spy } from '@paychex/core/test/utils';
 *
 * const method = spy(); // create a new Spy instance
 *
 * method.returns(123); // default behavior
 * method.onCall(1).throws(new Error()); // throw error on 2nd call
 *
 * method.called; // false
 *
 * method(); // 123
 *
 * method.called; // true
 * method.callCount; // 1
 *
 * try {
 *   method();
 * } catch (e) {
 *   // 2nd invocation throws error
 * }
 *
 * method.call({}, 'abc');
 * method.callCount; // 3
 *
 * method.calls(2).args; // ['abc']
 * method.calls(2).context; // {}
 * method.calls(2).callTime; // Date
 *
 * method('def');
 * method.calls.mostRecent().args; // ['def']
 *
 * // invoke a different function when the
 * // spy is called
 * method.invokes(function(...args) {
 *   console.log('proxy method called', args);
 * });
 *
 * method('abc', 123); // "proxy method called ['abc', 123]"
 *
 * method.reset();
 * method.called; // false
 * method.callCount; // 0
 *
 * method(); // undefined
 */
export class Spy extends SpyBehaviors {

    /**
     * The number of times the spy was invoked.
     *
     * @type {number}
     * @memberof Spy#
     */
    callCount = 0

    /**
     * `true` if the spy was invoked.
     *
     * @type {boolean}
     * @memberof Spy#
     */
    called = false

    /**
     * Collection of data about each call.
     *
     * @memberof Spy#
     * @type {SpyCall[]}
     */
    calls = []

    /**
    * Changes the behaviors for a specific invocation of the Spy.
    *
    * @method Spy#onCall
    * @param {number} index The index of the call whose behavior should be changed.
    * @returns {SpyBehaviors} The possible behaviors to invoke for this call.
    * @example
    * import { spy } from '@paychex/core/test/utils';
    *
    * const method = spy().returns(123);
    * method.onCall(2).returns(456);
    * method.onCall(3).invokes(console.log);
    * method.onCall(4).throws(new Error());
    *
    * method(); // 123
    * method(); // 123
    * method(); // 456
    * method('hello'); // "hello"
    * method(); // throws
    */
    onCall() { }

}
