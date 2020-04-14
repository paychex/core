import expect from 'expect';
import { spy } from './utils.js';
import { eventBus } from '../index.js';

describe('eventBus', () => {

    let bus;

    beforeEach(() => bus = eventBus());

    it('has expected methods', () => {
        expect(bus).toBeDefined();
        ['on', 'one', 'fire', 'pause', 'resume'].forEach(method => {
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

        it('fires "error" on error', () => {
            const error = spy();
            const handler = spy();
            bus.on('oops', () => { throw new Error('test') });
            bus.on('oops', handler);
            bus.on('error', error);
            bus.fire('oops', 'a', 'b');
            expect(handler.called).toBe(true);
            expect(error.args[0]).toMatchObject({
                event: 'oops',
                message: 'test',
                args: ['a', 'b']
            });
        });

    });

    describe('pause', () => {

        it('does not notify listeners', () => {
            const handler = spy();
            bus.on('event', handler);
            bus.pause();
            bus.fire('event');
            expect(handler.called).toBe(false);
        });

    });

    describe('resume', () => {

        it('does not queue events', () => {
            const handler = spy();
            bus.on('event', handler);
            bus.pause();
            bus.fire('event');
            bus.resume();
            expect(handler.called).toBe(false);
        });

        it('notifies listeners', () => {
            const handler = spy();
            bus.on('event', handler);
            bus.pause();
            bus.resume();
            bus.fire('event');
            expect(handler.called).toBe(true);
        });

    });

});
