import * as expect from 'expect';
import { spy } from './index';

import * as events from '../events/index';
import { manualReset, autoReset } from '../signals/index';

import {
    buffer,
    sequence,
    parallel,
    invokeIf,
} from '../functions/index';
import { ParallelFunction, SequentialFunction } from '../functions';
import { Spy } from './index';

const delay = (ms: number, value?: any) =>
    () => new Promise(resolve =>
        setTimeout(resolve, ms, value));

const tick = () => delay(0)();

describe('functions', () => {

    describe('sequence', () => {

        let seq: SequentialFunction,
            fn1: Spy,
            fn2: Spy,
            fn3: Spy;

        beforeEach(() => {
            fn1 = spy().returns(1);
            fn2 = spy().returns(2);
            fn3 = spy().returns(3);
            seq = sequence(fn1, fn2, fn3);
        });

        it('rejects if method throws', async () => {
            const err = new Error();
            fn2.throws(err);
            try {
                await seq();
                throw new Error('should not be reached');
            } catch (e) {
                expect(e).toBe(err);
            }
        });

        it('rejects if method rejects', async () => {
            const err = new Error();
            fn2.returns(Promise.reject(err));
            try {
                await seq();
                throw new Error('should not be reached');
            } catch (e) {
                expect(e).toBe(err);
            }
        });

        it('does not invoke after failure', async () => {
            fn2.throws(new Error());
            await seq().catch(() => {});
            expect(fn1.called).toBe(true);
            expect(fn2.called).toBe(true);
            expect(fn3.called).toBe(false);
        });

        it('resolves with last value', async () => {
            expect(await seq()).toBe(3);
        });

        it('invokes each method with passed args', async() => {
            await seq('a', 'b');
            expect(fn1.args).toEqual(['a', 'b', undefined]);
            expect(fn2.args).toEqual(['a', 'b', 1]);
            expect(fn3.args).toEqual(['a', 'b', 2]);
        });

        it('waits before proceeding', async () => {
            fn1.invokes(delay(20));
            fn2.invokes(delay(20));
            await seq();
            const call1Time = fn1.callTime.getTime();
            const call2Time = fn2.callTime.getTime();
            const call3Time = fn3.callTime.getTime();
            expect(call2Time).toBeGreaterThan(call1Time);
            expect(call3Time).toBeGreaterThan(call2Time);
        });

        it('propagates context', async () => {
            const context = Object.create(null);
            const bus = events.bus(context);
            bus.on('event', seq);
            await bus.fire('event');
            expect(fn1.context).toBe(context);
            expect(fn2.context).toBe(context);
            expect(fn3.context).toBe(context);
        });

        it('works with no functions', async () => {
            expect(await sequence()()).toBeUndefined();
        });

        it('only adds function once', async () => {
            seq.add(fn1, fn2);
            await seq();
            expect(fn1.callCount).toBe(1);
            expect(fn2.callCount).toBe(1);
        });

    });

    describe('parallel', () => {

        let par: ParallelFunction,
            fn1: Spy,
            fn2: Spy,
            fn3: Spy;

        beforeEach(() => {
            fn1 = spy().returns(1);
            fn2 = spy().returns(2);
            fn3 = spy().returns(3);
            par = parallel(fn1, fn2, fn3);
        });

        it('invokes all methods with same args', async () => {
            await par('a', 'b');
            expect(fn1.args).toEqual(['a', 'b']);
            expect(fn2.args).toEqual(['a', 'b']);
            expect(fn3.args).toEqual(['a', 'b']);
        });

        it('rejects if any method throws', async () => {
            const err = new Error();
            fn2.throws(err);
            try {
                await par();
                throw new Error('should not be reached');
            } catch (e) {
                expect(e).toBe(err);
            }
        });

        it('rejects if any method rejects', async () => {
            const err = new Error();
            fn2.returns(Promise.reject(err));
            try {
                await par();
                throw new Error('should not be reached');
            } catch (e) {
                expect(e).toBe(err);
            }
        });

        it('resolves with array of values', async () => {
            fn2.invokes(delay(20, 2));
            expect(await par()).toEqual([1, 2, 3]);
        });

        it('propagates context', async () => {
            const context = Object.create(null);
            const bus = events.bus(context);
            bus.on('event', par);
            await bus.fire('event');
            expect(fn1.context).toBe(context);
            expect(fn2.context).toBe(context);
            expect(fn3.context).toBe(context);
        });

        it('works with no functions', async () => {
            expect(await parallel()()).toEqual([]);
        });

        it('only adds function once', async () => {
            par.add(fn1, fn2);
            await par();
            expect(fn1.callCount).toBe(1);
            expect(fn2.callCount).toBe(1);
        });

    });

    describe('sequence and parallel', () => {

        let par: ParallelFunction,
            seq: SequentialFunction,
            fn1: Spy,
            fn2: Spy,
            fn3: Spy;

        beforeEach(() => {
            fn1 = spy().returns(Promise.resolve(1));
            fn2 = spy().invokes(delay(5, 2));
            fn3 = spy().returns(3);
            par = parallel(fn1, fn2, fn3);
            seq = sequence(fn1, fn2, fn3);
        });

        ['add', 'remove', 'insert'].forEach((method: keyof SequentialFunction) => {

            describe(method, () => {

                it('exists', () => {
                    expect(par[method]).toBeInstanceOf(Function);
                    expect(seq[method]).toBeInstanceOf(Function);
                });

                it('returns self', () => {
                    expect(par[method].call(par)).toBe(par);
                    expect(seq[method].call(par)).toBe(seq);
                });

            });

        });

        describe('clone', () => {

            it('has original methods', async () => {
                const par1 = par.clone();
                const seq1 = seq.clone();
                await Promise.all([ par1(), seq1() ]);
                expect(fn1.callCount).toBe(2);
                expect(fn2.callCount).toBe(2);
                expect(fn3.callCount).toBe(2);
            });

            it('is not modified by original', async () => {
                const fn4 = spy().returns(4);
                const par1 = par.clone();
                const seq1 = seq.clone();
                par.add(fn4);
                seq.add(fn4);
                await Promise.all([ par1(), seq1() ]);
                expect(fn4.called).toBe(false);
            });

            it('does not modify original', async () => {
                const par1 = par.clone();
                const seq1 = seq.clone();
                par1.remove(fn1);
                seq1.remove(fn1);
                await Promise.all([par(), seq()]);
                expect(fn1.called).toBe(true);
            });

            it('works as expected', async () => {
                expect(await par.clone()()).toEqual([1, 2, 3]);
                expect(await seq.clone()()).toBe(3);
            });

            it('has expected API', () => {
                const par1 = par.clone();
                const seq1 = seq.clone();
                ['add', 'remove', 'insert', 'clone'].forEach((method: keyof SequentialFunction) => {
                    expect(par1[method]).toBeInstanceOf(Function);
                    expect(seq1[method]).toBeInstanceOf(Function);
                });
            });

        });

        describe('add', () => {

            it('appends functions', async () => {
                const fn4 = spy();
                const fn5 = spy();
                par.add(fn4, fn5);
                seq.add(fn4, fn5);
                await Promise.all([ par(), seq() ]);
                expect(fn4.callCount).toBe(2);
                expect(fn5.callCount).toBe(2);
            });

        });

        describe('remove', () => {

            it('removes function', async () => {
                par.remove(fn2, fn3);
                seq.remove(fn2, fn3);
                await Promise.all([ par(), seq() ]);
                expect(fn1.called).toBe(true);
                expect(fn2.called).toBe(false);
                expect(fn3.called).toBe(false);
            });

        });

        describe('insert', () => {

            it('adds function at correct spot', async () => {
                const calls: any[] = [];
                const fn4 = spy();
                const insert = (value: any) => () => calls.push(value) && value;
                fn1.invokes(insert(1));
                fn2.invokes(insert(2));
                fn3.invokes(insert(3));
                fn4.invokes(insert(4));
                par.insert(1, fn4);
                seq.insert(1, fn4);
                expect(await par()).toEqual([1, 4, 2, 3]);
                expect(calls).toEqual([1, 4, 2, 3]);
                calls.length = 0;
                expect(await seq()).toBe(3);
                expect(calls).toEqual([1, 4, 2, 3]);
                expect(fn4.args).toEqual([1]);
                expect(fn2.args).toEqual([4]);
            });

        });

        it('combine as expected', async () => {
            const calls: any[] = [];
            const fn = (val: any) => () =>
                delay(5)().then(() => {
                    calls.push(val);
                    return val;
                });
            seq = sequence(
                parallel(fn(1), fn(2)),
                fn(3),
                sequence(fn(4), fn(1)),
            );
            expect(await seq()).toBe(1);
            expect(calls).toEqual([1, 2, 3, 4, 1]);
        });

    });

    describe('buffer', () => {

        let fn: Spy;
        beforeEach(() => fn = spy());

        it('works with async function', async () => {
            const calls: any[] = [];
            const signal = manualReset(true);
            fn.invokes(() => new Promise((resolve) => setTimeout(resolve, 10, calls.push(calls.length))));
            const buf = buffer(fn, [signal]);
            await Promise.all([ buf(), buf() ]);
            expect(fn.callCount).toBe(2);
            expect(calls).toEqual([0, 1]);
        });

        it('works with no signals', async () => {
            await buffer(fn, [])();
            expect(fn.called).toBe(true);
        });

        it('uses mapped results', async () => {
            const lastOnly = (arr: any[]) => arr.slice(-1);
            const buf = buffer(fn, [], lastOnly);
            await Promise.all([ buf(1), buf(2), buf(3) ]);
            expect(fn.callCount).toBe(1);
            expect(fn.args).toEqual([3]);
        });

        describe('queues until signaled', () => {

            it('with autoReset', (done) => {
                const signal = autoReset(false);
                const buf = buffer(fn, [signal]);
                expect(fn.called).toBe(false);
                Promise.all([
                    buf(),
                    buf(),
                    buf(),
                ]).then(() => {
                    expect(fn.callCount).toBe(3);
                    done();
                });
                signal.set();
                signal.set();
                signal.set();
            });

            it('with manualReset', async () => {
                const signal = manualReset(false);
                const ctx = Object.create(null);
                const buf = buffer(fn, [signal]);
                expect(fn.called).toBe(false);
                buf.call(ctx, 123, 456);
                await tick();
                expect(fn.called).toBe(false);
                signal.set();
                await tick();
                expect(fn.called).toBe(true);
                expect(fn.context).toBe(ctx);
                expect(fn.args).toEqual([123, 456]);
            });

        });

        describe('handles concurrency', () => {

            it('when invoked twice before signaled', (done) => {
                const signal = manualReset(false);
                const buf = buffer(fn, [signal]);
                Promise.all([
                    buf(),
                    buf(),
                ]).then(() => {
                    expect(fn.callCount).toBe(2);
                    done();
                });
                signal.set();
            });

            it('when signaled during invocation', async () => {
                const signal = autoReset(true);
                const buf = buffer(fn, [signal]);
                fn.invokes(() => signal.set());
                await Promise.all([buf(1), buf(2), buf(3)]);
                expect(fn.callCount).toBe(3);
                expect(fn.args).toEqual([3]);
            });

        });

    });

    describe('invokeIf', () => {

        let fn: Spy;
        beforeEach(() => fn = spy());

        it('invokes predicate with args and context', () => {
            const pred = spy().returns(true);
            const wrap = invokeIf(fn, pred);
            const context = Object.create(null);
            const args = ['abc', 123];
            wrap.apply(context, args);
            expect(pred.called).toBe(true);
            expect(pred.context).toBe(context);
            expect(pred.args).toEqual(args);
        });

        it('accepts function predicate', () => {
            invokeIf(fn, () => true)();
            expect(fn.called).toBe(true);
        });

        it('accepts key-value predicate', () => {
            invokeIf(fn, {key: 'value'})({a: true, key: 'value'});
            expect(fn.called).toBe(true);
        });

        it('accepts array predicate', () => {
            invokeIf(fn, ['key', 'value'])({a: true, key: 'value'});
            expect(fn.called).toBe(true);
        });

        it('does not invoke function if predicate is false', () => {
            invokeIf(fn, () => false)();
            expect(fn.called).toBe(false);
        });

    });

});
