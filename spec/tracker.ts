import * as expect from 'expect';
import { set, unset } from 'lodash';
import { spy } from './index';
import { create } from '../trackers/index';
import { withNesting, withReplacement } from '../trackers/utils';
import { NestedStart, NestedTimingTracker, Tracker, TrackingSubscriber } from '../trackers/index';
import { Spy } from './index';

describe('trackers', () => {

    describe('create', () => {

        describe('createTracker', () => {

            it('returns Tracker instance', () => {
                const tracker = create();
                ['child', 'context', 'event', 'error', 'start'].forEach(
                    (method: keyof Tracker) =>
                        expect(tracker[method]).toBeInstanceOf(Function));
            });

            it('uses specified subscriber', () => {
                const subscriber: any = spy();
                create(subscriber).event('message');
                expect(subscriber.called).toBe(true);
            });

        });

        describe('Tracker', () => {

            let tracker: Tracker,
                subscriber: Spy;

            beforeEach(() => {
                subscriber = spy();
                tracker = create(subscriber as any);
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

                it('does not use references', () => {
                    const ref = Object.create(null);
                    tracker.context(ref);
                    ref.a = 1;
                    ref.b = 2;
                    tracker.event('message');
                    expect(subscriber.args[0].data).toEqual({});
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
                            key: 'value',
                            name: expect.any(String),
                            stack: expect.any(String)
                        }
                    });
                });

                it('increments count', () => {
                    const err = new Error('test error');
                    tracker.error(err);
                    tracker.error(err);
                    tracker.error(err);
                    expect(subscriber.callCount).toBe(3);
                    expect((err as any).count).toBe(3);
                    expect(subscriber.args[0].count).toBe(3);
                });

                it('warns on non-Errors', () => {
                    const warn = console.warn;
                    console.warn = spy();
                    ['non-error', null, undefined, 123].forEach(value =>
                        tracker.error.call(tracker, value));
                    expect(subscriber.called).toBe(false);
                    expect((console.warn as Spy).callCount).toBe(4);
                    console.warn = warn;
                });

            });

            describe('start', () => {

                it('returns function', () => {
                    expect(tracker.start.call(tracker)).toBeInstanceOf(Function);
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

            describe('browser compatibility', () => {

                it('times correctly using Date.now', () => {
                    const now = Date.now();
                    const performance = globalThis.performance;
                    unset(globalThis, 'performance');
                    tracker.event.call(tracker);
                    expect(subscriber.args[0].start).not.toBeLessThan(now);
                    set(globalThis, 'performance', performance);
                });

                it('times correctly using Date#getTime', () => {
                    const orig = Date.now;
                    const performance = globalThis.performance;
                    const now = new Date().getTime();
                    unset(Date, 'now');
                    unset(globalThis, 'performance');
                    tracker.event.call(tracker);
                    expect(subscriber.args[0].start).not.toBeLessThan(now);
                    set(Date, 'now', orig);
                    set(globalThis, 'performance', performance);
                });

            });

        });

    });

    describe('utils', () => {

        describe('withNesting', () => {

            let tracker: NestedTimingTracker,
                subscriber: Spy;

            function delay(ms: number) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            beforeEach(() => {
                subscriber = spy();
                tracker = withNesting(create(subscriber as any));
            });

            it('has tracker methods', () => {
                ['child', 'context', 'event', 'error', 'start'].forEach(
                    (method: keyof NestedTimingTracker) =>
                        expect(tracker[method]).toBeInstanceOf(Function));
            });

            it('creates tree correctly', async () => {

                async function loadSecurity(start: NestedStart) {
                    const [stop] = start('load user roles');
                    await delay(5); // pretend data call
                    stop({ role: 'admin' });
                }

                async function loadFeatures(start: NestedStart, product: string) {
                    const [stop] = start(`load ${product} features`);
                    await delay(5);
                    stop({
                        features: [
                            `${product}-feat-a`,
                            `${product}-feat-b`
                        ]
                    });
                }

                async function loadProducts(start: NestedStart) {
                    const [stop, nest] = start('loading products');
                    await delay(5);
                    await Promise.all([
                        loadFeatures(nest, 'prod-a'),
                        loadFeatures(nest, 'prod-b')
                    ]);
                    stop({ products: ['prod-a', 'prod-b'] });
                }

                async function loadClientData(clientId: string) {
                    const [stop, nest] = tracker.start('load client data');
                    await loadProducts(nest);
                    await loadSecurity(nest);
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

                async function makeParallelCalls(start: NestedStart) {
                    const [end] = start('parallel calls');
                    await Promise.all([
                        delay(10).then(() => end()),
                        delay(15).then(() => end()),
                        delay(20).then(() => end())
                    ]);
                }

                const [stop, nest] = tracker.start('load data');
                await makeParallelCalls(nest);
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

        describe('utils', () => {

            describe('withReplacement', () => {

                let map: Map<RegExp, string>,
                    collector: Spy,
                    replace: TrackingSubscriber;

                beforeEach(() => {
                    map = new Map([
                        [/\ben\b/, 'English'],
                        [/^lang$/, 'Language'],
                    ]);
                    collector = spy();
                    replace = withReplacement(collector as any, map);
                });

                it('returns function', () => {
                    expect(replace).toBeInstanceOf(Function);
                });

                it('delegates to wrapped function', () => {
                    replace({} as any);
                    expect(collector.called).toBe(true);
                });

                it('clones original object', () => {
                    const object = { lang: 'en' };
                    replace(object as any);
                    expect(object.lang).toBe('en');
                });

                it('ignores top-level keys', () => {
                    replace({ lang: 'en' } as any);
                    const info = collector.args[0];
                    expect('lang' in info).toBe(true);
                    expect(info.lang).toBe('English');
                });

                it('replaces top-level values', () => {
                    replace({ label: 'lang' } as any);
                    expect(collector.args[0].label).toBe('Language');
                });

                it('replaces data keys', () => {
                    replace({ data: { lang: 'en' }} as any);
                    const info = collector.args[0];
                    expect(info).toMatchObject({
                        data: { Language: 'English' }
                    });
                });

                it('replaces data values', () => {
                    replace({ data: { lang: 'en' } } as any);
                    const info = collector.args[0];
                    expect(info).toMatchObject({
                        data: { Language: 'English' }
                    });
                });

                it('does not replace values if specified', () => {
                    replace = withReplacement(collector as any, map, true);
                    replace({ data: { lang: 'en' }, key: 'en' } as any);
                    const info = collector.args[0];
                    expect(info).toMatchObject({
                        key: 'en',
                        data: { Language: 'en' },
                    });
                });

                it('does not replace substrings', () => {
                    replace({
                        lang: 'eng',
                        data: { lang: 'len' }
                    } as any);
                    const info = collector.args[0];
                    expect(info).toMatchObject({
                        lang: 'eng',
                        data: { Language: 'len' }
                    });
                });

                it('skips non-strings', () => {
                    replace({
                        id: 123,
                        data: { val: 123, lang: null }
                    } as any);
                    const info = collector.args[0];
                    expect(info).toMatchObject({
                        id: 123,
                        data: { val: 123, Language: null }
                    });
                });

                it('skips keys missing from dictionary', () => {
                    const object = {
                        id: 'abc',
                        data: {
                            key: 'value'
                        }
                    };
                    replace(object as any);
                    expect(collector.args[0]).toMatchObject(object);
                });

                it('works with arrays', () => {
                    replace({ lang: ['es', 'en'] } as any);
                    expect(collector.args[0]).toMatchObject({
                        lang: ['es', 'English']
                    });
                });

                it('works with nested objects', () => {
                    replace({
                        lang: ['es', 'en'],
                        data: {
                            lang: {
                                avail: ['en', 'es'],
                                selected: 'en',
                            }
                        }
                    } as any);
                    expect(collector.args[0]).toMatchObject({
                        lang: ['es', 'English'],
                        data: {
                            Language: {
                                avail: ['English', 'es'],
                                selected: 'English'
                            }
                        }
                    });
                });

                it('respects position tokens', () => {
                    replace({
                        label: 'lang',
                        action: 'change lang',
                    } as any);
                    expect(collector.args[0]).toMatchObject({
                        label: 'Language',
                        action: 'change lang',
                    });
                });

            });

        });

    });

});