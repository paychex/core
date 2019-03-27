import expect from 'expect'
import createProxy from '../../data/Proxy'

describe('Proxy', () => {

    describe('createProxy', () => {

        ['url', 'apply', 'use'].forEach(method => {

            it(`returns object with ${method} method`, () => {
                const proxy = createProxy();
                expect(typeof proxy[method]).toBe('function');
            });

        });

        describe('url', () => {

            let proxy;

            beforeEach(() => {
                proxy = createProxy();
            });

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
                    match: { key: 'value '}
                });
                expect(proxy.apply(request)).not.toMatchObject({
                    match: { key: 'value' }
                });
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

});