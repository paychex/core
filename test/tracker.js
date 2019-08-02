import expect from 'expect';
import set from 'lodash/set';
import unset from 'lodash/unset';
import { spy } from './utils';
import createTracker, { withNesting } from '../tracker';

describe('tracker', () => {

    let mark, measure;

    beforeEach(() => {
        mark = spy();
        measure = spy();
        set(global, 'window.performance', { mark, measure });
    });

    afterEach(() => unset(global, 'window'));

    describe('createTracker', () => {

        it('returns Tracker instance', () => {
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

    describe('Tracker', () => {

        let tracker, subscriber;

        beforeEach(() => {
            subscriber = spy();
            tracker = createTracker(subscriber);
        });

        describe('child', () => {

            it('delegates to root subscriber', () => {
                const child = tracker.child();
                child.event('message');
                expect(subscriber.called).toBe(true);
                expect(subscriber.args[0].type).toBe('event');
            });

            it('defaults data using ancestor contexts', () => {
                const child = tracker.child();
                const grandchild = child.child();
                tracker.context({ a: 1, b: 2, c: 3 });
                child.context({ b: 1 });
                grandchild.event('message', { c: 1 });
                const info = subscriber.args[0];
                expect(info.data).toMatchObject({ a: 1, b: 1, c: 1 });
            });

        });

        describe('context', () => {

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
                tracker.context({ a: 1, b: 1 });
                tracker.event('message', { b: 2, c: 3 });
                expect(subscriber.args[0].data).toMatchObject({ a: 1, b: 2, c: 3 });
            });

        });

        describe('error', () => {

            it('creates error info', () => {
                const err = new Error('test error');
                tracker.context({ a: 1 });
                tracker.error(Object.assign(err, { key: 'value' }));
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
                expect(err.count).toBe(3);
                expect(subscriber.args[0].count).toBe(3);
            });

            it('warns on non-Errors', () => {
                const warn = console.warn;
                console.warn = spy();
                ['non-error', null, undefined, 123].forEach(value =>
                    tracker.error(value));
                expect(subscriber.called).toBe(false);
                expect(console.warn.callCount).toBe(4);
                console.warn = warn;
            });

        });

        describe('start', () => {

            it('returns function', () => {
                expect(typeof tracker.start()).toBe('function');
            });

            it('creates timer info', async () => {
                const stop = tracker.start('label');
                await new Promise(resolve => setTimeout(resolve, 10));
                stop({ key: 'value' });
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

    describe('withNesting', () => {

        let tracker, subscriber;

        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        beforeEach(() => {
            subscriber = spy();
            tracker = withNesting(createTracker(subscriber));
        });

        it('has tracker methods', () => {
            ['child', 'context', 'event', 'error', 'start'].forEach(method =>
                expect(typeof tracker[method]).toBe('function'));
        });

        it('creates tree correctly', async () => {

            async function loadSecurity(start, clientId) {
                const [stop] = start('load user roles');
                await delay(5, clientId); // pretend data call
                stop({ role: 'admin' });
            }

            async function loadFeatures(start, product) {
                const [stop] = start(`load ${product} features`);
                await delay(5, product);
                stop({
                    features: [
                        `${product}-feat-a`,
                        `${product}-feat-b`
                    ]
                });
            }

            async function loadProducts(start, clientId) {
                const [stop, nest] = start('loading products');
                await delay(5, clientId);
                await Promise.all([
                    loadFeatures(nest, 'prod-a'),
                    loadFeatures(nest, 'prod-b')
                ]);
                stop({ products: ['prod-a', 'prod-b'] });
            }

            async function loadClientData(clientId) {
                const [stop, nest] = tracker.start('load client data');
                await loadProducts(nest, clientId);
                await loadSecurity(nest, clientId);
                stop({ clientId });
            }

            await loadClientData('client-123');

            expect(subscriber.args[0]).toMatchObject({
                "count": 1,
                "type": "timer",
                "label": "load client data",
                "id": expect.any(String),
                "start": expect.any(Number),
                "stop": expect.any(Number),
                "duration": expect.any(Number),
                "data": {
                    "children": [
                        {
                            "count": 1,
                            "label": "loading products",
                            "start": expect.any(Number),
                            "stop": expect.any(Number),
                            "duration": expect.any(Number),
                            "data": {
                                "children": [
                                    {
                                        "count": 1,
                                        "label": "load prod-a features",
                                        "start": expect.any(Number),
                                        "stop": expect.any(Number),
                                        "duration": expect.any(Number),
                                        "data": {
                                            "children": [],
                                            "features": [
                                                "prod-a-feat-a",
                                                "prod-a-feat-b"
                                            ]
                                        }
                                    },
                                    {
                                        "count": 1,
                                        "label": "load prod-b features",
                                        "start": expect.any(Number),
                                        "stop": expect.any(Number),
                                        "duration": expect.any(Number),
                                        "data": {
                                            "children": [],
                                            "features": [
                                                "prod-b-feat-a",
                                                "prod-b-feat-b"
                                            ]
                                        }
                                    }
                                ],
                                "products": [
                                    "prod-a",
                                    "prod-b"
                                ]
                            }
                        },
                        {
                            "count": 1,
                            "label": "load user roles",
                            "start": expect.any(Number),
                            "stop": expect.any(Number),
                            "duration": expect.any(Number),
                            "data": {
                                "children": [],
                                "role": "admin"
                            }
                        }
                    ],
                    "clientId": "client-123"
                }
            });

        });

        it('only completed timings are tracked', async () => {
            const [stop, start] = tracker.start('load data');
            start('child timing');
            await delay(10);
            stop();
            expect(subscriber.args[0]).toMatchObject({
                "count": 1,
                "type": "timer",
                "label": "load data",
                "id": expect.any(String),
                "start": expect.any(Number),
                "stop": expect.any(Number),
                "duration": expect.any(Number),
                "data": {
                    "children": []
                }
            });
        });

        it('creates sibling for each stop', async () => {

            async function makeParallelCalls(start) {
                const [stop] = start('parallel calls');
                await Promise.all([
                    delay(10).then(() => stop()),
                    delay(15).then(() => stop()),
                    delay(20).then(() => stop())
                ]);
            }

            const [stop, start] = tracker.start('load data');
            await makeParallelCalls(start);
            stop();

            expect(subscriber.args[0]).toMatchObject({
                "count": 1,
                "type": "timer",
                "label": "load data",
                "id": expect.any(String),
                "start": expect.any(Number),
                "stop": expect.any(Number),
                "duration": expect.any(Number),
                "data": {
                    "children": [
                        {
                            "count": 1,
                            "label": "parallel calls",
                            "start": expect.any(Number),
                            "stop": expect.any(Number),
                            "duration": expect.any(Number),
                            "data": {
                                "children": []
                            }
                        },
                        {
                            "count": 2,
                            "label": "parallel calls",
                            "start": expect.any(Number),
                            "stop": expect.any(Number),
                            "duration": expect.any(Number),
                            "data": {
                                "children": []
                            }
                        },
                        {
                            "count": 3,
                            "label": "parallel calls",
                            "start": expect.any(Number),
                            "stop": expect.any(Number),
                            "duration": expect.any(Number),
                            "data": {
                                "children": []
                            }
                        }
                    ]
                }
            });

        });

        it('tracks root twice if stopped twice', () => {
            const [stop, start] = tracker.start('root');
            const [stop_child] = start('child');
            stop_child();
            stop();
            stop();
            expect(subscriber.callCount).toBe(2);
            expect(subscriber.calls[0].args[0].count).toBe(1);
            expect(subscriber.calls[1].args[0].count).toBe(2);
        });

    });

});