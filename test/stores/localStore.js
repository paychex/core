import expect from 'expect';
import localStore from '../../stores/localStore';

describe('localStore', () => {

    it('returns Store interface', () => {
        const store = localStore({}, {});
        ['get', 'set', 'delete'].every(method => {
            expect(typeof store[method]).toBe('function');
        });
    });

    it('allows optional config', () => {
        expect(localStore(undefined, {})).toBeDefined();
    });

    it('allows optional provider', () => {
        global.localStorage = {};
        expect(localStore()).toBeDefined();
    });

});