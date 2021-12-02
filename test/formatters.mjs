import expect from 'expect';

import { create, utils } from '../formatters/index.mjs';

describe('formatters', () => {

    let format;

    beforeEach(() => format = create({
        locale: 'en-US',
        numberOptions: { currency: 'USD' },
    }));

    describe('utils', () => {

        describe('tokens', () => {

            it('throws if non-array provided', () => {
                expect(() => utils.tokens()).toThrow();
                expect(() => utils.tokens('')).toThrow();
            });

            it('throws if array of non-array provided', () => {
                expect(() => utils.tokens([])).toThrow();
                expect(() => utils.tokens([123])).toThrow();
                expect(() => utils.tokens(['abc'])).toThrow();
            });

            it('returns mask factory', () => {
                const factory = utils.tokens([['x', () => true]]);
                expect(factory).toBeInstanceOf(Function);
                const mask = factory('abc');
                expect(mask.mask).toBe('abc');
                expect(mask.rxToken).toBeInstanceOf(Function);
            });

            it('mask has correct tokens', () => {
                const factory = utils.tokens([
                    ['a', () => true],
                    ['z', () => true],
                ]);
                const mask = factory('abc');
                expect(mask.rxToken().test('b')).toBe(false);
                expect(mask.rxToken().test('a')).toBe(true);
                expect(mask.rxToken().test('z')).toBe(true);
            });

        });

        describe('withReplacement', () => {

            [
                ['string pattern and string replacer', '123', 'num'],
                ['regular expression pattern and function replacer', /^123/, () => 'num'],
                ['string pattern and function replacer', '123', () => 'num'],
                ['regular expression pattern and string replacer', /^123/, 'num'],
            ].forEach(([name, pattern, replacer]) => {

                it(`using ${name}`, () => {
                    const formatter = utils.withReplacement(String, pattern, replacer);
                    expect(formatter(123456789)).toBe('num456789');
                });

            });

            it('works with tokens', () => {
                const toSSN = utils.withReplacement(format.toDigits, /^\d{5}(\d{4})$/, 'XXX-XX-$1');
                expect(toSSN('123.45.6789')).toBe('XXX-XX-6789');
            });

        });

        describe('withMask', () => {

            it('works with custom mask', () => {
                const factory = utils.tokens([
                    ['*', (v) => /./.test(v)], // matches anything
                    ['0', (v) => /\d/.test(v)], // 0 matches any digit
                    ['.', (v) => /[a-z]/i.test(v)], // period matches any letter
                ]);
                const mask = factory('#000-**-....');
                const format = utils.withMask(String, mask);
                expect(format('1234abcdefg')).toBe('#123-4a-bcde');
            });

            [
                ['(###)', '(123)'],
                ['1 (###) ###-####', '1 (123) 456-7890'],
            ].forEach(([pattern, output]) => {

                it(`using ${pattern}`, () => {
                    const mask = utils.MASKS.AlphaNumeric(pattern);
                    const masker = utils.withMask(String, mask);
                    expect(masker(1234567890)).toBe(output);
                });

            });

            it('works with escaped tokens', () => {
                const mask = utils.MASKS.AlphaNumeric('\\###')
                const masker = utils.withMask(String, mask);
                expect(masker(123)).toBe('#12');
            });

            it('works with multiple escaped tokens', () => {
                const mask = utils.MASKS.AlphaNumeric('\\##\\#');
                const masker = utils.withMask(String, mask);
                expect(masker(123)).toBe('#1#');
            });

            it('works with multiple escaped tokens in a row', () => {
                const mask = utils.MASKS.AlphaNumeric('\\#\\##');
                const masker = utils.withMask(String, mask);
                expect(masker(123)).toBe('##1');
            });

            it('works with escaped characters', () => {
                const mask = utils.MASKS.AlphaNumeric('\\AB##');
                const masker = utils.withMask(String, mask);
                expect(masker(123)).toBe('AB12');
            });

            it('AlphaNumeric mask works only with uppercase', () => {
                const mask = utils.MASKS.AlphaNumeric('xXx');
                const masker = utils.withMask(String, mask);
                expect(masker('abc')).toBe('xax');
            });

            it('can be used multiple times', () => {
                const mask = utils.MASKS.AlphaNumeric('###');
                const f1 = utils.withMask(String, mask);
                const f2 = utils.withMask(String, mask);
                const f3 = utils.withMask(String, mask);
                expect(f1(123)).toBe(f2(123));
                expect(f2(123)).toBe(f3(123));
                expect(f3(123)).toBe(f1(123));
            });

            it('works with other formatters', () => {
                const numbers = format.toDigits;
                const mask = utils.MASKS.AlphaNumeric('***-**-####');
                const last4 = utils.withReplacement(numbers, /^\d{5}/, '');
                const ssn = utils.withMask(last4, mask);
                expect(ssn(1234567890)).toBe('***-**-6789');
            });

            it('can be provided a mask directly', () => {
                const format = utils.withMask(String, {
                    mask: '(###)',
                    rxToken: () => /[#]/g,
                    test: (_, value) => /\d/.test(value),
                });
                expect(format('c12345')).toBe('(12)');
            });

        });

    });

    describe('toDigits', () => {

        it('does nothing to digits', () => {
            expect(format.toDigits(123)).toBe('123');
        });

        it('replaces non-digits with empty string', () => {
            expect(format.toDigits('a1b2c3')).toBe('123');
        });

    });

    describe('toNumber', () => {

        [
            ['simple numbers', 123, '123'],
            ['negative numbers', -123, '-123'],
            ['fractional amounts', 123e-3, '0.123'],
            ['positive infinity', Number.POSITIVE_INFINITY, '∞'],
            ['negative infinity', Number.NEGATIVE_INFINITY, '-∞'],
        ].forEach(([name, input, output]) => {

            it(`handles ${name}`, () => {
                expect(format.toNumber(input)).toBe(output);
            });

        });

        it('shows grouping separator if necessary', () => {
            expect(format.toNumber(123456)).toBe('123,456');
        });

        it('shows 3 decimals by default', () => {
            expect(format.toNumber(123.456789)).toBe('123.457');
        });

        it('honors number options', () => {
            const formats = create({
                numberOptions: {
                    notation: 'scientific',
                    maximumFractionDigits: 10
                }
            });
            expect(formats.toNumber(123.456789)).toBe('1.23456789E2');
        });

    });

    describe('toParts', () => {

        it('bound correctly', () => {
            expect(() => format.toDate(Date.now())).not.toThrow();
            expect(() => format.toTime(Date.now())).not.toThrow();
            expect(() => format.toNumber(123)).not.toThrow();
            expect(() => format.toCurrency(123)).not.toThrow();
            expect(() => format.toNumberParts(123)).not.toThrow();
            expect(() => format.toDateParts(Date.now())).not.toThrow();
            expect(() => format.toTimeParts(Date.now())).not.toThrow();
        });

    });

    describe('toCurrency', () => {

        let $;
        beforeEach(() => $ = format.toCurrency);

        it('handles simple numbers', () => {
            expect($(123)).toBe('$123.00');
        });

        it('formats negative numbers', () => {
            expect($(-123)).toBe('-$123.00');
        });

        it('rounds decimals if necessary', () => {
            expect($(123.456)).toBe('$123.46');
        });

        it('shows grouping separator if necessary', () => {
            expect($(12345)).toBe('$12,345.00');
        });

        it('works with other formatters', () => {
            const strip00 = utils.withReplacement($, '.00', '');
            expect(strip00(123)).toBe('$123');
        });

        [
            ['fractional amounts', 123e-3, '$0.12'],
            ['positive infinity', Number.POSITIVE_INFINITY, '$∞'],
            ['negative infinity', Number.NEGATIVE_INFINITY, '-$∞'],
        ].forEach(([name, input, output]) => {

            it(`handles ${name}`, () => {
                expect($(input)).toBe(output);
            });

        });

    });

    describe('toTime', () => {

        it('uses short date format', () => {
            expect(format.toTime(new Date('1/2/2000 23:45'))).toBe('11:45 PM');
        });

    });

    describe('toList', () => {

        it('works with conjunction', () => {
            expect(format.toList([1, 2, 3], true)).toBe('1, 2, and 3');
        });

        it('works with disjunction', () => {
            expect(format.toList([1, 2, 3], false)).toBe('1, 2, or 3');
        });

        it('conjunction is the default', () => {
            expect(format.toList([1, 2, 3])).toBe('1, 2, and 3');
        });

        it('works with 2 items', () => {
            expect(format.toList([1, 2])).toBe('1 and 2');
        });

        it('works with 1 item', () => {
            expect(format.toList([1])).toBe('1');
        });

        it('works with no items', () => {
            expect(format.toList()).toBe('');
            expect(format.toList([])).toBe('');
        });

    });

    describe('toRelativeDateTime', () => {

        const ONE_SECOND = 1000;
        const ONE_MINUTE = ONE_SECOND * 60;
        const ONE_HOUR = ONE_MINUTE * 60;
        const ONE_DAY = ONE_HOUR * 24;
        const ONE_WEEK = ONE_DAY * 7;
        const ONE_MONTH = ONE_WEEK * 4.35;
        const ONE_YEAR = ONE_MONTH * 12;

        it('works with near future dates', () => {
            const today = Date.now();
            const tomorrow = today + ONE_DAY;
            const afterTomorrow = today + 2 * ONE_DAY;
            expect(format.toRelativeDateTime(today, tomorrow)).toBe('tomorrow');
            expect(format.toRelativeDateTime(today, afterTomorrow)).toBe('in 2 days');
        });

        it('works with near past dates', () => {
            const today = Date.now();
            const tomorrow = today - ONE_DAY;
            const dayBefore = today - 2 * ONE_DAY;
            expect(format.toRelativeDateTime(today, tomorrow)).toBe('yesterday');
            expect(format.toRelativeDateTime(today, dayBefore)).toBe('2 days ago');
        });

        it('works with short time frames', () => {
            const now = Date.now();
            const sp20 = now + 20 * ONE_SECOND;
            const sn20 = now - 20 * ONE_SECOND;
            const mp20 = now + 20 * ONE_MINUTE;
            const mn20 = now - 20 * ONE_MINUTE;
            expect(format.toRelativeDateTime(now, sp20)).toBe('in 20 seconds');
            expect(format.toRelativeDateTime(now, sn20)).toBe('20 seconds ago');
            expect(format.toRelativeDateTime(now, mp20)).toBe('in 20 minutes');
            expect(format.toRelativeDateTime(now, mn20)).toBe('20 minutes ago');
        });

        it('works with long time frames', () => {
            const now = Date.now();
            const wp3 = now + 3 * ONE_WEEK;
            const wn3 = now - 3 * ONE_WEEK;
            const mp4 = now + 4 * ONE_MONTH;
            const mn4 = now - 4 * ONE_MONTH;
            const yp5 = now + 5 * ONE_YEAR;
            const yn5 = now - 5 * ONE_YEAR;
            expect(format.toRelativeDateTime(now, wp3)).toBe('in 3 weeks');
            expect(format.toRelativeDateTime(now, wn3)).toBe('3 weeks ago');
            expect(format.toRelativeDateTime(now, mp4)).toBe('in 4 months');
            expect(format.toRelativeDateTime(now, mn4)).toBe('4 months ago');
            expect(format.toRelativeDateTime(now, yp5)).toBe('in 5 years');
            expect(format.toRelativeDateTime(now, yn5)).toBe('5 years ago');
        });

        it('works with extra long time frames', () => {
            const start = new Date(0, 0, 0);
            const stop = Date.parse(start) + 4000 * ONE_YEAR;
            expect(format.toRelativeDateTime(start, stop)).toBe('in 4,000 years');
        });

    });

    it('works with other locales', () => {
        const formats = create({
            locale: 'en-GB',
            numberOptions: {
                notation: 'scientific',
                maximumFractionDigits: 5,
            },
            currencyOptions: {
                currency: 'GBP',
                currencySign: 'accounting',
            },
        });
        expect(formats.toNumber(-12345.67890)).toBe('-1.23457E4');
        expect(formats.toCurrency(-12345.67890)).toBe('(£12,345.68)');
    });

});