import * as expect from 'expect';
import { randomBytes } from 'crypto';
import { spy } from '../index';
import {
    withEncryption,
    withPrefix,
    withExpiration,
    asDataCache,
    weeks,
} from '../../stores/utils';
import { Store } from '../../stores';

describe('stores', () => {

    describe('weeks', () => {

        it('returns factory object', () => {
            expect(weeks(1)).toBeInstanceOf(Function);
        });

        it('factory returns Date', () => {
            const factory = weeks(1);
            expect(factory()).toBeInstanceOf(Date);
        });

        it('factory returns correct value', () => {
            const factory = weeks(1);
            const date = factory();
            const today = new Date();
            const nextWeek = new Date(Date.now() + 100 + (7 * 24 * 60 * 60 * 1000));
            expect(date > today).toBe(true);
            expect(date < nextWeek).toBe(true);
        });

    });

    describe('withExpiration', () => {

        let store: any,
            wrapper: Store;

        beforeEach(() => {
            store = {
                get: spy(),
                set: spy(),
                delete: spy()
            };
            wrapper = withExpiration(store, weeks(1));
        });

        describe('get', () => {

            it('returns undefined for invalid types', async () => {
                store.get.returns('invalid entry format');
                expect(await wrapper.get('key')).toBeUndefined();
            });

            it('returns undefined for expired values', async () => {
                const past = new Date(Date.now() - 1000);
                store.get.returns({ value: 'abc', expires: past });
                expect(await wrapper.get('key')).toBeUndefined();
            });

            it('returns value if not expired', async () => {
                const future = new Date(Date.now() + 1000);
                store.get.returns({ value: 'abc', expires: future });
                expect(await wrapper.get('key')).toBe('abc');
            });

        });

        it('set calls delegate with entry', async () => {
            await wrapper.set('key', 'value');
            expect(store.set.calls[0].args[1]).toMatchObject({
                value: 'value',
                expires: expect.any(Date)
            });
        });

    });

    describe('withEncryption', () => {

        let store: any,
            wrapper: Store;

        beforeEach(() => {
            store = {
                get: spy(),
                set: spy(),
                delete: spy()
            };
            wrapper = withEncryption(store, {
                key: randomBytes(8).toString('hex'),
                iv: randomBytes(16).toString('hex'),
            });
        });

        it('encrypts and decrypts', async () => {
            const original = 'value';
            await wrapper.set('key', original);
            const hashed = store.set.args[1];
            store.get.returns(Promise.resolve(hashed));
            const cleartext = await wrapper.get('key');
            expect(cleartext).toBe(original);
            expect(hashed).not.toBe(cleartext);
        });

        it('salts using private key', async () => {
            const value = 'value';
            await Promise.all([
                wrapper.set('key1', value),
                wrapper.set('key2', value)
            ]);
            const enc1 = store.set.calls[0].args[1];
            const enc2 = store.set.calls[1].args[1];
            expect(enc1).not.toBe(enc2);
        });

        it('allows arbitrary key and iv length', async () => {
            wrapper = withEncryption(store, {
                key: randomBytes(0).toString('hex'),
                iv: randomBytes(8).toString('hex'),
            });
            const cleartext = 'original value';
            await wrapper.set('key', cleartext);
            const encrypted = store.set.args[1];
            store.get.returns(Promise.resolve(encrypted));
            const decrypted = await wrapper.get('key');
            expect(decrypted).toBe(cleartext);
            expect(encrypted).not.toBe(cleartext);
        });

        it('returns store interface', () => {
            wrapper = withEncryption(store, { key: '', iv: '' });
            const methods = Object.keys(store);
            methods.forEach((method: keyof Store) =>
                expect(wrapper[method]).toBeInstanceOf(Function));
        });

        it('defers to store.delete', async () => {
            wrapper = withEncryption(store, { key: '', iv: '' });
            await wrapper.delete('key');
            expect(store.delete.called).toBe(true);
            expect(store.delete.args).toEqual(['key']);
        });

    });

    describe('withPrefix', () => {

        let store: any,
            prefixed: Store,
            prefixer: any;

        beforeEach(() => {
            store = {
                get: spy(),
                set: spy(),
                delete: spy()
            };
            prefixer = spy();
            prefixed = withPrefix(store, prefixer);
        });

        ['get', 'set', 'delete'].forEach((method: 'get'|'set'|'delete') => {

            describe(method, () => {

                it('invokes prefixer with key', () => {
                    prefixer.returns('prefix:key')
                    prefixed[method]('key', null);
                    expect(prefixer.called).toBe(true);
                    expect(prefixer.args[0]).toEqual('key');
                    expect(store[method].args[0]).toEqual('prefix:key');
                });

                it('works with string', () => {
                    prefixed = withPrefix(store, 'prefix');
                    prefixed.get('key');
                    expect(store.get.args[0]).toBe('prefix:key');
                });

                it('ignores empty string', () => {
                    prefixed = withPrefix(store, '');
                    prefixed.get('key');
                    expect(store.get.args[0]).toBe('key');
                });

            });

        });

    });

    describe('asDataCache', () => {

        let store: any;

        beforeEach(() => {
            store = {
                get: spy(),
                set: spy()
            };
        });

        it('uses request url as key', async () => {
            const request = {
                method: 'GET',
                url: 'http://url.com/path'
            };
            return asDataCache(store).get(request)
                .then(() => {
                    expect(store.get.called).toBe(true);
                    expect(store.get.args[0]).toBe(request.url);
                });
        });

        it('retrieves cached values', async () => {
            const cached = {};
            store.get.returns(cached);
            return asDataCache(store).get({
                method: 'GET',
                url: 'http://url.com/path'
            }).then(response => expect(response).toMatchObject(cached));
        });

        it('stores responses in cache', async () => {
            return asDataCache(store).set({}, { status: 200, data: null, statusText: '', meta: {} })
                .then(() => expect(store.set.called).toBe(true));
        });

    });

});