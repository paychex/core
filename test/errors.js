import expect from 'expect';
import { fail } from 'assert';
import {
    rethrow,
    error,
    fatal,
    ignore,
    ERROR,
    FATAL,
    IGNORE
} from '../errors';

describe('errors', () => {

    describe('error', () => {

        it('creates Error instance', () => {
            const type = Object.prototype.toString;
            expect(type.call(error('message'))).toBe('[object Error]');
        });

        it('mixes in key/value pairs', () => {
            const err = error('message', { key: 'value' });
            expect(err.key).toBe('value');
            expect(err.message).toBe('message');
        });

        it('severity is ERROR', () => {
            const err = error('message');
            expect(err.severity).toBe(ERROR);
        });

    });

    describe('fatal', () => {

        it('returns empty object', () => {
            expect(fatal()).toMatchObject({});
        });

        it('returns object with key-value pairs', () => {
            const data = { key: 'value' };
            const err = fatal(data);
            expect(err).not.toBe(data);
            expect(err).toMatchObject(data);
        });

        it('has FATAL severity', () => {
            expect(fatal().severity).toBe(FATAL);
        });

        it('overrides ERROR severity', () => {
            expect(error('test', fatal()).severity).toBe(FATAL);
        });

    });

    describe('ignore', () => {

        it('returns empty object', () => {
            expect(ignore()).toMatchObject({});
        });

        it('returns object with key-value pairs', () => {
            const data = { key: 'value' };
            const err = ignore(data);
            expect(err).not.toBe(data);
            expect(err).toMatchObject(data);
        });

        it('has IGNORE severity', () => {
            expect(ignore().severity).toBe(IGNORE);
        });

        it('overrides ERROR severity', () => {
            expect(error('test', ignore()).severity).toBe(IGNORE);
        });

    });

    describe('rethrow', () => {

        let error, props;

        beforeEach(() => {
            props = { key: 'value' };
            error = new Error('test error');
        });

        it('(error, props) decorates Error', () => {
            try {
                rethrow(error, props);
                fail('should not be reached');
            } catch (e) {
                expect(e.key).toBe('value');
                expect(e.message).toBe('test error');
            }
        });

        it('(props, error) decorates Error', () => {
            try {
                rethrow(props, error);
                fail('should not be reached');
            } catch (e) {
                expect(e.key).toBe('value');
                expect(e.message).toBe('test error');
            }
        });

        it('(error)(props) decorates Error', () => {
            try {
                rethrow(error)(props);
                fail('should not be reached');
            } catch (e) {
                expect(e.key).toBe('value');
                expect(e.message).toBe('test error');
            }
        });

        it('(props)(error) decorates Error', () => {
            try {
                rethrow(props)(error);
                fail('should not be reached');
            } catch (e) {
                expect(e.key).toBe('value');
                expect(e.message).toBe('test error');
            }
        });

    });

});