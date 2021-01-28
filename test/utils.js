import { Spy, SpyCall, SpyBehaviors } from '../types/test.js';

class UnusedSpy extends Spy {}
class UnusedSpyCall extends SpyCall {}
class UnusedSpyBehaviors extends SpyBehaviors {}

/**
 * Provides functionality useful during unit testing.
 *
 * @module test
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
        calls:      { get() { return calls; } },
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