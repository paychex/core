import expect from 'expect';
import { spy } from './utils.mjs';

import * as events from '../events/index.mjs';

describe('events', () => {

    const delay = (ms, value) =>
        () => new Promise(resolve =>
            setTimeout(resolve, ms, value));

    describe('bus', () => {

        let bus;

        beforeEach(() => bus = events.bus());

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

            it('resolves if no subscribers', (done) => {
                const promise = bus.fire('does not exist');
                expect(promise).toBeInstanceOf(Promise);
                promise.then(() => done());
            });

            it('invokes "on" subscriber with specified context', () => {
                const handler = spy();
                const context = Object.create(null);
                bus = events.bus(context);
                bus.on('test', handler);
                bus.fire('test');
                expect(handler.context).toBe(context);
            });

            it('invokes "one" subscriber with specified context', () => {
                const handler = spy();
                const context = Object.create(null);
                bus = events.bus(context);
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

});