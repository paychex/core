import expect from 'expect'
import { spy } from '../utils';
import createDataLayer from '../../data/DataLayer'
import createProxy from '../../data/Proxy';

describe('DataLayer', () => {

    describe('createDataLayer', () => {

        it('is a factory', () => {
            expect(typeof createDataLayer).toBe('function');
        });

        it('throws if proxy not provided', () => {
            expect(() => createDataLayer()).toThrow(/requires a proxy/);
        });

        it('throws if reauth not provided', () => {
            expect(() => createDataLayer({
                proxy: {}
            })).toThrow(/requires a reauth/);
        });

        it('throws if reconnect not provided', () => {
            expect(() => createDataLayer({
                proxy: {},
                reauth: Function.prototype
            })).toThrow(/requires a reconnect/);
        });

        it('throws if diagnostics not provided', () => {
            expect(() => createDataLayer({
                proxy: {},
                reauth: Function.prototype,
                reconnect: Function.prototype
            })).toThrow(/requires a diagnostics/);
        });

        ['fetch', 'createRequest', 'setAdapter'].forEach(method => {

            it(`exports ${method} method`, () => {
                const dataLayer = createDataLayer({
                    proxy: {},
                    reauth: Function.prototype,
                    reconnect: Function.prototype,
                    diagnostics: Function.prototype
                });
                expect(typeof dataLayer[method]).toBe('function');
            });

        });

        describe('setAdapter', () => {

            async function getError(fn, ...args) {
                try {
                    await fn(...args);
                } catch (e) {
                    return e;
                }
            }

            it('registers adapter', async () => {
                const request = { adapter: 'my-adapter' };
                const dataLayer = createDataLayer({
                    proxy: {},
                    reauth: Function.prototype,
                    reconnect: Function.prototype,
                    diagnostics: Function.prototype
                });
                let e = await getError(dataLayer.fetch, request);
                expect(/adapter not found/i.test(e.message)).toBe(true);
                dataLayer.setAdapter(request.adapter, Function.prototype);
                e = await getError(dataLayer.fetch, request);
                expect(/adapter not found/i.test(e.message)).not.toBe(true);
            });

        });

        describe('createRequest', () => {

            let proxy,
                createRequest;

            beforeEach(() => {
                proxy = {
                    url: Function.prototype,
                    apply: (arg) => arg
                };
                createRequest = createDataLayer({
                    proxy,
                    reauth: Function.prototype,
                    reconnect: Function.prototype,
                    diagnostics: Function.prototype
                }).createRequest;
            });

            it('throws if DDO not provided', () => {
                expect(() => createRequest()).toThrow();
            });

            it('returns Request format', () => {
                const request = createRequest({});
                expect(request.method).toBeDefined();
                expect(request.ignore).toBeDefined();
                expect(request.cache).toBeDefined();
                expect('body' in request).toBe(true);
            });

            it('mixes in DDO values', () => {
                const body = {};
                const get = () => {};
                const ddo = {
                    method: 'POST',
                    ignore: { traceability: true },
                    cache: { get }
                };
                const request = createRequest(ddo, null, body);
                expect(request.method).toBe('POST');
                expect(request.ignore).toMatchObject(ddo.ignore);
                expect(request.cache).toMatchObject(ddo.cache);
                expect(request.body).toBe(body);
            });

            it('invokes proxy.url', () => {
                proxy.url = () => 'url.com';
                const request = createRequest({});
                expect(request.url).toContain('url.com');
            });

            it('tokenizes url with params', () => {
                proxy.url = () => 'url.com';
                const request = createRequest({}, {
                    key: 'value',
                    arr: ['a', 'b', 'c']
                });
                expect(request.url).toContain('arr=a&arr=b&arr=c');
                expect(request.url).toContain('key=value');
            });

        });

        describe('fetch', () => {

            let proxy,
                fetch,
                request,
                response,
                dataOptions;

            beforeEach(() => {
                proxy = {
                    apply: () => {}
                };
                dataOptions = {
                    proxy,
                    reauth: spy(),
                    reconnect: spy(),
                    diagnostics: spy()
                };
                fetch = createDataLayer(dataOptions).fetch;
                response = {
                    status: 200,
                    statusText: '',
                    data: undefined,
                    meta: {
                        error: false,
                        cached: false,
                        messages: []
                    }
                };
                request = {
                    adapter: spy().returns(Promise.resolve(response))
                };
            });

            beforeEach(() => {
                Object.assign(global, {
                    window: {
                        navigator: {
                            onLine: true
                        }
                    }
                });
            });

            it('invokes cache.get if specified', async () => {
                request.cache = {
                    set: spy().returns(Promise.resolve()),
                    get: spy().returns(Promise.resolve())
                };
                await fetch(request);
                expect(request.cache.get.called).toBe(true);
            });

            it('returns cached response if exists', async () => {
                request.cache = {
                    set: spy().returns(Promise.resolve()),
                    get: async () => response
                };
                await fetch(request);
                expect(request.adapter.called).toBe(false);
            });

            it('calls adapter if cached value not found', async () => {
                request.cache = {
                    set: spy().returns(Promise.resolve()),
                    get: spy().returns(Promise.resolve())
                }
                await fetch(request);
                expect(request.adapter.called).toBe(true);
            });

            it('calls adapter if no cache specified', async () => {
                await fetch(request);
                expect(request.adapter.called).toBe(true);
            });

            it('throws if adapter key not found', async () => {
                try {
                    request.adapter = 'my-adapter';
                    await fetch(request);
                } catch (e) {
                    expect(/adapter not found/i.test(e.message)).toBe(true);
                }
            });

            [null, undefined, NaN, '', 0].forEach((value) => {

                it(`throws if adapter returns ${String(value)} response`, async () => {
                    try {
                        request.adapter.returns(Promise.resolve(value));
                        await fetch(request);
                    } catch (e) {
                        expect(/response object is expected/i.test(e.message)).toBe(true);
                    }
                });

            });

            ['status', 'statusText', 'meta', 'data'].forEach(key => {

                it(`throws if response has no ${key} key`, async () => {
                    try {
                        delete response[key];
                        await fetch(request);
                    } catch (e) {
                        expect(/missing a required field/i.test(e.message)).toBe(true);
                    }
                });

            });

            ['error', 'cached', 'messages'].forEach(key => {

                it(`throws if response.meta has no ${key} key`, async () => {
                    try {
                        delete response.meta[key];
                        await fetch(request);
                    } catch (e) {
                        expect(/meta.+missing a required field/i.test(e.message)).toBe(true);
                    }
                });

            });

            it('sets response on request', async () => {
                await fetch(request);
                expect(request.response).toBe(response);
            });

            it('returns response.data if no error', async () => {
                response.data = {};
                const result = await fetch(request);
                expect(result).toBe(response.data);
            });

            it('caches response if request.cache provided', async () => {
                request.cache = {
                    set: spy().returns(Promise.resolve()),
                    get: spy().returns(Promise.resolve())
                };
                await fetch(request);
                expect(request.cache.set.called).toBe(true);
                expect(request.cache.set.args).toEqual([request, response]);
            });

            it('retries once if auth error occurs', async () => {
                response.status = 401;
                response.meta.error = true;
                try {
                    await fetch(request);
                } catch (e) {
                    // ignore
                } finally {
                    expect(request.adapter.callCount).toBe(2);
                }
            });

            it('does not check retry logic if validation error occurs', async () => {
                request.retry = spy();
                response.status = 422;
                response.meta.error = true;
                try {
                    await fetch(request);
                } catch (e ) {
                    // ignore
                } finally {
                    expect(request.retry.called).toBe(false);
                }
            });

            it('sets response.error if validation error occurs', async () => {
                request.retry = spy();
                response.status = 422;
                response.meta.error = true;
                try {
                    await fetch(request);
                } catch (e) {
                    // ignore
                } finally {
                    expect(response.error).toBeDefined();
                    expect(response.error instanceof Error).toBe(true);
                }
            });

            it('invokes reauth if 401 error occurs', async () => {
                response.status = 401;
                response.meta.error = true;
                try {
                    await fetch(request);
                } catch (e) {
                    // ignore
                } finally {
                    expect(dataOptions.reauth.called).toBe(true);
                }
            });

            it('does not check retry logic if reauth error occurs', async () => {
                request.retry = spy();
                response.status = 401;
                response.meta.error = true;
                try {
                    await fetch(request);
                } catch (e) {
                    // ignore
                } finally {
                    expect(request.retry.called).toBe(false);
                }
            });

            it('unknown errors pass through', async () => {
                response.status = 418;
                response.meta.error = true;
                try {
                    await fetch(request);
                } catch (e) {
                    expect(response.error).toBeDefined();
                }
            });

            describe('abort response', () => {

                it('checks retry logic if timeout occurs', async () => {
                    request.retry = spy();
                    response.status = 0;
                    response.meta.error = true;
                    response.meta.timeout = true;
                    try {
                        await fetch(request);
                    } catch (e) {
                        // ignore
                    } finally {
                        expect(request.retry.called).toBe(true);
                    }
                });

                it('invokes diagnostics if connection exists', async () => {
                    request.retry = spy();
                    response.status = 0;
                    response.meta.error = true;
                    try {
                        await fetch(request);
                    } catch (e) {
                        // ignore
                    } finally {
                        expect(dataOptions.diagnostics.called).toBe(true);
                    }
                });

                it('invokes reconnect if connection does not exist', async () => {
                    request.retry = spy();
                    response.status = 0;
                    response.meta.error = true;
                    global.window.navigator.onLine = false;
                    try {
                        await fetch(request);
                    } catch (e) {
                        // ignore
                    } finally {
                        expect(dataOptions.reconnect.called).toBe(true);
                    }
                });

            });

            it('works in unit tests', () => {
                const response = {
                    status: 200,
                    statusText: 'OK',
                    data: null,
                    meta: {
                        error: false,
                        cached: false,
                        messages: [],
                    }
                };
                const proxy = createProxy();
                const testAdapter = spy().returns(response);
                const { setAdapter, createRequest, fetch } = createDataLayer({
                    proxy,
                    reauth: Function.prototype,
                    reconnect: Function.prototype,
                    diagnostics: Function.prototype
                });
                setAdapter('@paychex/test', testAdapter);
                proxy.use({ adapter: '@paychex/test' });
                return fetch(createRequest({/* ddo */})).then(() =>
                    expect(testAdapter.called).toBe(true));
            });

        });

    });

});
