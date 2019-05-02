/**
 * Provides functionality useful during unit testing.
 *
 * @module test
 */

/**
 * Resets the Spy instance to its original state.
 *
 * @callback SpyReset
 * @returns {Spy} The instance on which this method was
 * called, for chaining.
 * @example
 * const spy = spy().returns(Promise.resolve('abc'));
 * spy.reset(); // no longer returns a resolved Promise
 */

/**
 * Instructs the Spy instance to throw the specified error
 * when invoked.
 *
 * @callback SpyThrows
 * @param {Error} err The error to throw when this method
 * is invoked.
 * @returns {Spy} The instance on which this method was
 * called, for chaining.
 * @example
 * const spy = spy().throws(new Error('test error'));
 */

/**
 * Instructs the Spy instance to return the specified value
 * when invoked.
 *
 * @callback SpyReturns
 * @param {any} value The value to return when this method
 * is invoked.
 * @returns {Spy} The instance on which this method was
 * called, for chaining.
 * @example
 * const spy = spy().returns(Promise.resolve('abc'));
 */

/**
 * Represents a mock function that can be invoked in place
 * of real functionality, enabling tests to verify that
 * certain runtime conditions have been met.
 *
 * @typedef {object} Spy
 * @property {string} name The name of the spy instance.
 * @property {boolean} called Whether the spy has been invoked.
 * @property {number} callCount The number of times the spy was invoked.
 * @property {array.<any>} args The last set of arguments the spy was invoked with.
 * @property {SpyReset} reset Returns the spy to its initial state.
 * @property {SpyReturns} returns Returns the specified value when the spy is invoked.
 * @property {SpyThrows} throws Throws the specified Error when the spy is invoked.
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
 *       methodA: spy('method a'),
 *       methodB: spy('method b')
 *     };
 *     instance = someFactoryMethod(dependency);
 *   });
 *
 *   it('invokes dependency method a', () => {
 *     instance.method();
 *     expect(dependency.methodA.called).toBe(true);
 *   });
 *
 *   it('handles error', await () => {
 *     const handler = spy();
 *     const err = new Error('test');
 *     dependency.methodB.throws(err);
 *     await instance.anotherMethod().catch(handler);
 *     expect(handler.called).toBe(true);
 *     expect(handler.args[0]).toBe(err);
 *   });
 *
 * });
 */

/**
 * Creates a new Spy instance for unit tests. A Spy is a
 * method that takes the place of an existing method and
 * has additional properties that can be queried to verify
 * that certain test conditions have been met.
 *
 * @function
 * @param {string} [name='spy'] The name of the spy.
 * @returns {Spy} A new Spy instance for unit testing.
 */
export function spy(name = 'spy') {

    let value, err,
        args = [],
        context = null,
        callCount = 0;

    return Object.defineProperties(function spy(...params) {
        args = params;
        context = this;
        callCount++;
        if (err) throw err;
        return value;
    }, {
        name: { get: () => name },
        args: { get: () => args },
        context: { get: () => context },
        called: { get: () => callCount > 0 },
        callCount: { get: () => callCount },
        reset: {
            configurable: false,
            writable: false,
            value() {
                value = err = undefined;
                args = [];
                callCount = 0;
            }
        },
        throws: {
            configurable: false,
            writable: false,
            value(e) {
                err = e;
                return this;
            }
        },
        returns: {
            configurable: false,
            writable: false,
            value(v) {
                value = v;
                err = null;
                return this;
            }
        }
    });

};
