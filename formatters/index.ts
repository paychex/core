/**
 * Provides functionality to control text output.
 *
 * ```js
 * // esm
 * import { formatters } from '@paychex/core';
 *
 * // cjs
 * const { formatters } = require('@paychex/core');
 *
 * // iife
 * const { formatters } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ formatters }) { ... });
 * define(['@paychex/core'], function({ formatters }) { ... });
 * ```
 *
 * @module formatters
 * @example
 * ```js
 * // defaults to English number formatting and USD currency
 * const format = formatters.create();
 * format.toNumber(-12345.67890); // '-12,345.679'
 * format.toCurrency(-12345.67890); // '-$12,345.68'
 * ```
 * @example
 * ```js
 * // specify US region of English
 * const format = formatters.create({ locale: 'en-US' });
 * format.toNumber(-12345.67890); // '-12,345.679'
 * format.toCurrency(-12345.67890); // '-$12,345.68'
 * ```
 * @example
 * ```js
 * // British English number formatting and Pound Sterling currency
 * const format = formatters.create({
 *   locale: 'en-GB',
 *   numberOptions: {
 *     notation: 'scientific',
 *     maximumFractionDigits: 5,
 *   },
 *   currencyOptions: {
 *     currency: 'GBP',
 *     currencySign: 'accounting',
 *   },
 * });
 * format.toNumber(-12345.67890); // '-1.23457E4'
 * format.toCurrency(-12345.67890); // '(£12,345.68)'
 * ```
 */

import * as utils from './utils';

export { utils };

/**
 * Generic formatter function. Takes a value and returns a string.
 *
 * @param value The value to format as a string.
 * @returns A formatted string.
 */
export interface Formatter { (value: any): string }

/**
 * Creates a new {@link Mask} instance for use with {@link module:formatters/utils.withMask withMask}.
 * A MaskFactory is returned for you by the {@link module:formatters/utils.tokens tokens} method and the
 * properties of the {@link module:formatters/utils.MASKS MASKS} object.
 *
 * @param pattern The pattern to use with the specified mask.
 * @returns The Mask instance for use with {@link module:formatters/utils.withMask withMask}.
 */
export interface MaskFactory { (pattern: string): Mask }

/**
 * Options object passed to {@link module:formatters/create create} when constructing formatters.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl MDN Intl Documentation}
 */
export interface FormatterOptions {

    /**
     * The {@link https://www.w3.org/International/core/langtags/rfc3066bis BCP 47} language tag.
     *
     * @default 'en'
     */
    locale: string | string[]

    /**
     * Options for configuring number presentation.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#parameters MDN NumberFormat}
     */
    numberOptions: Intl.NumberFormatOptions

    /**
     * Options for configuring currency presentation.
     *
     * The default option is `{ currency: 'USD' }`.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#parameters MDN NumberFormat}
     */
    currencyOptions: Intl.NumberFormatOptions

    /**
     * Options for configuring date presentation.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#parameters MDN DateTimeFormat}
     */
    dateOptions: Intl.DateTimeFormatOptions

    /**
     * Options for configuring time presentation.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#parameters MDN DateTimeFormat}
     */
    timeOptions: Intl.DateTimeFormatOptions

    /**
     * Options for configuring how to show the difference between 2 dates or times.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat/RelativeTimeFormat MDN RelativeTimeFormat}
     */
    relativeOptions: Intl.RelativeTimeFormatOptions

    /**
     * Options for configuring how to show a list of items.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat/ListFormat MDN ListFormat}
     */
    listOptions: Record<string, any>

}

export type DateRepresentation = number | string | Date;

/**
 * Contains formatting methods to convert values to strings.
 */
export interface Formats {

    /**
     * Converts the given value to a currency string.
     *
     * @param value The value to convert to currency.
     * @returns The value in currency format.
     * @example
     * ```js
     * const format = formatters.create();
     * format.toCurrency(-123456.7890); // '-$123,456.79'
     * ```
     */
    toCurrency: (value: number | string) => string

    /**
     * Strips any non-digit characters from the input,
     * leaving only numbers in the result string.
     *
     * @param value The value to convert to all-digits.
     * @returns The value stripped of any non-digits.
     * @example
     * ```js
     * const format = formatters.create();
     * format.toDigits('a1b2c3'); // '123'
     * ```
     */
    toDigits: (value: number | string) => string

    /**
     * Converts the given value to a number with proper formatting.
     *
     * @param value The value to format as a number.
     * @returns The value in number format.
     * @example
     * ```js
     * const format = formatters.create();
     * format.toNumber(-12345.67890); // '-12,345.679'
     * ```
     */
    toNumber: (value: number) => string

    /**
     * Converts the given value to a Date string with proper formatting.
     *
     * @param value The value to format as a Date.
     * @returns The value in Date format.
     * @example
     * ```js
     * const format = formatters.create();
     * format.toDate(new Date(2000, 0, 1)); // '1/1/2000'
     * ```
     */
    toDate: (value: number | Date) => string

    /**
     * Converts the given value to a time with proper formatting.
     *
     * @param value The value to format as a time.
     * @returns The value in time format.
     * @example
     * ```js
     * const format = formatters.create();
     * format.toTime(new Date('1/2/2000 23:45'))); // '11:45 PM'
     * ```
     */
    toTime: (value: number | Date) => string

    /**
     * Converts the given value to an array of date parts you can use
     * to construct your own date representations.
     *
     * @param value The value to parse into date parts.
     * @returns The date parts array.
     * @example
     * ```js
     * const format = formatters.create();
     * format.toDateParts(Date.now())
     *   .map(entry => entry.value)
     *   .join('');
     * ```
     */
    toDateParts: (value: number | Date) => Intl.DateTimeFormatPart[]

    /**
     * Converts the given value to an array of number parts you can use
     * to construct your own numeric representations.
     *
     * @param value The value to parse into number parts.
     * @returns The number parts array.
     * @example
     * ```js
     * const format = formatters.create();
     * format.toNumberParts(123_456_789)
     *   .map(entry => entry.value)
     *   .join('');
     * ```
     */
    toNumberParts: (value: number | bigint) => Intl.NumberFormatPart[]

    /**
     * Converts the given value to an array of date parts you can use
     * to construct your own time representation.
     *
     * @param value The value to parse into time parts.
     * @returns The time parts array.
     * @example
     * ```js
     * const format = formatters.create();
     * format.toTimeParts(Date.now())
     *   .map(entry => entry.value)
     *   .join('');
     * ```
     */
    toTimeParts: (value: number | Date) => Intl.DateTimeFormatPart[]

    /**
     * Represents the difference between 2 dates in human-readable, friendly format.
     *
     * @param baseDateTime The base date to use for comparison.
     * @param offsetDateTime The date to compare against the base date.
     * @returns A human-readably friendly representation of the difference between the 2 dates.
     * @example
     * ```js
     * const ONE_DAY = 1000 * 60 * 60 * 24;
     * const format = formatters.create();
     * const today = Date.now();
     * const tomorrow = today + ONE_DAY;
     * const dayAfterTomorrow = tomorrow + ONE_DAY;
     * format.toRelativeDateTime(today, tomorrow); // 'tomorrow'
     * format.toRelativeDateTime(today, dayAfterTomorrow); // 'in 2 days'
     * ```
     */
    toRelativeDateTime: (baseDateTime: DateRepresentation, offsetDateTime: DateRepresentation) => string

    /**
     * Converts the given value to an array of parts you can use to
     * construct your own friendly representation of the difference
     * between 2 dates.
     *
     * @param baseDateTime The base date to use for comparison.
     * @param offsetDateTime The date to compare against the base date.
     * @returns Time relative time format array.
     * @example
     * ```js
     * const ONE_DAY = 1000 * 60 * 60 * 24;
     * const format = formatters.create();
     * const today = Date.now();
     * const tomorrow = today + ONE_DAY;
     * format.toRelativeDateTimeParts(today, tomorrow)
     *   .map(entry => entry.value)
     *   .join('');
     * ```
     */
    toRelativeDateTimeParts: (baseDateTime: DateRepresentation, offsetDateTime: DateRepresentation) => Intl.RelativeTimeFormatPart[]

    /**
     * Formats a list of items for display to a user.
     *
     * @param items The items to list. Will be converted to Strings before formatting.
     * @param conjunction Whether to consider the items combined (e.g. "and") or separate (e.g. "or").
     * @returns The formatted list.
     * @example
     * ```js
     * const format = formatters.create();
     * const items = ['dog', 'cat', 'mouse'];
     * format.toList(items); // 'dog, cat, and mouse'
     * format.toList(items, false); // 'dog, cat, or mouse'
     * ```
     */
    toList: (items?: any[], conjunction?: boolean) => string

}

/**
 * Contains information used to format strings for display using token replacement.
 */
export interface Mask {

    /**
     * The mask to apply to an input.
     */
    mask: string

    /**
     * Creates a new regular expression that matches a single
     * token from the mask to be replaced by the next input character.
     *
     * @returns
     */
    rxToken: () => RegExp

    /**
     * Determines whether the given value from the input matches
     * the specified symbol type. If it does, the input will be
     * included in the output. Otherwise, the mask literal will
     * be copied to the output.
     *
     * @param symbol The symbol to test the value against.
     * @param value The value to test against the symbol.
     * @returns
     */
    test: (symbol: string, value: string) => boolean

}

const BREAKS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
    ['year', 1e3],
];

function getUnitDifference(base: Date, offset: Date): [number, Intl.RelativeTimeFormatUnit] {
    let value;
    const to = Date.parse(offset.toISOString());
    const from = Date.parse(base.toISOString());
    const diff = to - from;
    const absDiff = Math.abs(diff);
    for (let limit = 1000, i = 0; i < BREAKS.length; i++) {
        const [unit, multiplier] = BREAKS[i];
        value = Math.round(diff / limit);
        limit = limit * multiplier;
        if (absDiff < limit)
            return [value, unit];
    }
    return [value, 'year'];
}

/**
 * Creates a new {@link Formatter} instance with the given options.
 *
 * @param options The options to use to create the formatters.
 * @returns An object with various format methods.
 * @example
 * ```js
 * // defaults to English number formatting and USD currency
 * const format = formatters.create();
 * format.toNumber(-12345.67890); // '-12,345.679'
 * format.toCurrency(-12345.67890); // '-$12,345.68'
 * ```
 * @example
 * ```js
 * // specify US region of English
 * const format = formatters.create({ locale: 'en-US' });
 * format.toNumber(-12345.67890); // '-12,345.679'
 * format.toCurrency(-12345.67890); // '-$12,345.68'
 * ```
 * @example
 * ```js
 * // British English number formatting and Pound Sterling currency
 * const format = formatters.create({
 *   locale: 'en-GB',
 *   numberOptions: {
 *     notation: 'scientific',
 *     maximumFractionDigits: 5,
 *   },
 *   currencyOptions: {
 *     currency: 'GBP',
 *     currencySign: 'accounting',
 *   },
 * });
 * format.toNumber(-12345.67890); // '-1.23457E4'
 * format.toCurrency(-12345.67890); // '(£12,345.68)'
 * ```
 */
export function create({
    locale = 'en',
    dateOptions,
    timeOptions,
    listOptions,
    numberOptions,
    currencyOptions,
    relativeOptions,
}: Partial<FormatterOptions> = {}): Formats {

    const dateFormatter = new Intl.DateTimeFormat(locale, dateOptions);
    const numberFormatter = new Intl.NumberFormat(locale, numberOptions);

    const timeFormatter = new Intl.DateTimeFormat(locale, {
        timeStyle: 'short',
        ...timeOptions,
    });

    const relativeFormatter = new Intl.RelativeTimeFormat(locale, {
        numeric: 'auto',
        ...relativeOptions,
    });

    const currencyFormatter = new Intl.NumberFormat(locale, {
        currency: 'USD',
        style: 'currency',
        ...currencyOptions,
    });


    const toDate = dateFormatter.format;

    const toTime = timeFormatter.format;

    const toNumber = numberFormatter.format;

    const toCurrency = currencyFormatter.format;

    const toDigits = utils.withReplacement(String, /\D/g, '');

    const toDateParts = dateFormatter.formatToParts.bind(dateFormatter);

    const toTimeParts = timeFormatter.formatToParts.bind(dateFormatter);

    const toNumberParts = numberFormatter.formatToParts.bind(numberFormatter);

    const toList = (items: string[] = [], conjunction = true) => {
        const listFormatter = new (Intl as any).ListFormat(locale, {
            type: conjunction ? 'conjunction' : 'disjunction',
            ...listOptions,
        });
        return listFormatter.format(items.map(String));
    };

    const toRelativeDateTime = (baseDateTime: Date, offsetDateTime: Date) => {
        return toRelativeDateTimeParts(baseDateTime, offsetDateTime)
            .map(item => item.value)
            .join('');
    };

    const toRelativeDateTimeParts = (baseDateTime: Date, offsetDateTime: Date) => {
        const base = new Date(baseDateTime);
        const offset = new Date(offsetDateTime);
        const [value, unit] = getUnitDifference(base, offset);
        return relativeFormatter.formatToParts(value, unit);
    };

    return {
        toDate,
        toTime,
        toList,
        toDigits,
        toNumber,
        toNumberParts,
        toCurrency,
        toDateParts,
        toTimeParts,
        toRelativeDateTime,
        toRelativeDateTimeParts,
    };

}
