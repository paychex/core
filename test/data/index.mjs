import expect from 'expect';

import { spy } from '../utils.mjs';
import { FATAL } from '../../errors/index.mjs';

import { createProxy, createDataLayer } from '../../data/index.mjs';

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

            it('returns default url if no rules set', () => {
                const url = proxy.url('base', 'path1', 'path2');
                expect(url).toBe('/path1/path2');
            });

            it('returns default url if no rules match', () => {
                proxy.use({
                    match: {
                        base: 'does-not-match'
                    }
                });
                const url = proxy.url('base', 'path1', 'path2');
                expect(url).toBe('/path1/path2');
            });

            it('strips trailing slash if no paths provided', () => {
                proxy.use({
                    origin: 'http://test.com',
                    match: {
                        base: 'base'
                    }
                });
                const url = proxy.url('base');
                expect(url).toBe('http://test.com');
            });

            it('returns modified url if one rule matches', () => {
                proxy.use({
                    protocol: 'ftp',
                    host: 'files.myserver.com',
                    port: 21,
                    match: {
                        base: 'test'
                    }
                });
                expect(proxy.url('test')).toBe('ftp://files.myserver.com:21');
            });

            it('returns modified url if rule has no conditions', () => {
                proxy.use({
                    protocol: 'ftp',
                    host: 'files.myserver.com',
                    port: 21
                });
                expect(proxy.url('test')).toBe('ftp://files.myserver.com:21');
            });

            it('adds 3rd slash for file protocol', () => {
                proxy.use({
                    protocol: 'file',
                    host: 'C:\\Users\\Documents'
                });
                expect(proxy.url('test')).toBe('file:///C:\\Users\\Documents');
            });

            it('returns correct url if multiple rules match', () => {
                const ftp = {
                    protocol: 'ftp',
                    host: 'files.myserver.com',
                    port: 21,
                    match: {
                        base: 'test'
                    }
                };
                const http = {
                    protocol: 'http',
                    host: 'cache.myserver.com',
                    match: {
                        base: 'test'
                    }
                };
                proxy.use(ftp, http);
                expect(proxy.url('test', 'file')).toBe('http://cache.myserver.com:21/file');
            });

            it('ignores non-matching rules', () => {
                const ftp = {
                    protocol: 'ftp',
                    host: 'files.myserver.com',
                    port: 21,
                    match: {
                        base: 'test'
                    }
                };
                const http = {
                    protocol: 'http',
                    host: 'cache.myserver.com',
                    match: {
                        base: 'does-not-match'
                    }
                };
                proxy.use(ftp, http);
                expect(proxy.url('test', 'file')).toBe('ftp://files.myserver.com:21/file');
            });

            it('returns relative url if no base or protocol', () => {
                expect(proxy.url('', 'some/path')).toBe('/some/path');
            });

            it('passes through request properties', () => {
                expect(proxy.url({
                    port: 9000,
                    path: 'path',
                    protocol: 'https',
                    host: 'www.test.com',
                })).toBe('https://www.test.com:9000/path');
            });

            it('parses origin if provided', () => {
                expect(proxy.url({
                    path: 'path',
                    origin: 'https://www.test.com:9000',
                })).toBe('https://www.test.com:9000/path');
            });

            it('throws error if origin invalid', () => {
                expect(() => proxy.url({
                    port: 9000,
                    path: 'path',
                    protocol: 'https',
                    host: 'www.test.com',
                    origin: 'invalid',
                })).toThrow('invalid origin in proxy rules');
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

        let proxy, adapter, invalid, dataLayer;

        beforeEach(() => proxy = {
            url: spy().returns(''),
            apply: spy().returns({}),
        });

        beforeEach(() => adapter = spy());

        beforeEach(() => dataLayer =
            createDataLayer(proxy, adapter, adapters));

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

            function catchHandler(done) {
                return (e) => {
                    expect(e.severity).toBe(FATAL);
                    expect(e.message).toBe(invalid);
                    done();
                };
            }

            it('rejects if no request provided', (done) => {
                dataLayer.fetch().catch(catchHandler(done));
            });

            it('rejects if invalid request provided', (done) => {
                dataLayer.fetch({ method: 123, url: '' }).catch(catchHandler(done));
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
                const request = {
                    method: 'GET',
                    adapter: 'default',
                    url: 'www.test.com'
                };
                adapter.returns(response);
                const result = await dataLayer.fetch(request);
                expect(result).toBe(response);
            });

            it('rejects if response.meta.error is true', (done) => {
                const response = {
                    status: 404,
                    statusText: 'Not Found',
                    meta: { error: true }
                };
                const request = {
                    method: 'GET',
                    adapter: 'default',
                    url: 'www.test.com'
                };
                adapter.returns(response);
                dataLayer.fetch(request).catch(e => {
                    expect(e.response.status).toBe(404);
                    expect(e.message).toBe('Not Found');
                    done();
                });
            });

            it('uses status lookup if no statusText provided', (done) => {
                const response = {
                    status: 402,
                    statusText: '',
                    meta: { error: true }
                };
                const request = {
                    method: 'GET',
                    adapter: 'default',
                    url: 'www.test.com'
                };
                adapter.returns(response);
                dataLayer.fetch(request).catch(e => {
                    expect(e.message).toBe('Payment Required');
                    done();
                });
            });

            it('uses default message if unknown status provided', (done) => {
                const response = {
                    status: 88,
                    statusText: '',
                    meta: { error: true }
                };
                const request = {
                    method: 'GET',
                    adapter: 'default',
                    url: 'www.test.com'
                };
                adapter.returns(response);
                dataLayer.fetch(request).catch(e => {
                    expect(e.message).toBe('Unknown HTTP Error');
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
                    body: null,
                    method: 'GET',
                    adapter: 'default',
                    withCredentials: false,
                    headers: { accept: 'application/json, text/plain, */*' }
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
                expect(proxy.url.args[0]).toMatchObject(expect.objectContaining(definition));
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
                const temp = spy();
                dataLayer.setAdapter('name', temp);
                expect(adapters.get('name')).toBe(temp);
            });

            it('overwrites adapter if exists', () => {
                const original = spy();
                const overwrite = spy();
                dataLayer.setAdapter('name', original);
                dataLayer.setAdapter('name', overwrite);
                expect(adapters.get('name')).toBe(overwrite);
            });

        });

    });

});