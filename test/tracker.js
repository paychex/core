import expect from 'expect';
import createTracker from '../tracker';
import { spy } from './utils';

describe('tracker', () => {

    describe('createTracker', () => {

        it('returns tracker instance', () => {
            const tracker = createTracker();
            ['child', 'context', 'event', 'error', 'start'].forEach(method =>
                expect(typeof tracker[method]).toBe('function'));
        });

        it('uses specified subscriber', () => {
            const subscriber = spy();
            createTracker(subscriber).event('message');
            expect(subscriber.called).toBe(true);
        });

    });

    describe('child', () => {

        let tracker, subscriber;

        beforeEach(() => {
            subscriber = spy();
            tracker = createTracker(subscriber);
        });

        it('delegates to root subscriber', () => {
            const child = tracker.child();
            child.event('message');
            expect(subscriber.called).toBe(true);
            expect(subscriber.args[0].type).toBe('event');
        });

        it('defaults data using ancestor contexts', () => {
            const child = tracker.child();
            const grandchild = child.child();
            tracker.context({a: 1, b: 2, c: 3});
            child.context({b: 1});
            grandchild.event('message', {c: 1});
            const info = subscriber.args[0];
            expect(info.data).toMatchObject({a: 1, b: 1, c: 1});
        });

    });

    describe('context', () => {

        let tracker, subscriber;

        beforeEach(() => {
            subscriber = spy();
            tracker = createTracker(subscriber);
        });

        it('overwrites existing values', () => {
            tracker.context({ a: 1 });
            tracker.context({ a: 2 });
            tracker.event('message');
            expect(subscriber.args[0].data).toMatchObject({ a: 2 });
        });

        it('merges array values', () => {
            tracker.context({ a: [1] });
            tracker.context({ a: [2] });
            tracker.event('message');
            expect(subscriber.args[0].data).toMatchObject({ a: [1, 2] });
        });

    });

    describe('event', () => {

        let tracker, subscriber;

        beforeEach(() => {
            subscriber = spy();
            tracker = createTracker(subscriber);
        });

        it('creates event info', () => {
            tracker.event('message');
            const info = subscriber.args[0];
            expect(info).toMatchObject({
                type: 'event',
                label: 'message'
            });
            expect(typeof info.stop).toBe('number');
            expect(typeof info.start).toBe('number');
            expect(info.duration).toBe(0);
        });

        it('includes context and data', () => {
            tracker.context({a: 1, b: 1});
            tracker.event('message', {b: 2, c: 3});
            expect(subscriber.args[0].data).toMatchObject({ a: 1, b: 2, c: 3 });
        });

    });

    describe('error', () => {

        let tracker, subscriber;

        beforeEach(() => {
            subscriber = spy();
            tracker = createTracker(subscriber);
        });

        it('creates error info', () => {
            const err = new Error('test error');
            tracker.context({a: 1});
            tracker.error(Object.assign(err, {key: 'value'}));
            expect(subscriber.args[0]).toMatchObject({
                type: 'error',
                label: 'test error',
                duration: 0,
                count: 1,
                data: {
                    a: 1,
                    key: 'value'
                }
            });
        });

        it('increments count', () => {
            const err = new Error('test error');
            tracker.error(err);
            tracker.error(err);
            tracker.error(err);
            expect(subscriber.callCount).toBe(3);
            expect(subscriber.args[0].count).toBe(3);
        });

    });

    describe('start', () => {

        let tracker, subscriber;

        beforeEach(() => {
            subscriber = spy();
            tracker = createTracker(subscriber);
        });

        it('returns function', () => {
            expect(typeof tracker.start()).toBe('function');
        });

        it('creates timer info', async () => {
            const stop = tracker.start('label');
            await new Promise(setTimeout);
            stop({key: 'value'});
            const info = subscriber.args[0];
            expect(info).toMatchObject({
                type: 'timer',
                label: 'label',
                count: 1,
                data: {
                    key: 'value'
                }
            });
            expect(info.duration).toBeGreaterThan(0);
        });

        it('increments count', () => {
            const stop = tracker.start('label');
            stop();
            stop();
            expect(subscriber.args[0].count).toBe(2);
        });

        it('includes context and data', () => {
            tracker.context({ a: 1, b: 1 });
            tracker.start('timer')({ b: 2, c: 3 });
            expect(subscriber.args[0].data).toMatchObject({ a: 1, b: 2, c: 3 });
        });

    });

});