import expect from 'expect';
import { spy } from './utils.js';
import {
    eventBus,
    sequence,
    parallel,
} from '../index.js';

const delay = (ms, value) =>
    () => new Promise(resolve =>
        setTimeout(resolve, ms, value));

describe('eventBus', () => {

    let bus;

    beforeEach(() => bus = eventBus());

    it('has expected methods', () => {
        expect(bus).toBeDefined();
        ['on', 'one', 'fire', 'stop', 'resume'].forEach(method => {
            expect(typeof bus[method]).toBe('function');
        })
    });

    describe('on', () => {

        it('adds subscriber', () => {
            const handler = spy();
            bus.on('test', handler);
            bus.fire('test', 1, 2);
            expect(handler.called).toBe(true);
            expect(handler.args).toEqual([1, 2]);
        });

        it('returns off function', () => {
            const handler = spy();
            const off = bus.on('test', handler);
            expect(typeof off).toBe('function');
            expect(off).not.toThrow();
            bus.fire('test');
            expect(handler.called).toBe(false);
        });

    });

    describe('one', () => {

        it('only runs once', () => {
            const handler = spy();
            bus.one('test', handler);
            bus.fire('test');
            bus.fire('test');
            bus.fire('test');
            expect(handler.called).toBe(true);
            expect(handler.callCount).toBe(1);
        });

        it('returns off function', () => {
            expect(typeof bus.one('test', spy())).toBe('function');
        });

        it('does not invoke if off called', () => {
            const handler = spy();
            bus.one('test', handler)(/* off */);
            bus.fire('test');
            expect(handler.called).toBe(false);
        });

    });

    describe('fire', () => {

        it('does nothing if no subscribers', () => {
            expect(() => bus.fire('does not exist')).not.toThrow();
        });

        it('invokes "on" subscriber with specified context', () => {
            const handler = spy();
            const context = Object.create(null);
            bus = eventBus(context);
            bus.on('test', handler);
            bus.fire('test');
            expect(handler.context).toBe(context);
        });

        it('invokes "one" subscriber with specified context', () => {
            const handler = spy();
            const context = Object.create(null);
            bus = eventBus(context);
            bus.one('test', handler);
            bus.fire('test');
            expect(handler.context).toBe(context);
        });

        it('notifies subscribers in sequence', () => {
            const calls = [];
            bus.on('test', () => calls.push(1));
            bus.on('test', () => calls.push(3));
            bus.on('test', () => calls.push(2));
            bus.fire('test');
            expect(calls).toEqual([1, 3, 2]);
        });

        it('returns Promise resolved with return values', async () => {
            bus.on('test', delay(20, 1));
            bus.on('test', () => Promise.resolve(3));
            bus.on('test', () => 2);
            const result = await bus.fire('test');
            expect(result).toEqual([1, 3, 2]);
        });

        it('rejects if any subscriber rejects', async () => {
            const err = new Error('rejected');
            bus.on('test', () => 1);
            bus.on('test', () => Promise.reject(err));
            bus.on('test', () => 2);
            try {
                await bus.fire('test', 'a', 'b');
                throw new Error('should not be reached');
            } catch (e) {
                expect(e).toBe(err);
                expect(e).toMatchObject({
                    event: 'test',
                    args: ['a', 'b']
                });
            }
        });

        it('rejects if any subscriber throws', async () => {
            const err = new Error();
            bus.on('test', () => { throw err; });
            try {
                await bus.fire('test');
                throw new Error('should not be reached');
            } catch (e) {
                expect(e).toBe(err);
            }
        });

    });

    describe('stop', () => {

        it('does not notify listeners', () => {
            const handler = spy();
            bus.on('event', handler);
            bus.stop();
            bus.fire('event');
            expect(handler.called).toBe(false);
        });

        it('returns false from fire()', () => {
            bus.stop();
            expect(bus.fire('event')).toBe(false);
        });

    });

    describe('resume', () => {

        it('does not queue events', () => {
            const handler = spy();
            bus.on('event', handler);
            bus.stop();
            bus.fire('event');
            bus.resume();
            expect(handler.called).toBe(false);
        });

        it('notifies listeners', () => {
            const handler = spy();
            bus.on('event', handler);
            bus.stop();
            bus.resume();
            bus.fire('event');
            expect(handler.called).toBe(true);
        });

    });

});

describe('sequence', () => {

    let seq, fn1, fn2, fn3;

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
        const bus = eventBus(context);
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

    let par, fn1, fn2, fn3;

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
        const bus = eventBus(context);
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

    let par, seq, fn1, fn2, fn3;

    beforeEach(() => {
        fn1 = spy().returns(Promise.resolve(1));
        fn2 = spy().invokes(delay(5, 2));
        fn3 = spy().returns(3);
        par = parallel(fn1, fn2, fn3);
        seq = sequence(fn1, fn2, fn3);
    });

    ['add', 'remove', 'insert'].forEach(method => {

        describe(method, () => {

            it('exists', () => {
                expect(typeof par[method]).toBe('function');
                expect(typeof seq[method]).toBe('function');
            });

            it('returns self', () => {
                expect(par[method]()).toBe(par);
                expect(seq[method]()).toBe(seq);
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
            ['add', 'remove', 'insert', 'clone'].forEach(method => {
                expect(typeof par1[method]).toBe('function');
                expect(typeof seq1[method]).toBe('function');
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
            const calls = [];
            const fn4 = spy();
            const insert = (value) => () => calls.push(value) && value;
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
        const calls = [];
        const fn = val => () =>
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
