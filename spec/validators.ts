import * as expect from 'expect';
import { spy } from './index';

import {
    array,
    object,
    string,
    number,
    date,
    oneOf,
    not,
    range,
    matches,
    some,
    every,
    empty,
    instanceOf,
} from '../validators/index';

describe('validators', () => {

    describe('object', () => {

        it('throws if message not provided', () => {
            expect(() => object.call(null, {})).toThrow('An error message must be provided.');
        });

        it('throws if schema not an object', () => {
            expect(() => object(null, 'message')).toThrow(
                'Schema must be an object whose values are Validator functions.');
        });

        it('throws if schema value is not a function', () => {
            expect(() => object.call(null, { key: 'value' }, 'message')).toThrow(
                'Schema must be an object whose values are Validator functions.');
        });

        it('returns validator', () => {
            expect(object({}, 'message')).toBeInstanceOf(Function);
        });

        it('resolves if object conforms', async () => {
            const validator = object({ key: string('') }, 'invalid');
            const result = await validator({ key: 'value' });
            expect(result).not.toBeInstanceOf(Error);
        });

        it('resolves if object is superconforming', async () => {
            const validator = object({}, 'invalid');
            const result = await validator({ key: 'value' });
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects when object has fewer properties', async () => {
            const validator = object({ key: string('') }, 'invalid');
            try {
                await validator({});
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: {},
                });
            }
        });

        it('passes current value and source recursively', async () => {
            const schema: any = { key: spy() };
            const source = { key: 'proposed' };
            const validator = object(schema, 'invalid');
            await validator(source, { key: 'current' });
            expect(schema.key.args).toEqual(['proposed', 'current', source]);
        });

        it('rejects if object property does not conform', async () => {
            const validator = object({ key: string('must be string') }, 'invalid');
            try {
                await validator({ key: 123 });
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: { key: 123 },
                    current: undefined,
                    inner: [expect.objectContaining({
                        name: 'ValidationError',
                        message: 'must be string',
                        proposed: 123,
                    })],
                });
            }
        });

        it('rejects with all property rejections', async () => {
            const validator = object({
                key: string('string required'),
                val: number('number required'),
            }, 'invalid object');
            try {
                await validator({
                    key: 12345,
                    val: 'str',
                });
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid object',
                    inner: [
                        expect.objectContaining({
                            name: 'ValidationError',
                            message: 'string required',
                            proposed: 12345,
                        }),
                        expect.objectContaining({
                            name: 'ValidationError',
                            message: 'number required',
                            proposed: 'str',
                        })
                    ]
                });
            }
        });

        it('rejects if nested property does not conform', async () => {
            const validator = object({
                key: string('not string'),
                nested: object({
                    num: number('not number'),
                }, 'invalid nested'),
            }, 'invalid');
            try {
                await validator({
                    key: 'valid',
                    nested: {
                        num: 'invalid',
                    }
                });
                throw new Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    inner: [expect.objectContaining({
                        name: 'ValidationError',
                        message: 'invalid nested',
                        inner: [expect.objectContaining({
                            name: 'ValidationError',
                            message: 'not number',
                            proposed: 'invalid',
                            property: 'num',
                        })]
                    })],
                });
            }
        });

        it('rejects if object not provided', async () => {
            const validator = object({}, 'invalid');
            try {
                await validator(null);
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                });
            }
        });

    });

    describe('array', () => {

        it('throws if message not provided', () => {
            expect(() => array.call(null, {})).toThrow('An error message must be provided.');
        });

        it('returns validator', () => {
            expect(array(spy(), 'message')).toBeInstanceOf(Function);
        });

        it('resolves without validator if array provided', async () => {
            const validator = array('invalid');
            const result = await validator([1, 2, 3]);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('resolves if every array element conforms', async () => {
            const validator = array(number('not number'), 'invalid');
            const result = await validator([1, 2, 3]);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('passes current value recursively', async () => {
            const validation = spy();
            const validator = array(validation, 'invalid');
            const proposed = [1, 2, 3];
            await validator(proposed, [1, 2, 4]);
            expect(validation.args).toEqual([3, 4, proposed]);
        });

        it('rejects if any array value does not conform', async () => {
            const validator = array(number('not number'), 'invalid');
            try {
                await validator([1, null, 3]);
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: [1, null, 3],
                    inner: [expect.objectContaining({
                        name: 'ValidationError',
                        message: 'not number',
                        proposed: null,
                        property: 1,
                    })],
                });
            }
        });

        it('rejects if array not provided', async () => {
            const validator = array(spy(), 'invalid');
            try {
                await validator(null);
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                });
            }
        });

    });

    describe('string', () => {

        it('throws if message not provided', () => {
            expect(() => string.call(null, {})).toThrow('An error message must be provided.');
        });

        it('returns validator', () => {
            expect(string('message')).toBeInstanceOf(Function);
        });

        it('resolves if values is string', async () => {
            const validator = string('invalid');
            const result = await validator('valid');
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if non-string provided', async () => {
            try {
                await string('invalid')(123);
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: 123,
                });
            }
        });

    });

    describe('number', () => {

        it('throws if message not provided', () => {
            expect(() => number.call(null, {})).toThrow('An error message must be provided.');
        });

        it('returns validator', () => {
            expect(number('message')).toBeInstanceOf(Function);
        });

        it('resolves if value is numeric', async () => {
            const validator = number('invalid');
            const result = await validator(123);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if non-number provided', async () => {
            try {
                await number('invalid')('123');
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: '123',
                });
            }
        });

    });

    describe('date', () => {

        it('throws if message not provided', () => {
            expect(() => date.call(null, {})).toThrow('An error message must be provided.');
        });

        it('returns validator', () => {
            expect(date('message')).toBeInstanceOf(Function);
        });

        it('resolves if values is date instance', async () => {
            const validator = date('invalid');
            const result = await validator(new Date());
            expect(result).not.toBeInstanceOf(Error);
        });

        it('resolves if value is JSON-encoded', async () => {
            const validator = date('invalid');
            const result = await validator(JSON.parse(JSON.stringify(new Date())));
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if non-date provided', async () => {
            try {
                await date('invalid')('123');
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: '123',
                });
            }
        });

    });

    describe('empty', () => {

        it('throws if message not provided', () => {
            expect(() => empty.call(null, {})).toThrow('An error message must be provided.');
        });

        it('returns validator', () => {
            expect(empty('message')).toBeInstanceOf(Function);
        });

        it('resolves if value is empty', async () => {
            const validator = empty('invalid');
            const result = await Promise.all([
                validator(null),
                validator([]),
                validator(''),
                validator({}),
            ]);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if non-empty provided', async () => {
            try {
                await empty('invalid')('123');
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: '123',
                });
            }
        });

    });

    describe('oneOf', () => {

        it('throws if message not provided', () => {
            expect(() => oneOf.call(null)).toThrow('An error message must be provided.');
        });

        it('throws if array of expected values not provided', () => {
            expect(() => oneOf('message')).toThrow(
                'A non-empty array of expected values must be provided.');
        });

        it('returns validator', () => {
            expect(oneOf([1, 2, 3], 'message')).toBeInstanceOf(Function);
        });

        it('resolves if valid is expected', async () => {
            const validator = oneOf(['a', 'b', 'c'], 'invalid');
            const result = await validator('b');
            expect(result).not.toBeInstanceOf(Error);
        });

        it('resolves if valid is expected', async () => {
            const validator = oneOf('a', 'b', 'c', 'invalid');
            const result = await validator('c');
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if a value is not expected', async () => {
            try {
                await oneOf('a', 'b', 'c', 'invalid')('invalid');
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: 'invalid',
                });
            }
        });

    });

    describe('not', () => {

        it('throws if message not provided', () => {
            expect(() => not.call(null, spy())).toThrow('An error message must be provided.');
        });

        it('throws if validator not provided', () => {
            expect(() => not(null, 'invalid')).toThrow('A validator function must be provided.');
        });

        it('returns validator', () => {
            expect(not.call(null, spy(), 'message')).toBeInstanceOf(Function);
        });

        it('resolves if value does not pass the validator', async () => {
            const validator = not(number('not a number'), 'invalid');
            const result = await Promise.all([
                validator(null),
                validator([123]),
                validator('123'),
                validator({}),
            ]);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if value passes the validator', async () => {
            try {
                await not(string('not a string'), 'invalid')('123');
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: '123',
                });
            }
        });

    });

    describe('range', () => {

        it('throws if message not provided', () => {
            expect(() => range.call(null, 0, 0)).toThrow('An error message must be provided.');
        });

        it('returns validator', () => {
            expect(range(0, 0, 'message')).toBeInstanceOf(Function);
        });

        it('resolves if value is range', async () => {
            const validator = range(0, 10, 'invalid');
            const result = await Promise.all([
                validator(0),
                validator(10),
                validator(4.3),
            ]);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('ignores missing lower bound', async () => {
            const validator = range(null, 10, 'invalid');
            expect(await validator(-10)).not.toBeInstanceOf(Error);
        });

        it('ignores missing upper bound', async () => {
            const validator = range(0, null, 'invalid');
            expect(await validator(100)).not.toBeInstanceOf(Error);
        });

        it('ignores missing bounds', async () => {
            const validator = range(null, null, 'invalid');
            expect(await validator(100)).not.toBeInstanceOf(Error);
            expect(await validator(-100)).not.toBeInstanceOf(Error);
        });

        it('works with non-numeric values', async () => {
            const today = new Date();
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
            const nextweek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            const result = await Promise.all([
                range('a', 'z', 'invalid')('b'),
                range(today, nextweek, 'invalid')(tomorrow),
            ]);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if value not in range', async () => {
            try {
                await range(0, 10, 'invalid')(-1);
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    min: 0,
                    max: 10,
                    proposed: -1,
                });
            }
        });

    });

    describe('matches', () => {

        it('throws if message not provided', () => {
            expect(() => matches.call(null, /rx/)).toThrow('An error message must be provided.');
        });

        it('throws if regular expression not provided', () => {
            expect(() => matches(null, 'invalid')).toThrow('A regular expression must be provided.');
        });

        it('returns validator', () => {
            expect(matches(/rx/, 'message')).toBeInstanceOf(Function);
        });

        it('resolves if value matches the regular expression', async () => {
            const validator = matches(/^[a-f]{3}\d+/, 'invalid');
            const result = await validator('abc123');
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if value does not match the regular expression', async () => {
            try {
                await matches(/^[a-f]{3}\d+/, 'invalid')('abcd123');
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: 'abcd123',
                });
            }
        });

    });

    describe('some', () => {

        it('throws if message not provided', () => {
            expect(() => some.call(null, spy())).toThrow('An error message must be provided.');
        });

        it('throws if non-function validator provided', () => {
            expect(() => some.call(null, [null], 'invalid')).toThrow('A non-validator was provided.');
        });

        it('returns validator', () => {
            expect(some([spy()], 'message')).toBeInstanceOf(Function);
        });

        it('resolves if at least one validator passes', async () => {
            const validator = some([string('not string'), number('not number')], 'invalid');
            const result = await Promise.all([
                validator(123),
                validator('123'),
            ]);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if all validators reject', async () => {
            const validator = some([string('not string'), number('not number')], 'invalid');
            try {
                await validator(new Date());
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: expect.any(Date),
                    inner: [
                        expect.any(Error),
                        expect.any(Error),
                    ],
                });
            }
        });

        it('rejects if no validators provided', async () => {
            const validator = some('invalid');
            try {
                await validator(null);
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: null,
                    inner: [],
                });
            }
        });

    });

    describe('every', () => {

        it('throws if message not provided', () => {
            expect(() => every.call(null, spy())).toThrow('An error message must be provided.');
        });

        it('throws if non-function validator provided', () => {
            expect(() => every([null], 'invalid')).toThrow('A non-validator was provided.');
        });

        it('returns validator', () => {
            expect(every.call(null, spy(), 'message')).toBeInstanceOf(Function);
        });

        it('resolves if all validators pass', async () => {
            const validator = every([string('not string'), not(empty('empty'), 'not empty')], 'invalid');
            const result = await Promise.all([
                validator('456'),
                validator('123'),
            ]);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if one validator rejects', async () => {
            const validator = every([string('not string'), empty('not empty')], 'invalid');
            try {
                await validator('123');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: '123',
                    inner: [expect.objectContaining({
                        name: 'ValidationError',
                        message: 'not empty',
                        proposed: '123',
                    })]
                });
            }
        });

        it('resolves if no validators provided', async () => {
            const validator = every('invalid');
            const result = await validator(null);
            expect(result).not.toBeInstanceOf(Error);
        });

    });

    describe('instanceOf', () => {

        it('throws if message not provided', () => {
            expect(() => instanceOf.call(null, RegExp)).toThrow('An error message must be provided.');
        });

        it('throws if class type not provided', () => {
            expect(() => instanceOf(null, 'invalid')).toThrow('A class type must be provided.');
        });

        it('returns validator', () => {
            expect(instanceOf(RegExp, 'message')).toBeInstanceOf(Function);
        });

        it('resolves if value instanceof the specified type', async () => {
            const validator = instanceOf(RegExp, 'invalid');
            const result = await validator(/rx/);
            expect(result).not.toBeInstanceOf(Error);
        });

        it('rejects if value is not an instance of the specified type', async () => {
            try {
                await instanceOf(RegExp, 'invalid')(123);
                throw Error('should not be reached');
            } catch (e) {
                expect(e).toMatchObject({
                    name: 'ValidationError',
                    message: 'invalid',
                    proposed: 123,
                });
            }
        });

    });

});