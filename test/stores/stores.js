import expect from 'expect';
import { spy } from '../utils';
import {
    withEncryption,
    withPrefix,
    asDataCache,
    asObservable
} from '../../stores'
import { randomBytes } from 'crypto';

describe('stores', () => {

    describe('withEncryption', () => {

        let store, wrapper;

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
            const wrapper = withEncryption(store, {});
            const methods = Object.keys(store);
            const isMethod = method => typeof wrapper[method] === 'function';
            expect(methods.every(isMethod)).toBe(true);
        });

        it('defers to store.delete', async () => {
            const wrapper = withEncryption(store, {});
            await wrapper.delete('key');
            expect(store.delete.called).toBe(true);
            expect(store.delete.args).toEqual(['key']);
        });

    });

    describe('withPrefix', () => {

        let store,
            prefixed,
            prefixer;

        beforeEach(() => {
            store = {
                get: spy(),
                set: spy(),
                delete: spy()
            };
            prefixer = spy();
            prefixed = withPrefix(store, prefixer);
        });

        ['get', 'set', 'delete'].forEach(method => {

            it('invokes prefixer with key', () => {
                prefixer.returns('prefix:key')
                prefixed[method]('key');
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

    describe('asDataCache', () => {

        let store;

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
            return asDataCache(store).set({}, { status: 200 })
                .then(() => expect(store.set.called).toBe(true));
        });

    });

});