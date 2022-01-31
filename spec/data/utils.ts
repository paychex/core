import * as expect from 'expect';
import { set, unset } from 'lodash';

import { spy } from '../index';
import { manualReset, autoReset } from '../../signals/index';

import {
    falloff,
    tokenize,
    withRetry,
    withCache,
    withTransform,
    withConnectivity,
    withDiagnostics,
    withAuthentication,
    withHeaders,
    withXSRF,
    withSignal,
} from '../../data/utils';
import { Fetch } from '../../data';
import { ManualResetSignal } from '../../signals';
import { Spy } from '../index';

describe('data', () => {

    describe('utils', () => {

        describe('falloff', () => {

            it('resolves after period when below failure count', async () => {
                const request = {};
                const delays = [200, 400, 800, 1600, 3200];
                const scheduler: any = spy().invokes((fn:Function) => fn());
                const retry = falloff.call(null, 5, 200, { scheduler });
                async function verify(ms: number, i: number) {
                    await retry(request);
                    expect(scheduler.calls[i].args[1]).toBe(ms);
                }
                await Promise.all(delays.map(verify));
            });

            it('rejects after period when reaches failure count', async () => {
                const request = {};
                const scheduler: any = spy().invokes((fn: Function) => fn());
                const retry = falloff.call(null, 2, 200, { scheduler });
                await retry(request);
                await retry(request);
                try {
                    await retry(request);
                    (expect as any).fail('retry should fail');
                } catch (e) {
                    expect(scheduler.callCount).toBe(2);
                    expect(e).toBeUndefined();
                }
            });

            it('counts different requests separately', async () => {
                const request1 = {};
                const request2 = {};
                const scheduler: any = spy().invokes((fn: Function) => fn());
                const retry = falloff.call(null, 2, 200, { scheduler });
                await retry(request1);
                await retry(request2);
                await retry(request1);
                await retry(request2);
                expect(scheduler.callCount).toBe(4);
            });

            it('uses default arguments when necessary', async () => {
                const original = setTimeout;
                const timeout = globalThis.setTimeout = spy() as any;
                const retry = falloff();
                retry({}, {} as any);
                expect(timeout.called).toBe(true);
                expect(timeout.args).toEqual([expect.any(Function), 200]);
                timeout.args[0]();
                globalThis.setTimeout = original.bind(global);
            });

        });

        describe('withRetry', () => {

            let wrapper: Fetch,
                fetch: any,
                retry: any,
                retries: Map<any, any>;

            beforeEach(() => {
                fetch = spy();
                retry = spy();
                retries = new Map();
                wrapper = withRetry(fetch, retry, retries);
            });

            it('creates default map if not provided', () => {
                expect(() => withRetry(fetch, retry)).not.toThrow();
            });

            it('throws if retry is not a function', () => {
                expect(() => withRetry.call(null, fetch)).toThrow('Argument `retry` must be a function.');
            });

            it('returns successful response', async () => {
                const response = {};
                fetch.returns(response);
                const result = await wrapper({});
                expect(result).toBe(response);
                expect(result.meta.retryCount).toBe(0);
            });

            it('increments meta.retryCount', (done) => {
                const request = {};
                fetch.throws(new Error());
                wrapper(request).then(response => {
                    expect(response.meta.retryCount).toBe(1);
                    expect(retries.has(request)).toBe(false);
                    done();
                });
                fetch.returns({});
            });

            it('invokes retry method with correct args', (done) => {
                const request = {};
                const response = {};
                fetch.throws(Object.assign(new Error(), { response }));
                wrapper(request).then(() => {
                    expect(retry.called).toBe(true);
                    expect(retry.args).toEqual([request, response]);
                    done();
                });
                fetch.returns(response);
            });

            it('fetches again if retry resolves', (done) => {
                const request = {};
                const response = {};
                fetch.throws(Object.assign(new Error(), { response }));
                wrapper(request).then(() => {
                    expect(fetch.callCount).toBe(2);
                    done();
                });
                fetch.returns(response);
            });

            it('rejects with original error if retry rejects', (done) => {
                const request = {};
                const response = {};
                retry.onCall(2).throws(new Error('ignored'));
                fetch.throws(Object.assign(new Error('not found'), { response }));
                wrapper(request).catch((e) => {
                    expect(e.message).toBe('not found');
                    expect(e.response.meta.retryCount).toBe(3);
                    expect(retries.has(request)).toBe(false);
                    done();
                });
            });

        });

        describe('withCache', () => {

            let cache: any,
                fetch: any,
                wrapper: Fetch;

            beforeEach(() => {
                fetch = spy();
                cache = {
                    get: spy(),
                    set: spy()
                };
                wrapper = withCache(fetch, cache);
            });

            it('throws if no cache provided', () => {
                expect(() => withCache.call(null, fetch))
                    .toThrow('An invalid cache was provided to withCache.');
            });

            it('throws if invalid cache provided', () => {
                expect(() => withCache.call(null, fetch, { get: 'get', set: 123 }))
                    .toThrow('An invalid cache was provided to withCache.');
            });

            it('returns cached response if exists', async () => {
                const request = {};
                const response = {};
                cache.get.returns(Promise.resolve(response));
                const result = await wrapper(request);
                expect(fetch.called).toBe(false);
                expect(result.meta.cached).toBe(true);
                expect(result).toBe(response);
            });

            it('calls fetch if cached value not found', async () => {
                await wrapper({});
                expect(fetch.called).toBe(true);
            });

            it('caches successful response', async () => {
                const request = {};
                const response = {};
                fetch.returns(Promise.resolve(response));
                await wrapper(request);
                expect(cache.set.called).toBe(true);
                expect(cache.set.args).toEqual([request, response]);
            });

        });

        describe('withTransform', () => {

            let fetch: any,
                transformer: any,
                wrapper: Fetch;

            beforeEach(() => {
                fetch = spy();
                transformer = {
                    request: spy(),
                    response: spy()
                };
                wrapper = withTransform(fetch, transformer);
            });

            it('does nothing if transformer not provided', async () => {
                const request = {};
                const response = {};
                wrapper = withTransform.call(null, fetch);
                fetch.returns(response);
                const result = await wrapper(request);
                expect(result).toMatchObject(response);
            });

            it('does nothing if request not provided', async () => {
                const request = {};
                const response = {};
                fetch.returns(response);
                delete transformer.request;
                const result = await wrapper(request);
                expect(result).toMatchObject(response);
            });

            it('does nothing if response not provided', async () => {
                const request = {};
                const response = {};
                fetch.returns(response);
                delete transformer.response;
                const result = await wrapper(request);
                expect(result).toMatchObject(response);
            });

            it('does not modify original request and response', async () => {
                const request = { headers: { a: '123' } };
                const response = {};
                fetch.returns(response);
                const result = await wrapper(request);
                const clone = fetch.args[0];
                expect(clone).not.toBe(request);
                expect(clone.headers).not.toBe(request.headers);
                expect(result).not.toBe(response);
            });

            it('is idempotent', async () => {
                const response = { data: 'original' };
                const request = { body: 'abc', headers: { a: '123' } };
                transformer.request.returns('def');
                transformer.response.returns('modified');
                fetch.returns(response);
                await wrapper(request);
                await wrapper(request);
                expect(request.body).toBe('abc');
                expect(request.headers.a).toBe('123');
                expect(response.data).toBe('original');
            });

            it('invokes request transform with request body and headers', async () => {
                const response = {};
                const request = { body: {}, headers: {} };
                transformer.request.returns(null);
                fetch.returns(response);
                await wrapper(request);
                expect(transformer.request.called).toBe(true);
                expect(transformer.request.args).toEqual([request.body, request.headers]);
            });

            it('replaces request.body with request transform', async () => {
                const request = {};
                const response = {};
                transformer.request.returns(null);
                fetch.returns(response);
                await wrapper(request);
                expect(fetch.args[0].body).toBe(null);
            });

            it('invokes response transform with response data', async () => {
                const request = {};
                const response = { data: {} };
                transformer.response.returns(null);
                fetch.returns(response);
                await wrapper(request);
                expect(transformer.response.called).toBe(true);
                expect(transformer.response.args[0]).toMatchObject(response.data);
            });

            it('replaces response.data with response transform', async () => {
                const request = {};
                const response = { data: {} };
                transformer.response.returns(null);
                fetch.returns(response);
                const result = await wrapper(request);
                expect(result.data).toBe(null);
            });

        });

        describe('withConnectivity', () => {

            let wrapper: Fetch,
                fetch: any,
                reconnect: any;

            beforeEach(() => {
                fetch = spy();
                reconnect = spy();
                wrapper = withConnectivity(fetch, reconnect);
                set(globalThis, 'navigator.onLine', true);
            });

            afterEach(() => unset(globalThis, 'navigator'));

            it('throws if reconnect not provided', () => {
                expect(() => withConnectivity.call(null, fetch))
                    .toThrow('Argument `reconnect` must be a function.');
            });

            it('throws if reconnect is invalid', () => {
                expect(() => withConnectivity.call(null, fetch, 123))
                    .toThrow('Argument `reconnect` must be a function.');
            });

            it('does not invoke reconnect if online', async () => {
                await wrapper({});
                expect(reconnect.called).toBe(false);
            });

            it('waits for reconnect if offline', () => {
                const response = {};
                set(globalThis, 'navigator.onLine', false);
                fetch.returns(response);
                reconnect.returns(new Promise(resolve => setTimeout(resolve, 10)));
                return wrapper({}).then(result => {
                    expect(result).toBe(response);
                    expect(reconnect.called).toBe(true);
                });
            });

        });

        describe('withDiagnostics', () => {

            let wrapper: Fetch,
                fetch: any,
                diagnostics: any;

            beforeEach(() => {
                fetch = spy();
                diagnostics = spy();
                wrapper = withDiagnostics(fetch, diagnostics);
            });

            it('throws if diagnostics not provided', () => {
                expect(() => withDiagnostics.call(null, fetch))
                    .toThrow('Argument `diagnostics` must be a function.');
            });

            it('throws if diagnostics is invalid', () => {
                expect(() => withDiagnostics.call(null, fetch, 123))
                    .toThrow('Argument `diagnostics` must be a function.');
            });

            it('does not invoke diagnostics if good status', () => {
                fetch.returns({ status: 200 });
                return wrapper({}).then(() =>
                    expect(diagnostics.called).toBe(false));
            });

            it('does not invoke diagnostics if non-0 status', () => {
                fetch.throws({ status: 404 });
                return wrapper({}).catch(() =>
                    expect(diagnostics.called).toBe(false));
            });

            it('rethrows orginal error', (done) => {
                const err = new Error();
                fetch.throws(err);
                wrapper({}).catch((e) => {
                    expect(e).toBe(err);
                    done();
                });
            });

            it('waits for diagnostics if status is 0', (done) => {
                fetch.throws({ status: 0 });
                wrapper({}).catch(() => {
                    expect(diagnostics.called).toBe(true);
                    done();
                });
            });

            it('waits for diagnostics if status is missing', (done) => {
                fetch.throws({});
                wrapper({}).catch(() => {
                    expect(diagnostics.called).toBe(true);
                    done();
                });
            });

        });

        describe('withAuthentication', () => {

            let wrapper: Fetch,
                fetch: any,
                reauthenticate: any;

            beforeEach(() => {
                fetch = spy();
                reauthenticate = spy();
                wrapper = withAuthentication(fetch, reauthenticate);
            });

            it('throws if reauthenticate not provided', () => {
                expect(() => withAuthentication.call(null, fetch))
                    .toThrow('Argument `reauthenticate` must be a function.');
            });

            it('throws if reauthenticate is invalid', () => {
                expect(() => withAuthentication.call(null, fetch, 123))
                    .toThrow('Argument `reauthenticate` must be a function.');
            });

            it('does not invoke reauthenticate if good status', () => {
                fetch.returns({ status: 200 });
                return wrapper({}).then(() =>
                    expect(reauthenticate.called).toBe(false));
            });

            it('does not reauthenticate if status is missing', () => {
                fetch.returns({});
                return wrapper({}).then(() =>
                    expect(reauthenticate.called).toBe(false));
            });

            it('does not reauthenticate if status is not 401', () => {
                fetch.throws({ status: 404 });
                return wrapper({}).catch(() =>
                    expect(reauthenticate.called).toBe(false));
            });

            it('waits for reauthenticate if status is 401', (done) => {
                fetch.throws({ status: 401 });
                wrapper({}).catch(() => {
                    expect(reauthenticate.called).toBe(true);
                    expect(reauthenticate.callCount).toBe(2);
                    done();
                });
                Promise.resolve().then(() =>
                    reauthenticate.throws(new Error()));
            });

            it('throws original error if reauthentication fails', (done) => {
                const e = { status: 401 };
                fetch.throws(e);
                reauthenticate.throws(new Error());
                wrapper({}).catch((err) => {
                    expect(err).toBe(e);
                    done();
                });
            });

        });

        describe('withHeaders', () => {

            let wrapper: Fetch,
                fetch: any;

            beforeEach(() => {
                fetch = spy();
                wrapper = withHeaders(fetch);
            });

            it('uses existing headers', () => {
                const request = { headers: { abc: '123' } };
                return wrapper(request).then(() =>
                    expect(fetch.args[0].headers).toMatchObject(request.headers));
            });

            it('request headers override default headers', () => {
                const request = { headers: { abc: '123' } };
                const defaults = { abc: '456', def: '789' };
                wrapper = withHeaders(fetch, defaults);
                return wrapper(request).then(() =>
                    expect(fetch.args[0].headers).toMatchObject({
                        abc: '123',
                        def: '789'
                    }));
            });

            it('does not modify original request headers', () => {
                const request = { headers: { abc: '123' } };
                return wrapper(request).then(() => {
                    const headers = fetch.args[0].headers;
                    expect(headers).not.toBe(request.headers);
                    expect(headers).toMatchObject(request.headers);
                });
            });

        });

        describe('withXSRF', () => {

            let wrapper: Fetch,
                fetch: any,
                a1: any,
                a2: any,
                document: any;

            beforeEach(() => {
                fetch = spy();
                a1 = {
                    port: 80,
                    hostname: 'test',
                    protocol: 'http',
                    setAttribute: spy()
                };
                a2 = {
                    port: 8080,
                    hostname: 'test',
                    protocol: 'http',
                    setAttribute: spy()
                };
                document = {
                    cookie: {},
                    createElement: spy().returns(a1)
                };
                document.createElement.onCall(1).returns(a2);
                set(globalThis, 'location.href', '');
                set(globalThis, 'document', document);
            });

            beforeEach(() => {
                wrapper = withXSRF(fetch);
            });

            afterEach(() => {
                unset(globalThis, 'location');
                unset(globalThis, 'document');
            });

            it('does nothing if cookie not set', async () => {
                const request = {};
                await wrapper(request);
                expect(fetch.args[0]).toBe(request);
            });

            it('does nothing if different origin', async () => {
                const request = {};
                set(document.cookie, 'XSRF-TOKEN', 'token');
                await wrapper(request);
                expect(fetch.args[0]).toBe(request);
            });

            it('sets header for different origin if whitelisted', async () => {
                document.createElement.reset();
                document.createElement.onCall(0).returns(a1);
                document.createElement.onCall(1).returns(a2);
                set(a1, 'hostname', 'domain.com');
                set(a2, 'port', a1.port);
                set(a2, 'hostname', 'sub.test.domain.com');
                wrapper = withXSRF(fetch, {
                    hosts: ['*.domain.com']
                });
                set(document.cookie, 'XSRF-TOKEN', 'token');
                await wrapper(Object.create(null));
                expect(fetch.args[0]).toMatchObject({
                    headers: { 'x-xsrf-token': 'token' }
                });
            });

            it('sets correct xsrf header value', async () => {
                set(a2, 'port', a1.port);
                set(document.cookie, 'XSRF-TOKEN', 'token');
                await wrapper(Object.create(null));
                expect(fetch.args[0]).toMatchObject({
                    headers: { 'x-xsrf-token': 'token' }
                });
            });

            it('uses alternative values', async () => {
                document.createElement.reset();
                document.createElement.onCall(0).returns(a1);
                document.createElement.onCall(1).returns(a2);
                wrapper = withXSRF(fetch, {
                    cookie: 'custom.cookie',
                    header: 'another-header'
                });
                set(a2, 'port', a1.port);
                set(document, ['cookie', 'custom.cookie'], 'token');
                await wrapper(Object.create(null));
                expect(fetch.args[0]).toMatchObject({
                    headers: { 'another-header': 'token' }
                });
            });

            it('does not modify original request', async () => {
                const request = {};
                set(a2, 'port', a1.port);
                set(document.cookie, 'XSRF-TOKEN', 'token');
                await wrapper(request);
                expect(fetch.args[0]).not.toBe(request);
            });

        });

        describe('withSignal', () => {

            let wrapper: Fetch,
                fetch: any,
                signal: ManualResetSignal;

            beforeEach(() => {
                fetch = spy();
                signal = manualReset(false);
                wrapper = withSignal(fetch, signal);
            });

            it('delays fetch until signaled', (done) => {
                wrapper({});
                setTimeout(() => {
                    expect(fetch.called).toBe(false);
                    signal.set();
                    setTimeout(() => {
                        expect(fetch.called).toBe(true);
                        done();
                    });
                });
            });

            it('sets signal when fetch completes', async () => {
                signal.set();
                signal.set = spy();
                await wrapper({});
                expect((signal.set as Spy).called).toBe(true);
            });

            it('use case: authentication', (done) => {
                wrapper({});
                wrapper({});
                wrapper({});
                setTimeout(() => {
                    expect(fetch.called).toBe(false);
                    signal.set();
                    setTimeout(() => {
                        expect(fetch.called).toBe(true);
                        expect(fetch.callCount).toBe(3);
                        done();
                    });
                });
            });

            it('use case: sequencing', async () => {
                signal = autoReset(true);
                wrapper = withSignal(fetch, signal);
                fetch.returns(new Promise(resolve => setTimeout(resolve, 10)));
                await wrapper({});
                await wrapper({});
                await wrapper({});
                expect(fetch.callCount).toBe(3);
                expect(fetch.calls[1].callTime - fetch.calls[0].callTime > 5);
                expect(fetch.calls[2].callTime - fetch.calls[1].callTime > 5);
            });

        });

        describe('tokenize', () => {

            const none = 'http://www.url.com';
            const qs = 'http://www.url.com?key=value';
            const tokens = 'http://www.:token1.com/:token2';

            const params = {
                token1: 'value1',
                token2: 'value2'
            };

            it('does nothing if no params given', () => {
                expect(tokenize()).toBe('');
            });

            it('does nothing if url has no tokens and no params given', () => {
                expect(tokenize(none)).toBe(none);
            });

            it('returns original url if tokens present but no params given', () => {
                expect(tokenize(tokens)).toBe(tokens);
            });

            it('replaces tokens with params', () => {
                expect(tokenize(tokens, params)).toBe('http://www.value1.com/value2');
            });

            it('handles partial path tokens', () => {
                expect(tokenize('/path/:token1-dir/:token2.ext', params)).toBe('/path/value1-dir/value2.ext');
            });

            it('appends params to querystring when no tokens', () => {
                expect(tokenize(none, params)).toBe('http://www.url.com?token1=value1&token2=value2');
            });

            it('appends params to existing querystring', () => {
                expect(tokenize(qs, params)).toBe('http://www.url.com?key=value&token1=value1&token2=value2');
            });

            it('maintains existing querystring when no params', () => {
                expect(tokenize(qs)).toBe('http://www.url.com?key=value');
            });

            it('uses correct array syntax', () => {
                expect(tokenize(none, {
                    arr: ['value1', 'value2']
                })).toBe('http://www.url.com?arr=value1&arr=value2');
            });

            it('appends untokenized params to querystring', () => {
                expect(tokenize(tokens, {
                    token1: 'value1',
                    token2: 'value2',
                    token3: 'value3'
                })).toBe('http://www.value1.com/value2?token3=value3');
            });

            it('does not modify original params object', () => {
                const copy = { ...params };
                tokenize(tokens, params);
                expect(params).toMatchObject(copy);
            });

        });

    });

});