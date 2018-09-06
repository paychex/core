import expect from 'expect'
import tokenize from '../../data/Tokenizer'

describe('Tokenizer', () => {

    const none = 'http://www.url.com';
    const qs = 'http://www.url.com?key=value';
    const tokens = 'http://www.:token1.com/:token2';

    const params = {
        token1: 'value1',
        token2: 'value2'
    };

    it('does nothing if url has no tokens and no params given', () => {
        expect(tokenize(none)).toBe(none);
    });

    it('returns original url if tokens present but no params given', () => {
        expect(tokenize(tokens)).toBe(tokens);
    });

    it('replaces tokens with params', () => {
        expect(tokenize(tokens, params)).toBe('http://www.value1.com/value2');
    });

    it('appends params to querystring when no tokens', () => {
        expect(tokenize(none, params)).toBe('http://www.url.com?token1=value1&token2=value2');
    });

    it('appends params to existing querystring', () => {
        expect(tokenize(qs, params)).toBe('http://www.url.com?key=value&token1=value1&token2=value2');
    });

    it('uses correct array syntax', () => {
        expect(tokenize(none, {
            arr: ['value1', 'value2']
        })).toBe('http://www.url.com?arr=value1&arr=value2');
    });

    it('appends untokenized params to querystring', () => {
        expect(tokenize(tokens, {
            token1: 'value1',
            token2: 'value2',
            token3: 'value3'
        })).toBe('http://www.value1.com/value2?token3=value3');
    });

    it('does not modify original params object', () => {
        const copy = {...params};
        tokenize(tokens, params);
        expect(params).toMatchObject(copy);
    });

});