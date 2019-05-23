import expect from 'expect';
import set from 'lodash/set';
import unset from 'lodash/unset';

import { spy } from './utils';
import { FATAL } from '../errors';

import { createProxy, createDataLayer } from '../data';
import {
    falloff,
    tokenize,
    withRetry,
    withCache,
    withTransform,
    withConnectivity,
    withDiagnostics,
    withAuthentication,
    withHeaders
} from '../data/utils';

describe('data', () => {

    describe('createProxy', () => {

        ['url', 'apply', 'use'].forEach(method => {

            it(`returns object with ${method} method`, () => {
                const proxy = createProxy();
                expect(typeof proxy[method]).toBe('function');
            });

        });

        describe('url', () => {

            let proxy;
            beforeEach(() => proxy = createProxy());

            it('returns default url if no rules set', async () => {
                const url = proxy.url('base', 'path1', 'path2');
                expect(url).toBe('//base/path1/path2');
            });

            it('returns default url if no rules match', async () => {
                proxy.use({
                    match: {
                        base: 'does-not-match'
                    }
                });
                const url = proxy.url('base', 'path1', 'path2');
                expect(url).toBe('//base/path1/path2');
            });

            it('strips trailing slash if no paths provided', async () => {
                const url = proxy.url('base');
                expect(url).toBe('//base');
            });

            it('returns modified url if one rule matches', async () => {
                proxy.use({
                    protocol: 'ftp',
                    host: 'files.paychex.com',
                    port: 21,
                    match: {
                        base: 'test'
                    }
                });
                expect(proxy.url('test')).toBe('ftp://files.paychex.com:21');
            });

            it('returns modified url if rule has no conditions', async () => {
                proxy.use({
                    protocol: 'ftp',
                    host: 'files.paychex.com',
                    port: 21
                });
                expect(proxy.url('test')).toBe('ftp://files.paychex.com:21');
            });

            it('adds 3rd slash for file protocol', async () => {
                proxy.use({
                    protocol: 'file',
                    host: 'C:\\Users\\Documents'
                });
                expect(proxy.url('test')).toBe('file:///C:\\Users\\Documents');
            });

            it('returns correct url if multiple rules match', async () => {
                proxy.use({
                    protocol: 'ftp',
                    host: 'files.paychex.com',
                    port: 21,
                    match: {
                        base: 'test'
                    }
                }, {
                        protocol: 'http',
                        host: 'cache.paychex.com',
                        match: {
                            base: 'test'
                        }
                    });
                expect(proxy.url('test', 'file')).toBe('http://cache.paychex.com:21/file');
            });

            it('ignores non-matching rules', async () => {
                proxy.use({
                    protocol: 'ftp',
                    host: 'files.paychex.com',
                    port: 21,
                    match: {
                        base: 'test'
                    }
                }, {
                        protocol: 'http',
                        host: 'cache.paychex.com',
                        match: {
                            base: 'does-not-match'
                        }
                    });
                expect(proxy.url('test', 'file')).toBe('ftp://files.paychex.com:21/file');
            });

        });

        describe('apply', () => {

            let proxy,
                request;

            beforeEach(() => {
                request = {};
                proxy = createProxy();
            });

            it('returns unmodified request if no rules exist', () => {
                const result = proxy.apply(request);
                expect(result).toMatchObject(request);
            });

            it('returns unmodified request if no rules match', () => {
                proxy.use({
                    version: 'v1',
                    match: { key: 'value' }
                });
                expect(proxy.apply(request)).toMatchObject(request);
            });

            it('does not apply match to request', () => {
                proxy.use({
                    version: 'v1',
                    match: { key: 'value ' }
                });
                expect(proxy.apply(request)).not.toMatchObject({
                    match: { key: 'value' }
                });
            });

            it('returns original request if no rules apply', () => {
                const actual = { a: 123, b: 'abc' };
                const expected = { a: 123, b: 'abc' };
                expect(proxy.apply(actual)).toMatchObject(expected);
            });

            it('applies version from matching rule', () => {
                proxy.use({
                    version: 'v1',
                    match: {
                        key: 'value'
                    }
                });
                request.key = 'value';
                expect(proxy.apply(request)).toMatchObject({
                    version: 'v1'
                });
            });

            it('applies version if no match restrictions', () => {
                proxy.use({
                    version: 'v1'
                });
                request.key = 'value';
                expect(proxy.apply(request)).toMatchObject({
                    version: 'v1'
                });
            });

            it('uses regular expressions', () => {
                proxy.use({
                    version: 'v1',
                    match: {
                        key: '[0-9]+'
                    }
                });
                request.key = '123';
                expect(proxy.apply(request)).toMatchObject({
                    version: 'v1'
                });
            });

            it('uses version from last matching rule', () => {
                proxy.use({
                    version: 'v1',
                    match: {
                        key: '123'
                    }
                }, {
                        version: 'v2',
                        match: {
                            key: '[0-9]+'
                        }
                    });
                request.key = '123';
                expect(proxy.apply(request)).toMatchObject({
                    version: 'v2'
                });
            });

            it('uses last specified version from multiple matching rules', () => {
                proxy.use({
                    version: 'v1',
                    match: {
                        key: '123'
                    }
                }, {
                        match: {
                            key: '[0-9]+'
                        }
                    });
                request.key = '123';
                expect(proxy.apply(request)).toMatchObject({
                    version: 'v1'
                });
            });

            it('ignores non-matching rules', () => {
                proxy.use({
                    version: 'v1',
                    match: {
                        key: '123'
                    }
                }, {
                        match: {
                            key: '[a-z]+'
                        }
                    });
                request.key = '123';
                expect(proxy.apply(request)).toMatchObject({
                    version: 'v1'
                });
            });

            it('merges nested objects', () => {
                proxy.use(
                    { headers: { a: '1' } },
                    { headers: { b: '2' } }
                );
                expect(proxy.apply({})).toMatchObject({
                    headers: { a: '1', b: '2' }
                });
            });

            it('unions array elements', () => {
                proxy.use(
                    { headers: ['1'] },
                    { headers: ['2'] }
                );
                expect(proxy.apply({})).toMatchObject({
                    headers: ['1', '2']
                });
            });

        });

    });

    describe('createDataLayer', () => {

        const adapters = new Map();

        let proxy, invalid, dataLayer;

        beforeEach(() => proxy = {
            url: spy().returns(''),
            apply: spy().returns({}),
        });

        beforeEach(() => dataLayer =
            createDataLayer(proxy, adapters));

        it('has expected methods', () =>
            ['fetch', 'createRequest', 'setAdapter'].forEach(method =>
                expect(typeof dataLayer[method]).toBe('function')));

        it('throws if proxy not specified', () => {
            expect(() => createDataLayer()).toThrow(invalid);
        });

        it('throws if proxy is invalid', () => {
            expect(() => createDataLayer({
                url: 123,
                apply: 'string'
            })).toThrow(invalid);
        });

        describe('fetch', () => {

            beforeEach(() => invalid = 'Invalid request passed to fetch.');

            it('rejects if no request provided', (done) => {
                dataLayer.fetch().catch(e => {
                    expect(e.severity).toBe(FATAL);
                    expect(e.message).toBe(invalid);
                    done();
                });
            });

            it('rejects if invalid request provided', (done) => {
                dataLayer.fetch({ method: 123, url: '' }).catch(e => {
                    expect(e.severity).toBe(FATAL);
                    expect(e.message).toBe(invalid);
                    done();
                });
            });

            it('rejects if adapter not found', (done) => {
                dataLayer.fetch({
                    method: 'GET',
                    adapter: 'dne',
                    url: 'www.test.com',
                }).catch(e => {
                    expect(e.severity).toBe(FATAL);
                    expect(e.adapter).toBe('dne');
                    expect(e.message).toBe('Adapter not found.');
                    done();
                });
            });

            it('returns successful response', async () => {
                const response = { status: 200 };
                const adapter = spy().returns(response);
                const request = {
                    method: 'GET',
                    adapter: 'test',
                    url: 'www.test.com'
                };
                adapters.set('test', adapter);
                const result = await dataLayer.fetch(request);
                expect(result).toBe(response);
            });

            it('rejects if response.meta.error is true', (done) => {
                const response = {
                    status: 404,
                    statusText: 'Not Found',
                    meta: { error: true }
                };
                const adapter = spy().returns(response);
                const request = {
                    method: 'GET',
                    adapter: 'test',
                    url: 'www.test.com'
                };
                adapters.set('test', adapter);
                dataLayer.fetch(request).catch(e => {
                    expect(e.response.status).toBe(404);
                    expect(e.message).toBe('Not Found');
                    done();
                });
            });

        });

        describe('createRequest', () => {

            let definition;
            beforeEach(() => definition =
                { base: 'base', path: 'path' });

            beforeEach(() => invalid =
                'A valid DataDefinition object must be passed to createRequest.');

            it('throws if no definition provided', () => {
                expect(() => dataLayer.createRequest()).toThrow(invalid);
            });

            it('throws if invalid definition provided', () => {
                expect(() => dataLayer.createRequest({
                    base: '',
                    path: 123,
                })).toThrow(invalid);
            });

            it('sets defaults', () => {
                dataLayer.createRequest(definition);
                const object = proxy.apply.args[0];
                expect(object).toMatchObject({
                    method: 'GET',
                    adapter: 'xhr',
                    withCredentials: false,
                    headers: { accept: 'application/json' }
                });
            });

            it('does not modify existing definition', () => {
                const body = { token: 'abc', arr: [123, 456] };
                const request = dataLayer.createRequest(definition, null, body);
                expect(request.body).not.toBeUndefined();
                expect(definition.body).toBeUndefined();
            });

            it('proxies url', () => {
                proxy.apply.returns(definition);
                dataLayer.createRequest(definition);
                expect(proxy.url.called).toBe(true);
                expect(proxy.url.args).toEqual(['base', 'path']);
            });

            it('tokenizes url params', () => {
                proxy.url.returns('/:token/path');
                const params = { token: 'abc', arr: [123, 456 ]};
                const request = dataLayer.createRequest(definition, params);
                expect(request.url).toBe('/abc/path?arr=123&arr=456');
            });

            it('sets body', () => {
                const body = {};
                const request = dataLayer.createRequest(definition, {}, body);
                expect(request.body).toBe(body);
            });

            it('uses existing body if provided', () => {
                definition.body = Object.create(null);
                const request = dataLayer.createRequest(definition);
                expect(request.body).toBe(definition.body);
            });

            it('returns frozen object', () => {
                const request = dataLayer.createRequest(definition);
                expect(() => {
                    request.body = 'abc';
                }).toThrow();
            });

        });

        describe('setAdapter', () => {

            beforeEach(() => invalid =
                'A proxy must be passed to createDataLayer.');

            it('creates map if not provided', () => {
                expect(() => createDataLayer(proxy)).not.toThrow();
            });

            it('adds specified adapter', () => {
                const adapter = spy();
                dataLayer.setAdapter('name', adapter);
                expect(adapters.get('name')).toBe(adapter);
            });

            it('overwrites adapter if exists', () => {
                const original = spy();
                const overwrite = spy();
                dataLayer.setAdapter('name', original);
                dataLayer.setAdapter('name', overwrite);
                expect(adapters.get('name')).toBe(overwrite);
            });

        });

        describe('xhr adapter', () => {

            let adapter, xhr, http, request, headers;

            beforeEach(() => {
                adapter = adapters.get('xhr');
                request = { method: 'GET', url: 'test.com' };
                headers = 'content-type: application/json\r\ncontent-length: 412';
                http = {
                    open: spy(),
                    send: spy(),
                    addEventListener: spy(),
                    setRequestHeader: spy(),
                    getAllResponseHeaders: spy().returns(headers),
                };
                set(global, 'XMLHttpRequest', xhr = spy().returns(http));
            });

            it('is added automatically', () =>
                expect(adapter).toBeDefined());

            it('constructs XMLHttpRequest', () => {
                request.timeout = 100;
                request.withCredentials = true;
                adapter(request);
                expect(xhr.called).toBe(true);
                expect(http.timeout).toBe(100);
                expect(http.withCredentials).toBe(true);
                expect(http.open.called).toBe(true);
                expect(http.open.args).toEqual(['GET', 'test.com']);
                expect(http.send.called).toBe(true);
                expect(http.send.args).toEqual([undefined]);
                expect(http.addEventListener.callCount).toBe(4);
            });

            it('sets request headers', () => {
                request.headers = { key: 'value' };
                adapter(request);
                expect(http.setRequestHeader.called).toBe(true);
                expect(http.setRequestHeader.args).toEqual(['key', 'value']);
            });

            it('ignores non-string headers', () => {
                request.headers = {
                    key: 123,
                    abc: undefined,
                    def: 'value',
                };
                adapter(request);
                expect(http.setRequestHeader.called).toBe(true);
                expect(http.setRequestHeader.callCount).toBe(1);
            });

            it('handles null response headers', (done) => {
                http.getAllResponseHeaders.returns(null);
                adapter(request).then(response => {
                    expect(response.meta.headers).toEqual({});
                    done();
                });
                http.addEventListener.calls[0].args[1](); // load
            });

            it('success returns correct response', (done) => {
                http.status = 204;
                http.statusText = 'No Content';
                http.response = { key: 'value' };
                adapter(request).then(response => {
                    expect(response.status).toBe(204);
                    expect(response.statusText).toBe('No Content');
                    expect(response.data).toMatchObject(http.response);
                    expect(response.meta).toMatchObject({
                        messages: [],
                        error: false,
                        cached: false,
                        timeout: false,
                    });
                    expect(response.meta.headers).toMatchObject({
                        'content-type': 'application/json',
                        'content-length': '412'
                    });
                    done();
                });
                http.addEventListener.calls[0].args[1](); // load
            });

            it('parses JSON string', (done) => {
                http.status = 200;
                http.response = '{"key":"value"}';
                request.headers = { 'content-type': 'application/json' };
                adapter(request).then(response => {
                    expect(response.status).toBe(200);
                    expect(response.data).toMatchObject({ key: 'value' });
                    done();
                });
                http.addEventListener.calls[0].args[1](); // load
            });

            it('ignores non-string JSON', (done) => {
                http.status = 200;
                http.response = { key: 'value' };
                request.headers = { 'content-type': 'application/json' };
                adapter(request).then(response => {
                    expect(response.status).toBe(200);
                    expect(response.data).toMatchObject({ key: 'value' });
                    done();
                });
                http.addEventListener.calls[0].args[1](); // load
            });

            it('ignores invalid JSON', (done) => {
                http.status = 200;
                http.response = '{ "invalid" }';
                request.headers = { 'content-type': 'application/json' };
                adapter(request).then(response => {
                    expect(response.status).toBe(200);
                    expect(response.data).toBe(http.response);
                    done();
                });
                http.addEventListener.calls[0].args[1](); // load
            });

            it('error returns correct response', (done) => {
                http.status = 404;
                http.statusText = 'Not Found';
                http.response = null;
                adapter(request).then(response => {
                    expect(response.status).toBe(404);
                    expect(response.statusText).toBe('Not Found');
                    expect(response.data).toBe(null);
                    expect(response.meta).toMatchObject({
                        messages: [],
                        error: true,
                        cached: false,
                        timeout: false,
                    });
                    done();
                });
                http.addEventListener.calls[2].args[1](); // error
            });

            it('abort returns correct response', (done) => {
                adapter(request).then(response => {
                    expect(response.status).toBe(0);
                    expect(response.statusText).toBe('Aborted');
                    expect(response.data).toBe(null);
                    expect(response.meta).toMatchObject({
                        messages: [],
                        error: true,
                        cached: false,
                        timeout: false,
                    });
                    done();
                });
                http.addEventListener.calls[1].args[1](); // abort
            });

            it('timeout returns correct response', (done) => {
                adapter(request).then(response => {
                    expect(response.status).toBe(0);
                    expect(response.statusText).toBe('Timeout');
                    expect(response.data).toBe(null);
                    expect(response.meta).toMatchObject({
                        messages: [],
                        error: true,
                        cached: false,
                        timeout: true,
                    });
                    done();
                });
                http.addEventListener.calls[3].args[1](); // timeout
            });

        });

    });

    describe('utils', () => {

        describe('falloff', () => {

            it('resolves after period when below failure count', async () => {
                const request = {};
                const delays = [200, 400, 800, 1600, 3200];
                const timeout = (fn, delay) => {
                    expect(delay).toBe(delays.shift());
                    fn();
                }
                const retry = falloff(5, 200, { scheduler: timeout });
                await retry(request);
                await retry(request);
                await retry(request);
                await retry(request);
                await retry(request);
            });

            it('rejects after period when reaches failure count', async () => {
                const request = {};
                const timeout = fn => fn();
                const retry = falloff(2, 200, { scheduler: timeout });
                await retry(request);
                await retry(request);
                try {
                    await retry(request);
                } catch (e) {
                    expect(e).toBeUndefined();
                }
            });

            it('counts different requests separately', async () => {
                const request1 = {};
                const request2 = {};
                const timeout = fn => fn();
                const retry = falloff(2, 200, { scheduler: timeout });
                await retry(request1);
                await retry(request2);
                await retry(request1);
                await retry(request2);
            });

            it('uses default arguments when necessary', async () => {
                const original = setTimeout;
                const timeout = global.setTimeout = spy();
                const retry = falloff();
                retry({});
                expect(timeout.called).toBe(true);
                expect(timeout.args[1]).toBe(200);
                timeout.args[0]();
                global.setTimeout = original.bind(global);
            });

        });

        describe('withRetry', () => {

            let wrapper, fetch, retry, retries;

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
                expect(() => withRetry(fetch)).toThrow('Argument `retry` must be a function.');
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
                retry.throws(new Error('ignored'));
                fetch.throws(Object.assign(new Error('not found'), { response }));
                wrapper(request).catch((e) => {
                    expect(e.message).toBe('not found');
                    expect(e.response.meta.retryCount).toBe(1);
                    expect(retries.has(request)).toBe(false);
                    done();
                });
            });

        });

        describe('withCache', () => {

            let cache, fetch, wrapper;

            beforeEach(() => {
                fetch = spy();
                cache = {
                    get: spy(),
                    set: spy()
                };
                wrapper = withCache(fetch, cache);
            });

            it('throws if no cache provided', () => {
                expect(() => withCache(fetch))
                    .toThrow('An invalid cache was provided to withCache.');
            });

            it('throws if invalid cache provided', () => {
                expect(() => withCache(fetch, { get: 'get', set: 123 }))
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

            let fetch, transformer, wrapper;

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
                wrapper = withTransform(fetch);
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
                const request = { headers: { a: 123 }};
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
                const request = { body: 'abc', headers: { a: 123 } };
                transformer.request.returns('def');
                transformer.response.returns('modified');
                fetch.returns(response);
                await wrapper(request);
                await wrapper(request);
                expect(request.body).toBe('abc');
                expect(request.headers.a).toBe(123);
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

            let wrapper, fetch, reconnect;

            beforeEach(() => {
                fetch = spy();
                reconnect = spy();
                wrapper = withConnectivity(fetch, reconnect);
                set(global, 'window.navigator.onLine', true);
            });

            afterEach(() => unset(global, 'window'));

            it('throws if reconnect not provided', () => {
                expect(() => withConnectivity(fetch))
                    .toThrow('Argument `reconnect` must be a function.');
            });

            it('throws if reconnect is invalid', () => {
                expect(() => withConnectivity(fetch, 123))
                    .toThrow('Argument `reconnect` must be a function.');
            });

            it('does not invoke reconnect if online', async () => {
                await wrapper({});
                expect(reconnect.called).toBe(false);
            });

            it('waits for reconnect if offline', () => {
                const response = {};
                set(global, 'window.navigator.onLine', false);
                fetch.returns(response);
                reconnect.returns(new Promise(resolve => setTimeout(resolve, 10)));
                return wrapper({}).then(result => {
                    expect(result).toBe(response);
                    expect(reconnect.called).toBe(true);
                });
            });

        });

        describe('withDiagnostics', () => {

            let wrapper, fetch, diagnostics;

            beforeEach(() => {
                fetch = spy();
                diagnostics = spy();
                wrapper = withDiagnostics(fetch, diagnostics);
            });

            it('throws if diagnostics not provided', () => {
                expect(() => withDiagnostics(fetch))
                    .toThrow('Argument `diagnostics` must be a function.');
            });

            it('throws if diagnostics is invalid', () => {
                expect(() => withDiagnostics(fetch, 123))
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

            let wrapper, fetch, reauthenticate;

            beforeEach(() => {
                fetch = spy();
                reauthenticate = spy();
                wrapper = withAuthentication(fetch, reauthenticate);
            });

            it('throws if reauthenticate not provided', () => {
                expect(() => withAuthentication(fetch))
                    .toThrow('Argument `reauthenticate` must be a function.');
            });

            it('throws if reauthenticate is invalid', () => {
                expect(() => withAuthentication(fetch, 123))
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

            let wrapper, fetch;

            beforeEach(() => {
                fetch = spy();
                wrapper = withHeaders(fetch);
            });

            it('uses existing headers', () => {
                const request = { headers: { abc: 123 } };
                return wrapper(request).then(() =>
                    expect(fetch.args[0].headers).toMatchObject(request.headers));
            });

            it('merges in provided headers', () => {
                const request = { headers: { abc: 123 } };
                const incoming = { abc: 456, def: 789 };
                wrapper = withHeaders(fetch, incoming);
                return wrapper(request).then(() =>
                    expect(fetch.args[0].headers).toMatchObject(incoming));
            });

            it('does not modify original request headers', () => {
                const request = { headers: { abc: 123 } };
                return wrapper(request).then(() => {
                    const headers = fetch.args[0].headers;
                    expect(headers).not.toBe(request.headers);
                    expect(headers).toMatchObject(request.headers);
                });
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