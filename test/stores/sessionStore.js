import expect from 'expect';
import { spy } from '../utils';
import sessionStore from '../../stores/sessionStore';

describe('sessionStore', () => {

    let sessionStorage;

    beforeEach(() => {
        sessionStorage = {
            getItem: spy(),
            setItem: spy(),
            removeItem: spy()
        };
    });

    it('returns store interface', () => {
        const store = sessionStore({ prefix: 'test' }, sessionStorage);
        const isMethod = method => typeof store[method] === 'function';
        expect(['get', 'set', 'delete'].every(isMethod)).toBe(true);
    });

    describe('get', () => {

        it('prefixes key', () => {
            const store = sessionStore({ prefix: 'test' }, sessionStorage);
            store.get('key');
            expect(sessionStorage.getItem.args).toEqual(['test:key']);
        });

        it('uses key directly if no prefix', () => {
            const store = sessionStore({}, sessionStorage);
            store.get('key');
            expect(sessionStorage.getItem.args).toEqual(['key']);
        });

        it('rejects if operation fails', (done) => {
            const err = new Error('failure');
            sessionStorage.getItem.throws(err);
            const store = sessionStore({}, sessionStorage);
            store.get('key').catch(e => {
                expect(e).toBe(err);
                done();
            });
        });

        it('rejects if JSON invalid', (done) => {
            sessionStorage.getItem.returns('{ invalid json ]');
            const store = sessionStore({}, sessionStorage);
            store.get('key').catch(e => {
                expect(e instanceof Error).toBe(true);
                expect(e.message).toContain('JSON');
                done();
            });
        });

        it('resolves with request result', (done) => {
            sessionStorage.getItem.returns('"value"');
            const store = sessionStore({}, sessionStorage);
            store.get('key').then(result => {
                expect(result).toBe('value');
                done();
            });
        });

        it('resolves with request result', (done) => {
            sessionStorage.getItem.returns(undefined);
            const store = sessionStore({}, sessionStorage);
            store.get('key').then(result => {
                expect(result).toBeUndefined();
                done();
            });
        });

    });

    describe('set', () => {

        it('puts value, key in store', async () => {
            const store = sessionStore({}, sessionStorage);
            await store.set('key', 'value');
            expect(sessionStorage.setItem.args).toEqual(['key', '"value"']);
        });

        it('resolves with key on success', async () => {
            const store = sessionStore({ prefix: 'test' }, sessionStorage);
            const result = await store.set('key', 'value');
            expect(result).toBe('key');
        });

        it('rejects if operation fails', done => {
            const err = new Error('failure');
            const store = sessionStore({ }, sessionStorage);
            sessionStorage.setItem.throws(err);
            store.set('key', 'value').catch(e => {
                expect(e).toBe(err);
                done();
            });
        });

    });

    describe('delete', () => {

        it('deletes key from store', async () => {
            const store = sessionStore({ prefix: 'test' }, sessionStorage);
            await store.delete('key');
            expect(sessionStorage.removeItem.args).toEqual(['test:key']);
        });

        it('resolves with undefined', async () => {
            const store = sessionStore({}, sessionStorage);
            const result = await store.delete('key');
            expect(result).toBeUndefined();
        });

        it('rejects if operation fails', done => {
            const err = new Error('failure');
            const store = sessionStore({}, sessionStorage);
            sessionStorage.removeItem.throws(err);
            store.delete('key').catch(e => {
                expect(e).toBe(err);
                done();
            });
        });

    });

});