import expect from 'expect'
import { spy } from '../utils';
import { withEncryption, asResponseCache } from '../../stores'

describe('stores', () => {

    describe('withEncryption', () => {

        let store;

        const key_b64 = 'QDdkotT6p4E8iO9A9Hg1KpDGVMsAP/JshpYvASYbKHA=';
        const key_arr = [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
            16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
        ];

        const salt_b64 = '00Z5V9BTHZCQIU6C3PZ6';
        const salt_arr = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];

        beforeEach(() => {
            store = {
                get: spy(),
                set: spy(),
                delete: spy()
            };
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

        it('encrypts value with base64 key and byte array salt', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_b64,
                salt: salt_arr
            });
            await wrapper.set('key', value);
            expect(store.set.called).toBe(true);
            expect(store.set.args[1]).toBe('7b7255ef2196eb42855328235e064dee77d25a9c6a9d3b6ccfe306d250265584');
        });

        it('encrypts value with byte array key and byte array salt', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_arr,
                salt: salt_arr
            });
            await wrapper.set('key', value);
            expect(store.set.called).toBe(true);
            expect(store.set.args[1]).toBe('e0038ab74cd8de9e6c674be7c53a509a37c91bdec12c2661b8cd0d199d8d7aa5');
        });

        it('encrypts value with base64 key and base64 salt', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_b64,
                salt: salt_b64
            });
            await wrapper.set('key', value);
            expect(store.set.called).toBe(true);
            expect(store.set.args[1]).toBe('d230fd880f57d428c9191d4a2c50b246940f9455bba60c75a5da848cbd9d5ed8');
        });

        it('encrypts value with byte array key and base64 salt', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_arr,
                salt: salt_b64
            });
            await wrapper.set('key', value);
            expect(store.set.called).toBe(true);
            expect(store.set.args[1]).toBe('ca5c6df4a077be9b01b15db1f78c415c9e5a95b01ba425b2c13feeae8e2f28c6');
        });

        it('decrypts value with base64 key and byte array salt', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_b64,
                salt: salt_arr
            });
            store.get.returns(Promise.resolve('7b7255ef2196eb42855328235e064dee77d25a9c6a9d3b6ccfe306d250265584'));
            const result = await wrapper.get('key');
            expect(store.get.called).toBe(true);
            expect(result).toMatchObject(value);
        });

        it('decrypts value with byte array key and byte array salt', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_arr,
                salt: salt_arr
            });
            store.get.returns(Promise.resolve('e0038ab74cd8de9e6c674be7c53a509a37c91bdec12c2661b8cd0d199d8d7aa5'));
            const result = await wrapper.get('key');
            expect(store.get.called).toBe(true);
            expect(result).toMatchObject(value);
        });

        it('decrypts value with base64 key and base64 salt', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_b64,
                salt: salt_b64
            });
            store.get.returns(Promise.resolve('d230fd880f57d428c9191d4a2c50b246940f9455bba60c75a5da848cbd9d5ed8'));
            const result = await wrapper.get('key');
            expect(store.get.called).toBe(true);
            expect(result).toMatchObject(value);
        });

        it('decrypts value with byte array key and base64 salt', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_arr,
                salt: salt_b64
            });
            store.get.returns(Promise.resolve('ca5c6df4a077be9b01b15db1f78c415c9e5a95b01ba425b2c13feeae8e2f28c6'));
            const result = await wrapper.get('key');
            expect(store.get.called).toBe(true);
            expect(result).toMatchObject(value);
        });

        it('encrypts using ctr method', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_arr,
                method: 'ctr'
            });
            await wrapper.set('key', value);
            expect(store.set.called).toBe(true);
            expect(store.set.args[1]).toBe('d2252e84131425d1728c1d553e12278a8e4d43079cdc5defde84deca1b294594');
        });

        it('decrypts using ctr method', async () => {
            const value = { object: 'string' };
            const wrapper = withEncryption(store, {
                key: key_arr,
                method: 'ctr'
            });
            store.get.returns(Promise.resolve('d2252e84131425d1728c1d553e12278a8e4d43079cdc5defde84deca1b294594'));
            const result = await wrapper.get('key');
            expect(store.get.called).toBe(true);
            expect(result).toMatchObject(value);
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

});