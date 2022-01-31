/**
 * Provides functionality useful during unit testing.
 *
 * ```js
 * // esm
 * import { spy } from '@paychex/core/test';
 *
 * // commonjs
 * const { spy } = require('@paychex/core/test');
 * ```
 *
 * @module test
 */

export interface SpyBase extends Function {

    /** @ignore */
    arguments: any,

    /** @ignore */
    prototype: any,

    /** @ignore */
    length: number,

    /** @ignore */
    name: string,

    /** @ignore */
    [Symbol.hasInstance](value: any): boolean

    /** @ignore */
    apply(thisArg: any, argArray?: any): any

    /** @ignore */
    bind(thisArg: any, ...argArray: any[]): any

    /** @ignore */
    call(thisArg: any, ...argArray: any[]): any

    /** @ignore */
    toString(): string

    /** @ignore */
    caller: Function

}

export interface SpyBaseCollection extends Array<SpyBase> {
    default: SpyBase
}

/**
 * Provides options for controlling how a {@link Spy} behaves when invoked.
 *
 * @see {@link Spy}
 */
export interface SpyBehavior extends SpyBase {

    /**
     * Throws the specified value when the {@link Spy} is invoked.
     *
     * @param value The value to throw, typically an Error instance.
     * @returns The original context, for chaining.
     * @example
     * ```js
     * import { spy } from '@paychex/core';
     *
     * const method = spy().throws(new Error());
     *
     * method.onCall(1).throws(new Error('2nd call'));
     * ```
     */
    throws(err: Error): Spy

    /**
     * Returns the specified value when the {@link Spy} is invoked.
     *
     * @param value The value to return.
     * @returns The original context, for chaining.
     * @example
     * ```js
     * import { spy } from '@paychex/core';
     *
     * const method = spy().returns('abc');
     *
     * method.onCall(1).returns('def');
     * ```
     */
    returns(value: any): Spy

    /**
     * Calls the specified method when the {@link Spy} is invoked.
     *
     * @param func The function to invoke. Will be passed
     * the same arguments and invoked in the same context the spy was.
     * @returns The original context, for chaining.
     * @example
     * ```js
     * import { spy } from '@paychex/core';
     *
     * const method = spy().invokes(function(...args) {
     *   console.log('method called with', args);
     * });
     *
     * method.onCall(1).invokes(function(...args) {
     *   console.log('method called 2nd time', args);
     * });
     * ```
     */
    invokes(fn: Function): Spy

};

/**
 * @example
 * ```js
 * import { spy } from '@paychex/core';
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
 * ```
 */
export interface SpyCall {

    /**
     * The arguments passed to this invocation of the spy.
     */
    args: any[]

    /**
     * The `this` context used for this invocation of the spy.
     */
    context: any

    /**
     * When the spy was invoked.
     */
    callTime: Date

}

/**
 * Collection of {@link SpyCall} instances with an accessor method to retrieve the most recent invocation.
 */
export interface SpyCallCollection extends Array<SpyCall> {

    mostRecent(): SpyCall

}

/**
 * Used to provide custom behaviors at test time to control code flow and ensure
 * code coverage. Can also be used to verify individual call data (args and context)
 * as well as overall invocation counts.
 *
 * @example
 * ```js
 * import { test } from '@paychex/core';
 *
 * const method = test.spy(); // create a new Spy instance
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
 * ```
 */
export interface Spy extends SpyBehavior, SpyCall {

    (...args: any[]): any
    /**
     * The number of times the spy was invoked.
     */
    callCount: number

    /**
     * `true` if the spy was invoked.
     */
    called: boolean

    /**
     * Collection of data about each call.
     */
    calls: SpyCall[]

    /**
    * Changes the behaviors for a specific invocation of the Spy.
    *
    * @param index The index of the call whose behavior should be changed.
    * @returns The possible behaviors to invoke for this call.
    * @example
    * ```js
    * import { spy } from '@paychex/core';
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
    * ```
    */
    onCall(index: number): SpyBehavior

}

/**
 * @ignore
 */
export interface SpyBehaviorCollection extends Array<SpyBehavior> {

    default: SpyBehavior

}

function Behavior(calls: SpyCallCollection, delegate: Function): SpyBase {
    return function behavior(...args: any[]) {
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

function ThrowsBehavior(err: Error): Function {
    return function throws() {
        throw err;
    };
}

function ReturnsBehavior(value?: any): Function {
    return function returns() {
        return value;
    };
}

function InvokesBehavior(fn: Function): Function {
    return function invokes() {
        return fn.apply(this, arguments);
    };
}

function defineBehaviors(context: SpyBase, behaviors: SpyBaseCollection, index: number|'default', calls: SpyCallCollection): PropertyDescriptorMap {
    return {
        throws: {
            value(err: Error) {
                behaviors[index] = Behavior(calls, ThrowsBehavior(err));
                return context;
            }
        },
        invokes: {
            value(fn: Function) {
                behaviors[index] = Behavior(calls, InvokesBehavior(fn));
                return context;
            }
        },
        returns: {
            value(value?: any) {
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
 * @returns A new Spy instance for unit testing.
 * @example
 * ```js
 * import * as expect from 'expect';
 * import { test } from '@paychex/core';
 * import someFactoryMethod from '../path/to/test/file';
 *
 * const { spy } = test;
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
 *   it('retries on error', () => {
 *     dependency.methodA.onCall(0).throws(new Error());
 *     dependency.methodA.onCall(1).returns(123);
 *     const result = instance.method();
 *     expect(dependency.methodA.callCount).toBe(2);
 *     expect(result).toBe(123);
 *   });
 *
 * });
 */
export function spy(): Spy {

    const calls: any = [];
    const behaviors: any = [];

    function setDefaults() {
        const empty = Object.freeze({
            args: [],
            context: undefined,
            callTime: undefined,
        });
        calls.mostRecent = () => empty;
        behaviors.default = Behavior(calls, ReturnsBehavior());
    }

    function onCall(index: number): SpyBehavior {
        const call = Object.create(null);
        return Object.defineProperties(call, defineBehaviors(call, behaviors, index, calls));
    }

    function invoke(...args: any[]): any {
        const index = calls.length;
        const behavior = behaviors[index] || behaviors.default;
        return behavior.apply(this, args);
    }

    setDefaults();

    return Object.defineProperties(invoke, {
        onCall:     { value: onCall },
        callCount:  { get() { return calls.length; } },
        called:     { get() { return !!calls.length; } },
        calls:      { get() { return calls as SpyCallCollection; } },
        args:       { get() { return (calls as SpyCallCollection).mostRecent().args; } },
        context:    { get() { return (calls as SpyCallCollection).mostRecent().context; } },
        callTime:   { get() { return (calls as SpyCallCollection).mostRecent().callTime; } },
        reset:      { value() {
            calls.length = 0;
            behaviors.length = 0;
            setDefaults();
        } },
        ...defineBehaviors(invoke, behaviors, 'default', calls)
    }) as Spy;

}