/**
 * Provides functionality useful during unit testing.
 *
 * @module test
 */

/**
 * Provides options for controlling how a {@link Spy} behaves when invoked.
 *
 * @global
 * @interface SpyBehaviors
 * @see {@link Spy}
 */

/**
 * Throws the specified value when the {@link Spy} is invoked.
 *
 * @function SpyBehaviors#throws
 * @returns {Spy|SpyBehaviors} The original context, for chaining.
 * @example
 * import { spy } from '@paychex/core/test/utils';
 *
 * const method = spy().throws(new Error());
 *
 * method.onCall(1).throws(new Error('2nd call'));
 */

/**
 * Returns the specified value when the {@link Spy} is invoked.
 *
 * @function SpyBehaviors#returns
 * @returns {Spy|SpyBehaviors} The original context, for chaining.
 * @example
 * import { spy } from '@paychex/core/test/utils';
 *
 * const method = spy().returns('abc');
 *
 * method.onCall(1).returns('def');
 */

/**
 * Calls the specified method when the {@link Spy} is invoked.
 *
 * @function SpyBehaviors#invokes
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

/**
 * Collection of {@link Spy~SpyCall information} about each invocation of the Spy.
 *
 * @typedef {Array.<Spy~SpyCall>} Spy~SpyCalls
 * @property {Function} mostRecent Retrieves the {@link Spy~SpyCall call information}
 * for the most recent invocation of the Spy.
 * @example
 * import { spy } from '@paychex/core/test/utils';
 *
 * const method = spy();
 *
 * method('abc');
 * method('def');
 *
 * method.calls[0].args; // ["abc"];
 * method.calls[1].args; // ["def"];
 *
 * method('ghi');
 * method.calls.mostRecent().args; // ["ghi"]
 */

/**
 * @typedef {object} Spy~SpyCall
 * @property {any[]} args The arguments passed to this invocation of the spy.
 * @property {any} context The `this` context used for this invocation of the spy.
 * @property {Date} callTime When the spy was invoked.
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

/**
 * Changes the behaviors for a specific invocation of the Spy.
 *
 * @function Spy#onCall
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

/**
 * Used to provide custom behaviors at test time to control code flow and ensure
 * code coverage. Can also be used to verify individual call data (args and context)
 * as well as overall invocation counts.
 *
 * @global
 * @interface Spy
 * @extends SpyBehaviors
 * @extends Spy~SpyCall
 * @property {number} callCount The number of times the spy was invoked.
 * @property {boolean} called `true` if the spy was invoked.
 * @property {Spy~SpyCalls} calls Collection of data about each call.
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

function Behavior(calls, delegate) {
    return function behavior(...args) {
        const call = Object.freeze({
            args,
            context: this,
            callTime: new Date()
        });
        calls.push(call);
        calls.mostRecent = () => call;
        return delegate.apply(this, args);
    };
}

function ThrowsBehavior(err) {
    return function throws() {
        throw err;
    };
}

function ReturnsBehavior(value) {
    return function returns() {
        return value;
    };
}

function InvokesBehavior(fn) {
    return function invokes() {
        return fn.apply(this, arguments);
    };
}

function defineBehaviors(context, behaviors, index, calls) {
    return {
        throws: {
            value(err) {
                behaviors[index] = Behavior(calls, ThrowsBehavior(err));
                return context;
            }
        },
        invokes: {
            value(fn) {
                behaviors[index] = Behavior(calls, InvokesBehavior(fn));
                return context;
            }
        },
        returns: {
            value(value) {
                behaviors[index] = Behavior(calls, ReturnsBehavior(value));
                return context;
            }
        }
    };
}

/**
 * Creates a new Spy instance for unit tests. A Spy is a
 * method that takes the place of an existing method and
 * has additional properties that can be queried to verify
 * that certain test conditions have been met.
 *
 * @function
 * @returns {Spy} A new Spy instance for unit testing.
 * @example
 * import expect from 'expect';
 * import { spy } from '@paychex/core/test/utils';
 * import someFactoryMethod from '../path/to/test/file';
 *
 * describe('some factory method', () => {
 *
 *   let instance, dependency;
 *
 *   beforeEach(() => {
 *     dependency = {
 *       methodA: spy().returns('a'),
 *       methodB: spy().returns('b')
 *     };
 *     instance = someFactoryMethod(dependency);
 *   });
 *
 *   it('invokes dependency method a', () => {
 *     instance.method();
 *     expect(dependency.methodA.called).toBe(true);
 *   });
 *
 *   it('handles error', async () => {
 *     const handler = spy();
 *     const err = new Error('test');
 *     dependency.methodB.throws(err);
 *     await instance.anotherMethod().catch(handler);
 *     expect(handler.called).toBe(true);
 *     expect(handler.args[0]).toBe(err);
 *   });
 *
 *   it('retries on error', async () => {
 *     dependency.methodA.onCall(0).throws(new Error());
 *     dependency.methodA.onCall(1).returns(123);
 *     const result = instance.method();
 *     expect(dependency.methodA.callCount).toBe(2);
 *     expect(result).toBe(123);
 *   });
 *
 * });
 */
export function spy() {

    const calls = [];
    const behaviors = [];

    function setDefaults() {
        const empty = Object.freeze({
            args: [],
            context: undefined,
            callTime: undefined,
        });
        calls.mostRecent = () => empty;
        behaviors.default = Behavior(calls, ReturnsBehavior());
    }

    function onCall(index) {
        const call = Object.create(null);
        return Object.defineProperties(call, defineBehaviors(call, behaviors, index, calls));
    }

    function invoke(...args) {
        const index = calls.length;
        const behavior = behaviors[index] || behaviors.default;
        return behavior.apply(this, args);
    }

    setDefaults();

    return Object.defineProperties(invoke, {
        onCall:     { value: onCall },
        callCount:  { get() { return calls.length; } },
        called:     { get() { return !!calls.length; } },
        calls:      { get() { return Object.freeze(calls); } },
        args:       { get() { return calls.mostRecent().args; } },
        context:    { get() { return calls.mostRecent().context; } },
        callTime:   { get() { return calls.mostRecent().callTime; } },
        reset:      { value() {
            calls.length = 0;
            behaviors.length = 0;
            setDefaults();
        } },
        ...defineBehaviors(invoke, behaviors, 'default', calls)
    });

}