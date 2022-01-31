/**
 * Provides functionality to create custom formatters.
 *
 * ```js
 * // esm
 * import { formatters } from '@paychex/core';
 * formatters.utils.withReplacement(...);
 *
 * // cjs
 * const { formatters } = require('@paychex/core');
 * formatters.utils.withReplacement(...);
 *
 * // iife
 * const { formatters } = window['@paychex/core'];
 * formatters.utils.withReplacement(...);
 *
 * // amd
 * require(['@paychex/core'], function({ formatters }) { ... });
 * define(['@paychex/core'], function({ formatters }) { ... });
 * ```
 *
 * @module formatters/utils
 * @example
 * ```js
 * const { toDigits } = formatters.create({ locale: 'en-US' });
 * const toSSN = formatters.utils.withReplacement(toDigits, /^\d{5}(\d{4})$/, 'XXX-XX-$1');
 * console.log(toSSN('123.45.6789')); // 'XXX-XX-6789'
 * ```
 * @example
 * ```js
 * const phoneMask = formatters.utils.MASKS.AlphaNumeric('(###) ###-####');
 * const asPhoneNumber = formatters.utils.withMask(String, phoneMask);
 * console.log(asPhoneNumber(1234567890)); // '(123) 456-7890'
 * ```
 */

import {
    find,
    isEmpty,
    conforms,
    isString,
    isFunction,
} from 'lodash';

import { error } from '../errors/index';
import { Formatter, Mask, MaskFactory } from './index';

export type MaskPredicate = (pattern: string) => boolean;
export type TokenArray = [string, MaskPredicate];
export type StringReplacer = (substring: string, ...args: any[]) => string;

const rxEscape = /\\/g;
const rxNumber = /\d/;
const rxLetter = /[a-z]/i;

function matches(i: TokenArray): boolean {
    return i[0] === this;
}

const reducer = (out: string, [key]: TokenArray) => out + key;

const isTokenArray = conforms({
    0: isString,
    1: isFunction,
});

function getTokenIndex(rx: RegExp, pattern: string): number {
    rx.exec(pattern);
    let index = rx.lastIndex - 1;
    // skip escaped tokens (treat as literals)
    while (index > -1 && pattern[index - 1] === '\\') {
        rx.exec(pattern);
        index = rx.lastIndex - 1;
    }
    return index;
}

function isValidTokenArray(array: TokenArray[]) {
    return Array.isArray(array) && !isEmpty(array) && array.every(isTokenArray);
}

/**
 * Replaces the output of the inner formatter according to the given rules.
 *
 * You can use a regular expression or string as your search criteria, and
 * you can use a string or function to perform the replacement. See the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace MDN docs} for details.
 *
 * @param formatter The format function whose output should be replaced.
 * @param pattern The string or regular expression to match against the output.
 * @param replacer The replacement logic. Either a string or function.
 * @returns A format function that will perform the requested replacement.
 * @example
 * ```js
 * const { toDigits } = formatters.create({ locale: 'en-US' });
 * const toSSN = formatters.utils.withReplacement(toDigits, /^\d{5}(\d{4})$/, 'XXX-XX-$1');
 * console.log(toSSN('123.45.6789')); // 'XXX-XX-6789'
 * ```
 * @example
 * ```js
 * const maskChars = formatters.utils.withReplacement(String, /[a-z]/, '*');
 * console.log(maskChars('abc123xyz')); // '***123***'
 * ```
 * @example
 * ```js
 * const onlyNumbers = formatters.utils.withReplacement(String, /[^\d]/g, () => '');
 * console.log(onlyNumbers('abc123xyz')); // '123'
 * ```
 */
export function withReplacement(formatter: Formatter, pattern: RegExp | string, replacer: string | StringReplacer): Formatter {
    return function useReplacement(input) {
        return formatter(input).replace(pattern, replacer as any);
    };
}

/**
 * Constructs a new {@link MaskFactory} for use with {@link withMask}.
 *
 * @param array Each element should be an array of 2 items: the token
 * string, and the predicate to run with the input character to see if
 * it matches the token type.
 * @returns A MaskFactory that can be invoked with a pattern
 * to return a {@link Mask} instance.
 * @throws Must pass array of arrays to tokens method.
 * @example
 * ```js
 * const factory = formatters.utils.tokens([
 *   ['*', (v) => /./.test(v)], // have * match anything
 *   ['0', (v) => /\d/.test(v)], // have 0 match any digit
 *   ['.', (v) => /[a-z]/i.test(v)], // have period match any letter
 * ]);
 * const mask = factory('#000-**-....');
 * const format = formatters.utils.withMask(String, mask);
 * console.log(format('1234abcdefg')); // '#123-4a-bcde'
 * ```
 */
export function tokens(array: TokenArray[]): MaskFactory {
    if (!isValidTokenArray(array))
        throw error('Must pass array of arrays to tokens method.');
    const symbols = array.reduce(reducer, '');
    const rxToken = () => new RegExp(`[${symbols}]`, 'g');
    const test = (symbol: string, value: any) => {
        const entry: TokenArray = find(array, matches.bind(symbol));
        return !!(entry && entry[1](value));
    };
    return function createMask(mask: string): Mask {
        return {
            mask,
            test,
            rxToken,
        };
    };
}

/**
 * Contains useful predefined mask factories you can use to
 * create your own simple formatters.
 */
export interface MaskCollection extends Readonly<Record<string, MaskFactory>> {

    /**
     * Factory to create a mask where `#` is treated as any digit (0-9)
     * and `X` represents any alphabetic character (a-z).
     *
     * @example
     * ```js
     * const phoneMask = formatters.utils.MASKS.AlphaNumeric('(###) ###-####');
     * const asPhoneNumber = formatters.utils.withMask(String, phoneMask);
     * console.log(asPhoneNumber(1234567890)); // '(123) 456-7890'
     * ```
     */
    AlphaNumeric: MaskFactory

}

/**
 * Contains useful predefined mask factories you can use to
 * create your own simple formatters.
 *
 * @readonly
 */
export const MASKS: MaskCollection = Object.freeze({

    AlphaNumeric: tokens([
        ['#', (v: string) => rxNumber.test(v)],
        ['X', (v: string) => rxLetter.test(v)],
    ]),

});

/**
 * Creates a {@link Formatter} that will apply the specified mask logic to the returned string.
 *
 * @param formatter The formatter to wrap.
 * @param mask The Mask instance to use. A Mask factory can be constructed using {@link tokens},
 * or you can use an existing Mask factory available on the {@link MASKS} property.
 * @returns A Formatter instance which will apply the specified mask.
 * @example
 * ```js
 * const phoneMask = formatters.utils.MASKS.AlphaNumeric('(###) ###-####');
 * const asPhoneNumber = formatters.utils.withMask(String, phoneMask);
 * console.log(asPhoneNumber(1234567890)); // '(123) 456-7890'
 * ```
 * @example
 * ```js
 * const factory = formatters.utils.tokens([
 *     ['0', (v) => /\d/.test(v)], // use 0 to represent a single number
 * ]);
 * const mask = factory('00-000');
 * const toPartCode = formatters.utils.withMask(String, mask);
 * console.log(toPartCode('90.7.00')); // '90-700'
 * ```
 * @example
 * ```js
 * // you can use \\ to identify a string literal. these will not
 * // be treated as mask tokens but instead be returned in the output
 * // string as-is
 * const extension = formatters.utils.MASKS.AlphaNumeric('\\x####');
 * const toExtension = formatters.utils.withMask(String, extension);
 * console.log(toExtension(1234)); // 'x1234'
 * ```
 */
export function withMask(formatter: Formatter, { rxToken, mask, test }: Mask): Formatter {
    let rx: RegExp;
    return withReplacement(formatter, /./g, function applyMask(match, index) {
        if (index === 0)
            rx = rxToken(); // reset for new string
        const startIndex = rx.lastIndex;
        if (index > 0 && startIndex === 0)
            return ''; // we've looped around; ignore subsequent input
        const tokenIndex = getTokenIndex(rx, mask);
        const onlyLiteralsLeft = tokenIndex < 0;
        const literals = onlyLiteralsLeft
            ? mask.slice(startIndex).replace(rxEscape, '')
            : mask.slice(startIndex, tokenIndex).replace(rxEscape, '');
        const symbol = mask[tokenIndex];
        const suffix = onlyLiteralsLeft ? '' : match;
        return test(symbol, match)
            ? literals + suffix
            : literals;
    });
}