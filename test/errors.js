import expect from 'expect';
import { rethrow } from '../errors';
import { fail } from 'assert';

describe('errors', () => {

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