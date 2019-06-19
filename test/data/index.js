import expect from 'expect';
import set from 'lodash/set';

import { spy } from '../utils';
import { FATAL } from '../../errors';

import { createProxy, createDataLayer } from '../../data';

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

});