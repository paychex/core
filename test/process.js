import expect from 'expect';
import { spy } from './utils';
import { ERROR } from '../errors';
import { modelList } from '../models';
import {
    step,
    workflow,
    stateMachine,
} from '../process';

describe('steps', () => {

    let time;
    beforeEach(() => time = {});

    describe('step', () => {

        it('assigns default methods', () => {
            const item = step('test');
            expect(item.name).toBe('test');
            ['init', 'execute', 'retry', 'rollback', 'success', 'failure']
                .forEach(method => expect(typeof item[method]).toBe('function'));
        });

        it('retry propagates rejection by default', (done) => {
            const error = new Error();
            const item = step('test');
            item.retry(error).catch((e) => {
                expect(e).toBe(error);
                done();
            });
        });

        it('mixes in provided methods', () => {
            const retry = spy();
            const rollback = spy();
            const item = step('test', { retry, rollback });
            expect(item.retry).toBe(retry);
            expect(item.rollback).toBe(rollback);
        });

        it('assumes function is execute method', () => {
            const exec = spy();
            const item = step('test', exec);
            expect(item.execute).toBe(exec);
        });

        it('mixes in provided members', () => {
            const props = { key: 'value' };
            expect(step('test', props)).toMatchObject(props);
        });

    });

    function sharedTests(getList, factory, method) {

        let a, b, c;

        beforeEach(() => {
            const steps = getList().items();
            a = steps[0];
            b = steps[1];
            c = steps[2];
        });

        it('returns start function', () => {
            const start = factory();
            expect(typeof start).toBe('function');
        });

        it('start returns Promise', () => {
            const start = factory();
            expect(typeof start().then).toBe('function');
        });

        it('empty process immediately resolves', () => {
            return method()().then((results) =>
                expect(results).toEqual({}));
        });

        it('promise has expected methods', () => {
            const promise = factory()();
            ['update', 'cancel', 'stop'].forEach(method =>
                expect(typeof promise[method]).toBe('function'));
        });

        it('context has expected methods', () => {
            a.execute = spy();
            return factory()().then(() =>
                expect(['cancel', 'update', 'stop'].every(method =>
                    expect(typeof a.execute.context[method]).toBe('function'))));
        });

        it('context includes unique step members', () => {
            a.instance = 1;
            b.instance = 2;
            a.execute = spy();
            b.execute = spy();
            return factory()().then(() => {
                expect(a.execute.context.instance).toBe(1);
                expect(b.execute.context.instance).toBe(2);
            });
        });

        it('promise rejects if state fails', (done) => {
            a.execute = spy().throws(new Error('failed'));
            factory()().catch((err) => {
                expect(err.completed).toEqual([]);
                expect(err.step).toBe('a');
                expect(err.running).toContain('a');
                expect(err.process).toBe('test');
                expect(err.message).toBe('failed');
                done();
            });
        });

        it('step resolves if retry resolves', () => {
            let count = 0;
            a.execute = spy().throws(new Error('failed'));
            a.retry = () => {
                if (++count === 3)
                    a.execute.returns('success');
                return Promise.resolve();
            };
            return factory()().then((results) => {
                expect(count).toBe(3);
                expect(results.a).toBe('success');
            });
        });

        it('init only called once per dispatch', () => {
            a.init = spy();
            a.retry = () => a.execute.returns(1);
            a.execute = spy().throws(new Error('failed'));
            const dispatch = factory();
            return dispatch().then(() => {
                expect(a.init.callCount).toBe(1);
                return dispatch().then(() =>
                    expect(a.init.callCount).toBe(2));
            });
        });

        it('promise resolves with results', () => {
            return factory()()
                .then(results =>
                    expect(results).toMatchObject({
                        a: 1,
                        b: 2
                    }));
        });

        it('rollback only called for executed states', (done) => {
            const err = new Error('fail');
            a.execute = spy().throws(err);
            a.rollback = spy();
            b.rollback = spy();
            c.rollback = spy();
            factory()().catch((error) => {
                expect(a.rollback.called).toBe(true);
                expect(b.rollback.called).toBe(false);
                expect(c.rollback.called).toBe(false);
                expect(a.rollback.args[0]).toBe(err);
                expect(error).toBe(err);
                done();
            });
        });

        it('success called on all states if resolved', (done) => {
            a.success = spy();
            b.success = spy();
            c.success = spy();
            factory()().then(() => {
                expect(a.success.called).toBe(true);
                expect(b.success.called).toBe(true);
                expect(c.success.called).toBe(true);
                done();
            });
        });

        it('failure called on all states if rejected', (done) => {
            const err = new Error('fail');
            b.execute = spy().throws(err);
            a.failure = spy();
            b.failure = spy();
            c.failure = spy();
            factory()().catch(() => {
                expect(a.failure.called).toBe(true);
                expect(b.failure.called).toBe(true);
                expect(c.failure.called).toBe(true);
                done();
            });
        });

        it('cancel mixes in data', (done) => {
            const promise = factory()();
            promise.catch((err) => {
                expect(err.key).toBe('value');
                expect(err.severity).toBe(ERROR);
                expect(err.message).toBe('Process cancelled.');
                done();
            });
            promise.cancel({ key: 'value' });
        });

        it('cancel() aborts', (done) => {
            const promise = factory()();
            promise.catch((err) => {
                setTimeout(() => {
                    expect(err.running).toContain('a');
                    expect(err.running).not.toContain('b');
                    expect(err.running).not.toContain('b');
                    expect(err.completed).not.toContain('c');
                    expect(err.completed).not.toContain('c');
                    done();
                }, 50);
            });
            promise.cancel();
        });

    }

    function timestamp(method, key) {
        return function (...args) {
            time[key] = Date.now();
            return method.apply(this, args);
        };
    }

    function within(value1, value2, delta) {
        return Math.abs(value1 - value2) <= delta;
    }

    describe('workflow', () => {

        let steps, a, b, c;

        const series = {
            b: ['a'],
            c: ['b'],
            d: ['c']
        };

        const delay = (ms, value) => () =>
            new Promise((resolve) =>
                setTimeout(resolve, ms, value));

        beforeEach(() => {
            steps = modelList();
            a = step('a', delay(10, 1));
            b = step('b', delay(10, 2));
            c = step('c', delay(10, 3));
            steps.add(a, b, c);
        });

        sharedTests(
            () => steps,
            () => workflow('test', steps, series),
            () => workflow('test', modelList())
        );

        it('dispatch passes args through context', () => {
            a.execute = spy();
            return workflow('test', steps)(123, 'abc')
                .then(() => expect(a.execute.context.args).toEqual([123, 'abc']));
        });

        describe('dependencies', () => {

            let d;
            beforeEach(() => steps.add(d = step('d', delay(10, 4))));

            beforeEach(() => {
                a.execute = timestamp(a.execute, 'a');
                b.execute = timestamp(b.execute, 'b');
                c.execute = timestamp(c.execute, 'c');
                d.execute = timestamp(d.execute, 'd');
            });

            it('series', () => {
                const dispatch = workflow('test', steps, series);
                return dispatch().then(() => {
                    expect(time.b - time.a).not.toBeLessThan(5);
                    expect(time.c - time.b).not.toBeLessThan(5);
                    expect(time.d - time.c).not.toBeLessThan(5);
                });
            });

            it('parallel', () => {
                const dispatch = workflow('test', steps);
                return dispatch().then(() => {
                    expect(within(time.a, time.b, 5)).toBe(true);
                    expect(within(time.a, time.c, 5)).toBe(true);
                    expect(within(time.a, time.d, 5)).toBe(true);
                });
            });

            it('nested parallel', () => {
                const dispatch = workflow('test', steps, {
                    b: ['a'],
                    c: ['b'],
                    d: ['b']
                });
                return dispatch().then(() => {
                    expect(time.b - time.a).not.toBeLessThan(5);
                    expect(time.c - time.b).not.toBeLessThan(5);
                    expect(time.d - time.b).not.toBeLessThan(5);
                    expect(within(time.c, time.d, 10)).toBe(true);
                });
            });

            it('nested series', () => {
                const dispatch = workflow('test', steps, {
                    b: ['a'],
                    c: ['a'],
                    d: ['c']
                });
                return dispatch().then(() => {
                    expect(time.b - time.a).not.toBeLessThan(5);
                    expect(time.c - time.a).not.toBeLessThan(5);
                    expect(time.d - time.c).not.toBeLessThan(5);
                    expect(within(time.c, time.b, 10)).toBe(true);
                });
            });

        });

    });

    describe('stateMachine', () => {

        let states, a, b, c, transitions;

        const delay = (ms, value) => () =>
            new Promise((resolve) =>
                setTimeout(resolve, ms, value));

        beforeEach(() => {
            states = modelList();
            a = step('a', delay(10, 1));
            b = step('b', delay(10, 2));
            c = step('c', function() {
                this.stop();
            });
            transitions = [
                ['a', 'b'],
                ['b', 'c']
            ];
            states.add(a, b, c);
        });

        sharedTests(
            () => states,
            () => stateMachine('test', states, transitions),
            () => stateMachine('test', modelList())
        );

        it('start passes conditions through context', () => {
            a.execute = spy();
            const conditions = { key: 'value' };
            return stateMachine('test', states, transitions)('a', conditions)
                .then(() => expect(a.execute.context.conditions).toMatchObject(conditions));
        });

        describe('update', () => {

            beforeEach(() => {
                a.execute = timestamp(a.execute, 'a');
                b.execute = timestamp(b.execute, 'b');
                c.execute = timestamp(c.execute, 'c');
            });

            it('merges conditions into context', () => {
                b.execute = spy();
                const conditions = { key: 'value' }
                const promise = stateMachine('test', states, transitions)();
                promise.update(conditions);
                return promise.then(() =>
                    expect(b.execute.context.conditions).toMatchObject(conditions))
            });

            it('handles empty conditions', () => {
                b.execute = spy();
                const conditions = { key: 'value' }
                const promise = stateMachine('test', states, transitions)('a', conditions);
                promise.update();
                return promise.then(() =>
                    expect(b.execute.context.conditions).toMatchObject(conditions))
            });

            it('goes to next matching state at end of state', () => {
                const promise = stateMachine('test', states, [
                    ['a', 'b'],
                    ['b', 'c', { goTo: 'c' }]
                ])();
                setTimeout(promise.update, 20, { goTo: 'c' });
                return promise.then(() => {
                    expect(within(time.a, time.b, 20)).toBe(true);
                    expect(within(time.b, time.c, 20)).toBe(true);
                });
            });

            it('invokes next matching state if not in state', () => {
                const promise = stateMachine('test', states, [
                    ['a', 'b', 'goB'],
                    ['b', 'c', ['goTo', 'c']]
                ])();
                setTimeout(promise.update, 20, { goB: true });
                setTimeout(promise.update, 40, { goTo: 'c' });
                return promise.then(() => {
                    expect(within(time.a, time.b, 15)).toBe(false);
                    expect(within(time.b, time.c, 15)).toBe(false);
                });
            });

            it('does nothing if no matching state and not in state', () => {
                const promise = stateMachine('test', states, [
                    ['a', 'b'],
                    ['b', 'c', ['goTo', 'c']]
                ])();
                setTimeout(promise.update, 20, { goTo: 'd' });
                setTimeout(promise.update, 40, { goTo: 'c' });
                return promise.then(() => {
                    expect(within(time.a, time.b, 20)).toBe(true);
                    expect(within(time.b, time.c, 25)).toBe(false);
                    expect(within(time.b, time.c, 45)).toBe(true);
                });
            });

        });

        describe('stop', () => {

            it('resolves machine with results', () => {
                c.execute = spy();
                b.execute = function() { this.stop() };
                return stateMachine('test', states, [
                    ['a', 'b'],
                    ['b', 'c']
                ])().then((results) => {
                    expect(results).toMatchObject({ a: 1 });
                    expect(results.b).toBeUndefined();
                    expect(results.c).toBeUndefined();
                    expect(c.execute.called).toBe(false);
                });
            });

            it('prevents executing next state on update', () => {
                a.execute = function() { this.stop() };
                b.execute = spy();
                c.execute = spy();
                const promise = stateMachine('test', states, [
                    ['a', 'b', 'goB'],
                    ['b', 'c', 'goC']
                ])();
                return promise.then((results) => {
                    promise.update({ goB: true, goC: true });
                    expect(b.execute.called).toBe(false);
                    expect(c.execute.called).toBe(false);
                    expect(results.b).toBeUndefined();
                    expect(results.c).toBeUndefined();
                });
            });

        });

    });

});