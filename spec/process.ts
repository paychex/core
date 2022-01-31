import * as expect from 'expect';
import { spy } from './index';
import { ERROR } from '../errors/index';
import { collection } from '../models/index';
import {
    action,
    dependencies,
    transitions,
    create,
    ProcessLogic,
} from '../process/index';
import { Action, ProcessTransition } from '../process';
import { ModelCollection } from '../models';
import { Spy } from './index';

describe('process', () => {

    const delay = (ms: number = 0, value?: any) => spy().invokes(() =>
        new Promise((resolve) =>
            setTimeout(resolve, ms, value)));

    describe('action', () => {

        it('assigns default methods', () => {
            const item = action('test');
            expect(item.name).toBe('test');
            ['init', 'execute', 'retry', 'rollback', 'success', 'failure']
                .forEach((method: keyof Action) =>
                    expect(item[method]).toBeInstanceOf(Function));
        });

        it('retry propagates rejection by default', (done) => {
            const error = new Error();
            const item = action('test');
            item.retry(error).catch((e: Error) => {
                expect(e).toBe(error);
                done();
            });
        });

        it('mixes in provided methods', () => {
            const retry: any = spy();
            const rollback: any = spy();
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

    describe('create', () => {

        let a: Spy,
            b: Spy,
            c: Spy;

        beforeEach(() => {
            a = spy();
            b = spy();
            c = spy();
        });

        it('allows iterable actions - Set', async () => {
            create('test', new Set([
                action('a', a),
                action('b', b),
                action('c', c),
            ]), dependencies())();
            await delay()();
            expect(a.called).toBe(true);
            expect(b.called).toBe(true);
            expect(c.called).toBe(true);
        });

        it('allows iterable actions - array', async () => {
            create('test', [
                action('a', a),
                action('b', b),
                action('c', c),
            ], dependencies())();
            await delay()();
            expect(a.called).toBe(true);
            expect(b.called).toBe(true);
            expect(c.called).toBe(true);
        });

        it('allows iterable actions - ModelList', async () => {
            create('test', collection(
                action('a', a),
                action('b', b),
                action('c', c),
            ), dependencies())();
            await delay()();
            expect(a.called).toBe(true);
            expect(b.called).toBe(true);
            expect(c.called).toBe(true);
        });

    });

    describe('dependencies', () => {

        it('uses empty object if none provided', () => {
            const context: any = { completed: [], started: [] };
            const actions = [action('a'), action('b')];
            const { getInitialActions } = dependencies();
            expect( getInitialActions(actions, context) ).toEqual(actions);
        });

    });

    describe('transitions', () => {

        it('uses empty array if none provided', () => {
            const context: any = { completed: [], started: [] };
            const actions = [action('a'), action('b')];
            const { getInitialActions } = transitions();
            expect( getInitialActions(actions, context) ).toEqual(actions.slice(0, 1));
        });

        it('returns empty array if no actions available', () => {
            const actions: Action[] = [];
            const context: any = { completed: [], started: [] };
            const { getInitialActions } = transitions();
            expect( getInitialActions(actions, context) ).toEqual([]);
        });

    });

    function sharedTests(getList: Function, factory: Function, method: Function) {

        let actions: ArrayLike<Action>,
            a: Action,
            b: Action,
            c: Action;

        beforeEach(() => {
            actions = getList().items();
            a = actions[0];
            b = actions[1];
            c = actions[2];
        });

        it('returns start function', () => {
            const start = factory();
            expect(start).toBeInstanceOf(Function);
        });

        it('start returns Promise', () => {
            const start = factory();
            expect(start().then).toBeInstanceOf(Function);
        });

        it('stop after start does nothing', () => {
            const start = factory();
            const promise = start();
            promise.stop();
        });

        it('empty process immediately resolves', () => {
            return method()().then((results: any) =>
                expect(results).toEqual({}));
        });

        it('promise has expected methods', () => {
            const promise = factory()();
            ['update', 'cancel', 'stop'].forEach(name =>
                expect(promise[name]).toBeInstanceOf(Function));
        });

        it('context has expected methods', () => {
            (a as any).execute = spy();
            return factory()().then(() =>
                expect(['cancel', 'update', 'stop'].every((name: 'cancel'|'update'|'stop') =>
                    expect((a.execute as Spy).context[name]).toBeInstanceOf(Function))));
        });

        it('context includes action instance members', () => {
            (a as any).instance = 1;
            (b as any).instance = 2;
            (a as any).execute = spy();
            (b as any).execute = spy();
            return factory()().then(() => {
                expect((a.execute as Spy).context.instance).toBe(1);
                expect((b.execute as Spy).context.instance).toBe(2);
            });
        });

        const verifyError = (done: Function) => (err: any) => {
            expect(err.completed).toEqual([]);
            expect(err.action).toBe('a');
            expect(err.running).toContain('a');
            expect(err.process).toBe('test');
            expect(err.message).toBe('failed');
            done();
        };

        it('promise rejects if action throws', (done) => {
            (a as any).execute = spy().throws(new Error('failed'));
            factory()().catch(verifyError(done));
        });

        it('promise rejects if action rejects', (done) => {
            (a as any).execute = spy().returns(Promise.reject(new Error('failed')));
            factory()().catch(verifyError(done));
        });

        it('promise resolves if retry resolves', () => {
            let count = 0;
            (a as any).execute = spy().throws(new Error('failed'));
            a.retry = () => {
                if (++count === 3)
                    (a.execute as Spy).returns('success');
                return Promise.resolve();
            };
            return factory()().then((results: any) => {
                expect(count).toBe(3);
                expect(results.a).toBe('success');
            });
        });

        it('init only called once per dispatch', () => {
            (a as any).init = spy();
            a.retry = () => (a.execute as Spy).returns(1);
            (a as any).execute = spy().throws(new Error('failed'));
            const dispatch = factory();
            return dispatch().then(() => {
                expect((a.init as Spy).callCount).toBe(1);
                return dispatch().then(() =>
                    expect((a.init as Spy).callCount).toBe(2));
            });
        });

        it('promise resolves with results', () => {
            return factory()()
                .then((results: any) =>
                    expect(results).toMatchObject({
                        a: 1,
                        b: 2
                    }));
        });

        it('rollback only called for executed actions', (done) => {
            const err = new Error('fail');
            (a as any).execute = spy().throws(err);
            (a as any).rollback = spy();
            (b as any).rollback = spy();
            (c as any).rollback = spy();
            factory()().catch((error: any) => {
                expect((a.rollback as Spy).called).toBe(true);
                expect((b.rollback as Spy).called).toBe(false);
                expect((c.rollback as Spy).called).toBe(false);
                expect((a.rollback as Spy).args[0]).toBe(err);
                expect(error).toBe(err);
                done();
            });
        });

        it('success called on all actions if resolved', (done) => {
            (a as any).success = spy();
            (b as any).success = spy();
            (c as any).success = spy();
            factory()().then(() => {
                expect((a.success as Spy).called).toBe(true);
                expect((b.success as Spy).called).toBe(true);
                expect((c.success as Spy).called).toBe(true);
                done();
            });
        });

        it('failure called on all actions if rejected', (done) => {
            const err = new Error('fail');
            (b as any).execute = spy().throws(err);
            (a as any).failure = spy();
            (b as any).failure = spy();
            (c as any).failure = spy();
            factory()().catch(() => {
                expect((a.failure as Spy).called).toBe(true);
                expect((b.failure as Spy).called).toBe(true);
                expect((c.failure as Spy).called).toBe(true);
                done();
            });
        });

        it('rollback and failure errors have metadata', (done) => {
            const error = new Error('fail');
            const verify = spy().invokes((err: any) => {
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
            (a as any).failure = verify;
            (b as any).failure = verify;
            (c as any).failure = verify;
            (b as any).rollback = verify;
            (b as any).execute = spy().throws(error);
            factory()().catch(Function.prototype);
        });

        it('cancel mixes in data', (done) => {
            const promise = factory()();
            promise.catch((err: any) => {
                expect(err.key).toBe('value');
                expect(err.severity).toBe(ERROR);
                expect(err.message).toBe('Process cancelled.');
                done();
            });
            promise.cancel({ key: 'value' });
        });

        it('cancel() aborts', (done) => {
            const promise = factory()();
            promise.catch((err: any) => {
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

    function within(value1: any, value2: any, delta: number): boolean {
        return Math.abs(value1 - value2) <= delta;
    }

    describe('dependencies', () => {

        let actions: ModelCollection,
            a: Action,
            b: Action,
            c: Action;

        const series = {
            b: ['a'],
            c: ['b'],
            d: ['c']
        };

        beforeEach(() => {
            actions = collection();
            a = action('a', delay(10, 1));
            b = action('b', delay(10, 2));
            c = action('c', delay(10, 3));
            actions.add(a, b, c);
        });

        sharedTests(
            () => actions,
            () => create('test', actions, dependencies(series)),
            () => create('test', collection(), dependencies())
        );

        it('dispatch passes args through context', () => {
            (a as any).execute = spy();
            return create('test', actions, dependencies())(123, 'abc')
                .then(() => expect((a.execute as Spy).context.args).toEqual([123, 'abc']));
        });

        describe('dependencies', () => {

            let d: Action;
            beforeEach(() => actions.add(d = action('d', delay(10, 4))));

            it('series', () => {
                const dispatch = create('test', actions, dependencies(series));
                return dispatch().then(() => {
                    expect((b.execute as Spy).callTime > (a.execute as Spy).callTime).toBe(true);
                    expect((c.execute as Spy).callTime > (b.execute as Spy).callTime).toBe(true);
                    expect((d.execute as Spy).callTime > (c.execute as Spy).callTime).toBe(true);
                });
            });

            it('parallel', () => {
                const dispatch = create('test', actions, dependencies());
                return dispatch().then(() => {
                    expect(within((a.execute as Spy).callTime, (b.execute as Spy).callTime, 5)).toBe(true);
                    expect(within((a.execute as Spy).callTime, (c.execute as Spy).callTime, 5)).toBe(true);
                    expect(within((a.execute as Spy).callTime, (d.execute as Spy).callTime, 5)).toBe(true);
                });
            });

            it('nested parallel', () => {
                const dispatch = create('test', actions, dependencies({
                    b: ['a'],
                    c: ['b'],
                    d: ['b']
                }));
                return dispatch().then(() => {
                    expect(within((b.execute as Spy).callTime, (a.execute as Spy).callTime, 5)).toBe(false);
                    expect(within((c.execute as Spy).callTime, (b.execute as Spy).callTime, 5)).toBe(false);
                    expect(within((d.execute as Spy).callTime, (b.execute as Spy).callTime, 5)).toBe(false);
                    expect(within((c.execute as Spy).callTime, (d.execute as Spy).callTime, 10)).toBe(true);
                });
            });

            it('nested series', () => {
                const dispatch = create('test', actions, dependencies({
                    b: ['a'],
                    c: ['a'],
                    d: ['c']
                }));
                return dispatch().then(() => {
                    expect(within((b.execute as Spy).callTime, (a.execute as Spy).callTime, 5)).toBe(false);
                    expect(within((c.execute as Spy).callTime, (a.execute as Spy).callTime, 5)).toBe(false);
                    expect(within((d.execute as Spy).callTime, (c.execute as Spy).callTime, 5)).toBe(false);
                    expect(within((c.execute as Spy).callTime, (b.execute as Spy).callTime, 10)).toBe(true);
                });
            });

        });

    });

    describe('transitions', () => {

        let actions: ModelCollection,
            a: Action,
            b: Action,
            c: Action,
            criteria: ProcessTransition[];

        beforeEach(() => {
            actions = collection();
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
            () => create('test', actions, transitions(criteria)),
            () => create('test', collection(), transitions())
        );

        it('start passes conditions through context', () => {
            (a as any).execute = spy();
            const conditions = { key: 'value' };
            return create('test', actions, transitions(criteria))('a', conditions)
                .then(() => expect((a.execute as Spy).context.conditions).toMatchObject(conditions));
        });

        describe('update', () => {

            it('merges conditions into context', () => {
                (b as any).execute = spy();
                const conditions = { key: 'value' }
                const promise = create('test', actions, transitions(criteria))();
                promise.update(conditions);
                return promise.then(() =>
                    expect((b.execute as Spy).context.conditions).toMatchObject(conditions))
            });

            it('handles empty conditions', () => {
                (b as any).execute = spy();
                const conditions = { key: 'value' }
                const promise = create('test', actions, transitions(criteria))('a', conditions);
                promise.update();
                return promise.then(() =>
                    expect((b.execute as Spy).context.conditions).toMatchObject(conditions))
            });

            it('goes to next matching action at end of action', () => {
                const promise = create('test', actions, transitions([
                    ['a', 'b'],
                    ['b', 'c', { goTo: 'c' }]
                ]))();
                setTimeout(promise.update, 20, { goTo: 'c' });
                return promise.then(() => {
                    expect((a.execute as Spy).callTime < (b.execute as Spy).callTime).toBe(true);
                    expect((b.execute as Spy).callTime < (c.execute as Spy).callTime).toBe(true);
                });
            });

            it('invokes next matching action if not in action', () => {
                const promise = create('test', actions, transitions([
                    ['a', 'b', 'goB'],
                    ['b', 'c', ['goTo', 'c']]
                ]))();
                setTimeout(promise.update, 20, { goB: true });
                setTimeout(promise.update, 40, { goTo: 'c' });
                return promise.then(() => {
                    expect(within((a.execute as Spy).callTime, (b.execute as Spy).callTime, 10)).toBe(false);
                    expect(within((b.execute as Spy).callTime, (c.execute as Spy).callTime, 10)).toBe(false);
                });
            });

            it('does nothing if no matching action and not in action', () => {
                const promise = create('test', actions, transitions([
                    ['a', 'b'],
                    ['b', 'c', ['goTo', 'c']]
                ]))();
                setTimeout(promise.update, 20, { goTo: 'd' });
                setTimeout(promise.update, 40, { goTo: 'c' });
                return promise.then(() => {
                    expect(within((b.execute as Spy).callTime, (c.execute as Spy).callTime, 25)).toBe(false);
                    expect(within((b.execute as Spy).callTime, (c.execute as Spy).callTime, 45)).toBe(true);
                });
            });

        });

        describe('stop', () => {

            it('resolves machine with results', () => {
                (c as any).execute = spy();
                b.execute = function() { this.stop() };
                return create('test', actions, transitions([
                    ['a', 'b'],
                    ['b', 'c']
                ]))().then((results) => {
                    expect(results).toMatchObject({ a: 1 });
                    expect(results.b).toBeUndefined();
                    expect(results.c).toBeUndefined();
                    expect((c.execute as Spy).called).toBe(false);
                });
            });

            it('prevents executing next action on update', () => {
                (a as any).execute = function() { this.stop() };
                (b as any).execute = spy();
                (c as any).execute = spy();
                const promise = create('test', actions, transitions([
                    ['a', 'b', 'goB'],
                    ['b', 'c', 'goC']
                ]))();
                return promise.then((results) => {
                    promise.update({ goB: true, goC: true });
                    expect((b.execute as Spy).called).toBe(false);
                    expect((c.execute as Spy).called).toBe(false);
                    expect(results.b).toBeUndefined();
                    expect(results.c).toBeUndefined();
                });
            });

        });

    });

    it('works with empty process logic', async () => {
        const start = create('name', [action('a', spy())], {});
        const promise = start();
        expect(promise).toBeInstanceOf(Promise);
        expect(promise.stop).not.toThrow();
        await promise;
    });

});
