import expect from 'expect'
import createProxy from '../../data/Proxy'

describe('Proxy', () => {

    describe('createProxy', () => {

        ['url', 'version', 'use', 'auth', 'key'].forEach(method => {

            it(`returns object with ${method} method`, () => {
                const proxy = createProxy();
                expect(typeof proxy[method]).toBe('function');
            });

        });

        it('default auth throws implementation error', async () => {
            const proxy = createProxy();
            try {
                await proxy.auth();
            } catch (e) {
                expect(/not implemented/.test(e.message)).toBe(true);
            }
        });

        it('default key throws implementation error', async () => {
            const proxy = createProxy();
            try {
                await proxy.key();
            } catch (e) {
                expect(/not implemented/.test(e.message)).toBe(true);
            }
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

        describe('version', () => {

            let proxy,
                request;

            beforeEach(() => {
                request = {};
                proxy = createProxy();
            });

            it('returns undefined if no rules exist', async () => {
                await proxy.version(request);
                expect(request.version).toBeUndefined();
            });

            it('returns undefined if no rules match', async () => {
                proxy.use({
                    version: 'v1',
                    match: {
                        key: 'value'
                    }
                });
                expect(await proxy.version(request)).toBeUndefined();
            });

            it('returns version from matching rule', async () => {
                proxy.use({
                    version: 'v1',
                    match: {
                        key: 'value'
                    }
                });
                request.key = 'value';
                expect(await proxy.version(request)).toBe('v1');
            });

            it('returns version if no match restrictions', async () => {
                proxy.use({
                    version: 'v1'
                });
                request.key = 'value';
                expect(await proxy.version(request)).toBe('v1');
            });

            it('uses regular expressions', async () => {
                proxy.use({
                    version: 'v1',
                    match: {
                        key: '[0-9]+'
                    }
                });
                request.key = '123';
                expect(await proxy.version(request)).toBe('v1');
            });

            it('returns version from last matching rule', async () => {
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
                expect(await proxy.version(request)).toBe('v2');
            });

            it('returns last specified version from multiple matching rules', async () => {
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
                expect(await proxy.version(request)).toBe('v1');
            });

            it('ignores non-matching rules', async () => {
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
                expect(await proxy.version(request)).toBe('v1');
            });

        });

    });

});