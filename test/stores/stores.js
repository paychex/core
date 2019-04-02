import expect from 'expect';
import { spy } from '../utils';
import {
    withEncryption,
    withPrefix,
    asResponseCache,
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

    describe('asResponseCache', () => {

        let store;

        beforeEach(() => {
            store = {
                get: spy(),
                set: spy()
            };
        });

        it('ignores non-GET requests', async () => {
            return asResponseCache(store).get({method: 'POST'})
                .then(() => expect(store.get.called).toBe(false));
        });

        it('uses request url as key', async () => {
            const request = {
                method: 'GET',
                url: 'http://url.com/path'
            };
            return asResponseCache(store).get(request)
                .then(() => {
                    expect(store.get.called).toBe(true);
                    expect(store.get.args[0]).toBe(request.url);
                });
        });

        it('sets meta.cached to true if value was cached', async () => {
            const cached = { meta: { cached: true } };
            store.get.returns({ meta: {} });
            return asResponseCache(store).get({
                method: 'GET',
                url: 'http://url.com/path'
            }).then(response => expect(response).toMatchObject(cached));
        });

        it('does not set meta.cached if value not cached', async () => {
            return asResponseCache(store).get({
                method: 'GET',
                url: 'http://url.com/path'
            }).then(response => expect(response).toBeUndefined());
        });

        it('ignores non-200 responses', async () => {
            return asResponseCache(store).set({}, { status: 401 })
                .then(() => expect(store.set.called).toBe(false));
        });

        it('stores 200 responses in cache', async () => {
            return asResponseCache(store).set({}, { status: 200 })
                .then(() => expect(store.set.called).toBe(true));
        });

    });

    describe('asObservable', () => {

        let store, wrapped;

        beforeEach(() => {
            store = {
                get: spy().returns(Promise.resolve()),
                set: spy().returns(Promise.resolve()),
                delete: spy().returns(Promise.resolve())
            };
            wrapped = asObservable(store);
        });

        it('adds observe method', () => {
            expect('observe' in store).toBe(false);
            expect(typeof wrapped.observe).toBe('function');
        });

        describe('set', () => {

            it('passes result through', async () => {
                store.set.returns(Promise.resolve('abc'));
                const result = await wrapped.set('key', 'value');
                expect(store.set.args).toEqual(['key', 'value']);
                expect(result).toBe('abc');
            });

            it('emits "set" event', (done) => {
                wrapped.observe('key').subscribe((e) => {
                    expect(e).toMatchObject({
                        key: 'key',
                        type: 'set',
                        value: 'value'
                    });
                    done();
                });
                wrapped.set('key', 'value');
            });

        });

        describe('delete', () => {

            it('passes result through', async () => {
                store.delete.returns(Promise.resolve('ok'));
                const result = await wrapped.delete('key');
                expect(store.delete.args).toEqual(['key']);
                expect(result).toBe('ok');
            });

            it('emits "delete" event', (done) => {
                wrapped.observe('key').subscribe((e) => {
                    expect(e).toMatchObject({
                        key: 'key',
                        type: 'delete'
                    });
                    done();
                });
                wrapped.delete('key');
            });

        });

        describe('observe', () => {

            it('ignores non-matching keys', () => {
                const observer = spy();
                wrapped.observe('key').subscribe(observer);
                wrapped.set('another key', 'value');
                expect(observer.called).toBe(false);
            });

            it('returns new Observable each call', () => {
                const observer1 = wrapped.observe('key');
                const observer2 = wrapped.observe('key');
                expect(observer1).not.toBe(observer2);
            });

            it('notifies for all keys if none specified', async () => {
                const observer = spy();
                wrapped.observe().subscribe(observer);
                await wrapped.set('key', 'value');
                expect(observer.args[0]).toMatchObject({
                    key: 'key',
                    type: 'set',
                    value: 'value',
                });
                await wrapped.set('another key', 'value 2');
                expect(observer.args[0]).toMatchObject({
                    key: 'another key',
                    type: 'set',
                    value: 'value 2',
                });
            });

        });

    });

});