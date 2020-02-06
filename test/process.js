import expect from 'expect';
import { spy } from './utils';
import { ERROR } from '../errors';
import { modelList } from '../models';
import {
    action,
    dependencies,
    transitions,
    process,
} from '../process';

describe('process', () => {

    const delay = (ms, value) => spy().invokes(() =>
        new Promise((resolve) =>
            setTimeout(resolve, ms, value)));

    describe('action', () => {

        it('assigns default methods', () => {
            const item = action('test');
            expect(item.name).toBe('test');
            ['init', 'execute', 'retry', 'rollback', 'success', 'failure']
                .forEach(method => expect(typeof item[method]).toBe('function'));
        });

        it('retry propagates rejection by default', (done) => {
            const error = new Error();
            const item = action('test');
            item.retry(error).catch((e) => {
                expect(e).toBe(error);
                done();
            });
        });

        it('mixes in provided methods', () => {
            const retry = spy();
            const rollback = spy();
            const item = action('test', { retry, rollback });
            expect(item.retry).toBe(retry);
            expect(item.rollback).toBe(rollback);
        });

        it('assumes function is execute method', () => {
            const exec = spy();
            const item = action('test', exec);
            expect(item.execute).toBe(exec);
        });

        it('mixes in provided members', () => {
            const props = { key: 'value' };
            expect(action('test', props)).toMatchObject(props);
        });

        it('does not overwrite defaults', () => {
            const a = action('a', spy());
            const b = action('b', spy());
            expect(a.retry).toBe(b.retry);
            a.retry = spy();
            expect(a.retry).not.toBe(b.retry);
        });

    });

    describe('process', () => {

        let a, b, c;
        beforeEach(() => {
            a = spy();
            b = spy();
            c = spy();
        });

        it('allows iterable actions - Set', async () => {
            process('test', new Set([
                action('a', a),
                action('b', b),
                action('c', c),
            ]), dependencies())();
            await new Promise(setTimeout);
            expect(a.called).toBe(true);
            expect(b.called).toBe(true);
            expect(c.called).toBe(true);
        });

        it('allows iterable actions - array', async () => {
            process('test', [
                action('a', a),
                action('b', b),
                action('c', c),
            ], dependencies())();
            await new Promise(setTimeout);
            expect(a.called).toBe(true);
            expect(b.called).toBe(true);
            expect(c.called).toBe(true);
        });

        it('allows iterable actions - ModelList', async () => {
            process('test', modelList(
                action('a', a),
                action('b', b),
                action('c', c),
            ), dependencies())();
            await new Promise(setTimeout);
            expect(a.called).toBe(true);
            expect(b.called).toBe(true);
            expect(c.called).toBe(true);
        });

    });

    describe('dependencies', () => {

        it('uses empty object if none provided', () => {
            const context = { completed: [], started: [] };
            const actions = [ { name: 'a' }, { name: 'b' }];
            const { getInitialActions } = dependencies();
            expect( getInitialActions(actions, context) ).toEqual(actions);
        });

    });

    describe('transitions', () => {

        it('uses empty array if none provided', () => {
            const context = { completed: [], started: [] };
            const actions = [{ name: 'a' }, { name: 'b' }];
            const { getInitialActions } = transitions();
            expect( getInitialActions(actions, context) ).toEqual(actions.slice(0, 1));
        });

        it('returns empty array if no actions available', () => {
            const actions = [];
            const context = { completed: [], started: [] };
            const { getInitialActions } = transitions();
            expect( getInitialActions(actions, context) ).toEqual([]);
        });

    });

    function sharedTests(getList, factory, method) {

        let actions, a, b, c;

        beforeEach(() => {
            actions = getList().items();
            a = actions[0];
            b = actions[1];
            c = actions[2];
        });

        it('returns start function', () => {
            const start = factory();
            expect(typeof start).toBe('function');
        });

        it('start returns Promise', () => {
            const start = factory();
            expect(typeof start().then).toBe('function');
        });

        it('stop after start does nothing', () => {
            const start = factory();
            const promise = start();
            promise.stop();
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

        it('context includes action instance members', () => {
            a.instance = 1;
            b.instance = 2;
            a.execute = spy();
            b.execute = spy();
            return factory()().then(() => {
                expect(a.execute.context.instance).toBe(1);
                expect(b.execute.context.instance).toBe(2);
            });
        });

        it('promise rejects if action throws', (done) => {
            a.execute = spy().throws(new Error('failed'));
            factory()().catch((err) => {
                expect(err.completed).toEqual([]);
                expect(err.action).toBe('a');
                expect(err.running).toContain('a');
                expect(err.process).toBe('test');
                expect(err.message).toBe('failed');
                done();
            });
        });

        it('promise rejects if action rejects', (done) => {
            a.execute = spy().returns(Promise.reject(new Error('failed')));
            factory()().catch((err) => {
                expect(err.completed).toEqual([]);
                expect(err.action).toBe('a');
                expect(err.running).toContain('a');
                expect(err.process).toBe('test');
                expect(err.message).toBe('failed');
                done();
            });
        });

        it('promise resolves if retry resolves', () => {
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

        it('rollback only called for executed actions', (done) => {
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

        it('success called on all actions if resolved', (done) => {
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

        it('failure called on all actions if rejected', (done) => {
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

        it('rollback and failure errors have metadata', (done) => {
            const error = new Error('fail');
            const verify = spy().invokes((err) => {
                expect(err).toBe(error);
                expect(err).toMatchObject({
                    message: 'fail',
                    process: expect.any(String),
                    completed: expect.any(Array),
                    running: expect.any(Array)
                });
                if (verify.callCount === 4)
                    done();
            });
            a.failure = verify;
            b.failure = verify;
            c.failure = verify;
            b.rollback = verify;
            b.execute = spy().throws(error);
            factory()().catch(Function.prototype);
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
            setTimeout(() => promise.cancel());
        });

    }

    function within(value1, value2, delta) {
        return Math.abs(value1 - value2) <= delta;
    }

    describe('dependencies', () => {

        let actions, a, b, c;

        const series = {
            b: ['a'],
            c: ['b'],
            d: ['c']
        };

        beforeEach(() => {
            actions = modelList();
            a = action('a', delay(10, 1));
            b = action('b', delay(10, 2));
            c = action('c', delay(10, 3));
            actions.add(a, b, c);
        });

        sharedTests(
            () => actions,
            () => process('test', actions, dependencies(series)),
            () => process('test', modelList(), dependencies())
        );

        it('dispatch passes args through context', () => {
            a.execute = spy();
            return process('test', actions, dependencies())(123, 'abc')
                .then(() => expect(a.execute.context.args).toEqual([123, 'abc']));
        });

        describe('dependencies', () => {

            let d;
            beforeEach(() => actions.add(d = action('d', delay(10, 4))));

            it('series', () => {
                const dispatch = process('test', actions, dependencies(series));
                return dispatch().then(() => {
                    expect(b.execute.callTime > a.execute.callTime).toBe(true);
                    expect(c.execute.callTime > b.execute.callTime).toBe(true);
                    expect(d.execute.callTime > c.execute.callTime).toBe(true);
                });
            });

            it('parallel', () => {
                const dispatch = process('test', actions, dependencies());
                return dispatch().then(() => {
                    expect(within(a.execute.callTime, b.execute.callTime, 5)).toBe(true);
                    expect(within(a.execute.callTime, c.execute.callTime, 5)).toBe(true);
                    expect(within(a.execute.callTime, d.execute.callTime, 5)).toBe(true);
                });
            });

            it('nested parallel', () => {
                const dispatch = process('test', actions, dependencies({
                    b: ['a'],
                    c: ['b'],
                    d: ['b']
                }));
                return dispatch().then(() => {
                    expect(within(b.execute.callTime, a.execute.callTime, 5)).toBe(false);
                    expect(within(c.execute.callTime, b.execute.callTime, 5)).toBe(false);
                    expect(within(d.execute.callTime, b.execute.callTime, 5)).toBe(false);
                    expect(within(c.execute.callTime, d.execute.callTime, 10)).toBe(true);
                });
            });

            it('nested series', () => {
                const dispatch = process('test', actions, dependencies({
                    b: ['a'],
                    c: ['a'],
                    d: ['c']
                }));
                return dispatch().then(() => {
                    expect(b.execute.callTime - a.execute.callTime).not.toBeLessThan(5);
                    expect(c.execute.callTime - a.execute.callTime).not.toBeLessThan(5);
                    expect(d.execute.callTime - c.execute.callTime).not.toBeLessThan(5);
                    expect(within(c.execute.callTime, b.execute.callTime, 10)).toBe(true);
                });
            });

        });

    });

    describe('transitions', () => {

        let actions, a, b, c, criteria;

        beforeEach(() => {
            actions = modelList();
            a = action('a', delay(10, 1));
            b = action('b', delay(10, 2));
            c = action('c', spy().invokes(function() {
                this.stop();
            }));
            criteria = [
                ['a', 'b'],
                ['b', 'c']
            ];
            actions.add(a, b, c);
        });

        sharedTests(
            () => actions,
            () => process('test', actions, transitions(criteria)),
            () => process('test', modelList(), transitions())
        );

        it('start passes conditions through context', () => {
            a.execute = spy();
            const conditions = { key: 'value' };
            return process('test', actions, transitions(criteria))('a', conditions)
                .then(() => expect(a.execute.context.conditions).toMatchObject(conditions));
        });

        describe('update', () => {

            it('merges conditions into context', () => {
                b.execute = spy();
                const conditions = { key: 'value' }
                const promise = process('test', actions, transitions(criteria))();
                promise.update(conditions);
                return promise.then(() =>
                    expect(b.execute.context.conditions).toMatchObject(conditions))
            });

            it('handles empty conditions', () => {
                b.execute = spy();
                const conditions = { key: 'value' }
                const promise = process('test', actions, transitions(criteria))('a', conditions);
                promise.update();
                return promise.then(() =>
                    expect(b.execute.context.conditions).toMatchObject(conditions))
            });

            it('goes to next matching action at end of action', () => {
                const promise = process('test', actions, transitions([
                    ['a', 'b'],
                    ['b', 'c', { goTo: 'c' }]
                ]))();
                setTimeout(promise.update, 20, { goTo: 'c' });
                return promise.then(() => {
                    expect(a.execute.callTime < b.execute.callTime).toBe(true);
                    expect(b.execute.callTime < c.execute.callTime).toBe(true);
                });
            });

            it('invokes next matching action if not in action', () => {
                const promise = process('test', actions, transitions([
                    ['a', 'b', 'goB'],
                    ['b', 'c', ['goTo', 'c']]
                ]))();
                setTimeout(promise.update, 20, { goB: true });
                setTimeout(promise.update, 40, { goTo: 'c' });
                return promise.then(() => {
                    expect(within(a.execute.callTime, b.execute.callTime, 15)).toBe(false);
                    expect(within(b.execute.callTime, c.execute.callTime, 15)).toBe(false);
                });
            });

            it('does nothing if no matching action and not in action', () => {
                const promise = process('test', actions, transitions([
                    ['a', 'b'],
                    ['b', 'c', ['goTo', 'c']]
                ]))();
                setTimeout(promise.update, 20, { goTo: 'd' });
                setTimeout(promise.update, 40, { goTo: 'c' });
                return promise.then(() => {
                    expect(within(b.execute.callTime, c.execute.callTime, 25)).toBe(false);
                    expect(within(b.execute.callTime, c.execute.callTime, 45)).toBe(true);
                });
            });

        });

        describe('stop', () => {

            it('resolves machine with results', () => {
                c.execute = spy();
                b.execute = function() { this.stop() };
                return process('test', actions, transitions([
                    ['a', 'b'],
                    ['b', 'c']
                ]))().then((results) => {
                    expect(results).toMatchObject({ a: 1 });
                    expect(results.b).toBeUndefined();
                    expect(results.c).toBeUndefined();
                    expect(c.execute.called).toBe(false);
                });
            });

            it('prevents executing next action on update', () => {
                a.execute = function() { this.stop() };
                b.execute = spy();
                c.execute = spy();
                const promise = process('test', actions, transitions([
                    ['a', 'b', 'goB'],
                    ['b', 'c', 'goC']
                ]))();
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