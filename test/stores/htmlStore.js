import expect from 'expect';
import { spy } from '../utils';
import {
    htmlStore,
    localStore,
    memoryStore,
    sessionStore,
} from '../../stores/htmlStore';

describe('htmlStore', () => {

    let browserStorage;

    beforeEach(() => {
        browserStorage = {
            getItem: spy(),
            setItem: spy(),
            removeItem: spy()
        };
    });

    it('returns store interface', () => {
        const store = htmlStore(browserStorage);
        const isMethod = method => typeof store[method] === 'function';
        expect(['get', 'set', 'delete'].every(isMethod)).toBe(true);
    });

    describe('get', () => {

        it('uses key', () => {
            const store = htmlStore(browserStorage);
            store.get('key');
            expect(browserStorage.getItem.args).toEqual(['key']);
        });

        it('rejects if operation fails', (done) => {
            const err = new Error('failure');
            browserStorage.getItem.throws(err);
            const store = htmlStore(browserStorage);
            store.get('key').catch(e => {
                expect(e).toBe(err);
                done();
            });
        });

        it('rejects if JSON invalid', (done) => {
            browserStorage.getItem.returns('{ invalid json ]');
            const store = htmlStore(browserStorage);
            store.get('key').catch(e => {
                expect(e instanceof Error).toBe(true);
                expect(e.message).toContain('JSON');
                done();
            });
        });

        it('resolves with request result', (done) => {
            browserStorage.getItem.returns('"value"');
            const store = htmlStore(browserStorage);
            store.get('key').then(result => {
                expect(result).toBe('value');
                done();
            });
        });

        it('resolves with request result', (done) => {
            browserStorage.getItem.returns(undefined);
            const store = htmlStore(browserStorage);
            store.get('key').then(result => {
                expect(result).toBeUndefined();
                done();
            });
        });

    });

    describe('set', () => {

        it('puts value, key in store', async () => {
            const store = htmlStore(browserStorage);
            await store.set('key', 'value');
            expect(browserStorage.setItem.args).toEqual(['key', '"value"']);
        });

        it('resolves with key on success', async () => {
            const store = htmlStore(browserStorage);
            const result = await store.set('key', 'value');
            expect(result).toBe('key');
        });

        it('rejects if operation fails', done => {
            const err = new Error('failure');
            const store = htmlStore(browserStorage);
            browserStorage.setItem.throws(err);
            store.set('key', 'value').catch(e => {
                expect(e).toBe(err);
                done();
            });
        });

    });

    describe('delete', () => {

        it('deletes key from store', async () => {
            const store = htmlStore(browserStorage);
            await store.delete('key');
            expect(browserStorage.removeItem.args).toEqual(['key']);
        });

        it('resolves with undefined', async () => {
            const store = htmlStore(browserStorage);
            const result = await store.delete('key');
            expect(result).toBeUndefined();
        });

        it('rejects if operation fails', done => {
            const err = new Error('failure');
            const store = htmlStore(browserStorage);
            browserStorage.removeItem.throws(err);
            store.delete('key').catch(e => {
                expect(e).toBe(err);
                done();
            });
        });

    });

});

describe('localStore', () => {

    it('returns Store interface', () => {
        const store = localStore({}, {});
        ['get', 'set', 'delete'].every(method => {
            expect(typeof store[method]).toBe('function');
        });
    });

    it('allows optional provider', () => {
        global.localStorage = {};
        expect(localStore()).toBeDefined();
    });

});

describe('sessionStore', () => {

    it('returns Store interface', () => {
        const store = sessionStore({}, {});
        ['get', 'set', 'delete'].every(method => {
            expect(typeof store[method]).toBe('function');
        });
    });

    it('allows optional provider', () => {
        global.sessionStorage = {};
        expect(sessionStore()).toBeDefined();
    });

});

describe('memoryStore', () => {

    let map, store;

    beforeEach(() => {
        map = {
            get: spy(),
            set: spy(),
            delete: spy()
        };
        store = memoryStore(map);
    });

    it('returns store interface', () => {
        const store = memoryStore();
        const isMethod = method => typeof store[method] === 'function';
        expect(['get', 'set', 'delete'].every(isMethod)).toBe(true);
    });

    describe('get', () => {

        it('uses key', () => {
            store.get('key');
            expect(map.get.args).toEqual(['key']);
        });

        it('rejects if operation fails', (done) => {
            const err = new Error('failure');
            map.get.throws(err);
            store.get('key').catch(e => {
                expect(e).toBe(err);
                done();
            });
        });

        it('rejects if JSON invalid', (done) => {
            map.get.returns('{ invalid json ]');
            store.get('key').catch(e => {
                expect(e instanceof Error).toBe(true);
                expect(e.message).toContain('JSON');
                done();
            });
        });

        it('resolves with request result', (done) => {
            map.get.returns('"value"');
            store.get('key').then(result => {
                expect(result).toBe('value');
                done();
            });
        });

        it('resolves with request result', (done) => {
            map.get.returns(undefined);
            store.get('key').then(result => {
                expect(result).toBeUndefined();
                done();
            });
        });

    });

    describe('set', () => {

        it('puts value, key in store', async () => {
            await store.set('key', 'value');
            expect(map.set.args).toEqual(['key', '"value"']);
        });

        it('resolves with key on success', async () => {
            const result = await store.set('key', 'value');
            expect(result).toBe('key');
        });

        it('rejects if operation fails', done => {
            const err = new Error('failure');
            map.set.throws(err);
            store.set('key', 'value').catch(e => {
                expect(e).toBe(err);
                done();
            });
        });

    });

    describe('delete', () => {

        it('deletes key from store', async () => {
            await store.delete('key');
            expect(map.delete.args).toEqual(['key']);
        });

        it('resolves with undefined', async () => {
            const result = await store.delete('key');
            expect(result).toBeUndefined();
        });

        it('rejects if operation fails', done => {
            const err = new Error('failure');
            map.delete.throws(err);
            store.delete('key').catch(e => {
                expect(e).toBe(err);
                done();
            });
        });

    });

});