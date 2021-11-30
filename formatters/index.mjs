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
 * // defaults to English number formatting and USD currency
 * const format = formatters.create();
 * format.toNumber(-12345.67890); // '-12,345.679'
 * format.toCurrency(-12345.67890); // '-$12,345.68'
 * @example
 * // specify US region of English
 * const format = formatters.create({ locale: 'en-US' });
 * format.toNumber(-12345.67890); // '-12,345.679'
 * format.toCurrency(-12345.67890); // '-$12,345.68'
 * @example
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
 */

import * as utils from './utils.mjs';

export { utils };

const BREAKS = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
    ['year', 1e3],
];

function getUnitDifference(base, offset) {
    let value;
    const diff = Date.parse(offset) - Date.parse(base);
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
 * @param {FormatterOptions} options The options to use to create the formatters.
 * @returns {Formats} An object with various format methods.
 * @example
 * // defaults to English number formatting and USD currency
 * const format = formatters.create();
 * format.toNumber(-12345.67890); // '-12,345.679'
 * format.toCurrency(-12345.67890); // '-$12,345.68'
 * @example
 * // specify US region of English
 * const format = formatters.create({ locale: 'en-US' });
 * format.toNumber(-12345.67890); // '-12,345.679'
 * format.toCurrency(-12345.67890); // '-$12,345.68'
 * @example
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
 */
export function create({
    locale = 'en',
    dateOptions = {},
    timeOptions = {},
    numberOptions = {},
    currencyOptions = {},
    relativeOptions = {},
    listOptions = {},
} = {}) {

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

    const toDateParts = dateFormatter.formatToParts;

    const toTimeParts = timeFormatter.formatToParts;

    const toList = (items = [], conjunction = true) => {
        const listFormatter = new Intl.ListFormat(locale, {
            type: conjunction ? 'conjunction' : 'disjunction',
            ...listOptions,
        });
        return listFormatter.format(items.map(String));
    };

    const toRelativeDateTime = (baseDateTime, offsetDateTime) => {
        return toRelativeDateTimeParts(baseDateTime, offsetDateTime)
            .map(item => item.value)
            .join('');
    };

    const toRelativeDateTimeParts = (baseDateTime, offsetDateTime) => {
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
        toCurrency,
        toDateParts,
        toTimeParts,
        toRelativeDateTime,
        toRelativeDateTimeParts,
    };

}
