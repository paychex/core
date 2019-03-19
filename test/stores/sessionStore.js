import expect from 'expect';
import sessionStore from '../../stores/sessionStore';

describe('sessionStore', () => {

    it('returns Store interface', () => {
        const store = sessionStore({}, {});
        ['get', 'set', 'delete'].every(method => {
            expect(typeof store[method]).toBe('function');
        });
    });

    it('allows optional config', () => {
        expect(sessionStore(undefined, {})).toBeDefined();
    });

    it('allows optional provider', () => {
        global.sessionStorage = {};
        expect(sessionStore()).toBeDefined();
    });

});