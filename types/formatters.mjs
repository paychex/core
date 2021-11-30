/**
 * Generic formatter function. Takes a value and returns a string.
 *
 * @global
 * @function Formatter
 * @param {any} value The value to format as a string.
 * @returns {string} A formatted string.
 */
export function Formatter(value) {
    return String(value);
}

/**
 * Creates a new {@link Mask} instance for use with {@link module:formatters/utils.withMask withMask}.
 * A MaskFactory is returned for you by the {@link module:formatters/utils.tokens tokens} method and the
 * properties of the {@link module:formatters/utils.MASKS MASKS} object.
 *
 * @global
 * @function MaskFactory
 * @param {string} pattern The pattern to use with the specified mask.
 * @returns {Mask} The Mask instance for use with {@link module:formatters/utils.withMask withMask}.
 */
export function MaskFactory(pattern) {
    return new Mask();
}

/**
 * Options object passed to {@link module:formatters/create create} when constructing formatters.
 * For number and currency formatting options, see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#parameters MDN}.
 *
 * @class
 * @global
 * @hideconstructor
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#parameters MDN NumberFormat}
 */
export class FormatterOptions {

    /**
     * The {@link https://www.w3.org/International/core/langtags/rfc3066bis BCP 47} language tag.
     *
     * @type {string|string[]}
     * @memberof FormatterOptions#
     * @default 'en'
     */
    locale = 'en'

    /**
     * Options for configuring number presentation. See {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#parameters MDN NumberFormat} for details.
     *
     * @type {object}
     * @memberof FormatterOptions#
     */
    numberOptions = {}

    /**
     * Options for configuring currency presentation. See {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#parameters MDN NumberFormat} for details.
     *
     * The default option is `{ currency: 'USD' }`.
     *
     * @type {object}
     * @memberof FormatterOptions#
     */
    currencyOptions = {}

    /**
     * Options for configuring date presentation. See {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#parameters MDN DateTimeFormat} for details.
     *
     * @type {object}
     * @memberof FormatterOptions#
     */
    dateOptions = {}

    /**
     * Options for configuring time presentation. See {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#parameters MDN DateTimeFormat} for details.
     *
     * @type {object}
     * @memberof FormatterOptions#
     */
    timeOptions = {}

    /**
     * Options for configuring how to show the difference between 2 dates or times.
     * See {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat/RelativeTimeFormat MDN RelativeTimeFormat} for details.
     *
     * @type {object}
     * @memberof FormatterOptions#
     */
    relativeOptions = {}

    /**
     * Options for configuring how to show a list of items.
     * See {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat/ListFormat MDN ListFormat} for details.
     *
     * @type {object}
     * @memberof FormatterOptions#
     */
    listOptions = {}

}

/**
 * Contains formatting methods to convert values to strings.
 *
 * @class
 * @global
 * @hideconstructor
 */
export class Formats {

    /**
     * Converts the given value to a currency string.
     *
     * @function Formats#toCurrency
     * @param {number|string} value The value to convert to currency.
     * @returns {string} The value in currency format.
     * @example
     * const format = formatters.create();
     * format.toCurrency(-123456.7890); // '-$123,456.79'
     */
    toCurrency(value) { return '' }

    /**
     * Strips any non-digit characters from the input,
     * leaving only numbers in the result string.
     *
     * @function Formats#toDigits
     * @param {number|string} value The value to convert to all-digits.
     * @returns {string} The value stripped of any non-digits.
     * @example
     * const format = formatters.create();
     * format.toDigits('a1b2c3'); // '123'
     */
    toDigits(value) { return '' }

    /**
     * Converts the given value to a number with proper formatting.
     *
     * @function Formats#toNumber
     * @param {number} value The value to format as a number.
     * @returns {string} The value in number format.
     * @example
     * const format = formatters.create();
     * format.toNumber(-12345.67890); // '-12,345.679'
     */
    toNumber(value) { return '' }

    /**
     * Converts the given value to a Date string with proper formatting.
     *
     * @function Formats#toDate
     * @param {number|Date} value The value to format as a Date.
     * @returns {string} The value in Date format.
     * @example
     * const format = formatters.create();
     * format.toDate(new Date(2000, 0, 1)); // '1/1/2000'
     */
    toDate(value) { return '' }

    /**
     * Converts the given value to a time with proper formatting.
     *
     * @function Formats#toTime
     * @param {number|Date} value The value to format as a time.
     * @returns {string} The value in time format.
     * @example
     * const format = formatters.create();
     * format.toTime(new Date('1/2/2000 23:45'))); // '11:45 PM'
     */
    toTime(value) { return '' }

    /**
     * Converts the given value to an array of date parts you can use
     * to construct your own date representations.
     *
     * @function Formats#toDateParts
     * @param {number|Date} value The value to parse into date parts.
     * @returns {Intl.DateTimeFormatPart[]} The date parts array.
     * @example
     * const format = formatters.create();
     * format.toDateParts(Date.now())
     *   .map(entry => entry.value)
     *   .join('');
     */
    toDateParts(value) { return [] }

    /**
     * Converts the given value to an array of date parts you can use
     * to construct your own time representation.
     *
     * @function Formats#toTimeParts
     * @param {number|Date} value The value to parse into time parts.
     * @returns {Intl.DateTimeFormatPart[]} The time parts array.
     * @example
     * const format = formatters.create();
     * format.toTimeParts(Date.now())
     *   .map(entry => entry.value)
     *   .join('');
     */
    toTimeParts(value) { return [] }

    /**
     * Represents the difference between 2 dates in human-readable, friendly format.
     *
     * @function Formats#toRelativeDateTime
     * @param {number|string|Date} baseDateTime The base date to use for comparison.
     * @param {number|string|Date} offsetDateTime The date to compare against the base date.
     * @returns {string} A human-readably friendly representation of the difference between the 2 dates.
     * @example
     * const ONE_DAY = 1000 * 60 * 60 * 24;
     * const format = formatters.create();
     * const today = Date.now();
     * const tomorrow = today + ONE_DAY;
     * const dayAfterTomorrow = tomorrow + ONE_DAY;
     * format.toRelativeDateTime(today, tomorrow); // 'tomorrow'
     * format.toRelativeDateTime(today, dayAfterTomorrow); // 'in 2 days'
     */
    toRelativeDateTime(baseDateTime, offsetDateTime) { return '' }

    /**
     * Converts the given value to an array of parts you can use to
     * construct your own friendly representation of the difference
     * between 2 dates.
     *
     * @function Formats#toRelativeDateTimeParts
     * @param {number|string|Date} baseDateTime The base date to use for comparison.
     * @param {number|string|Date} offsetDateTime The date to compare against the base date.
     * @returns {Intl.RelativeTimeFormatPart[]} Time relative time format array.
     * @example
     * const ONE_DAY = 1000 * 60 * 60 * 24;
     * const format = formatters.create();
     * const today = Date.now();
     * const tomorrow = today + ONE_DAY;
     * format.toRelativeDateTimeParts(today, tomorrow)
     *   .map(entry => entry.value)
     *   .join('');
     */
    toRelativeDateTimeParts(baseDateTime, offsetDateTime) { return [] }

    /**
     * Formats a list of items for display to a user.
     *
     * @function Formats#toList
     * @param {any[]} [items=[]] The items to list. Will be converted to Strings before formatting.
     * @param {boolean} [conjunction=true] Whether to consider the items combined (e.g. "and") or separate (e.g. "or").
     * @returns {string} The formatted list.
     * @example
     * const format = formatters.create();
     * const items = ['dog', 'cat', 'mouse'];
     * format.toList(items); // 'dog, cat, and mouse'
     * format.toList(items, false); // 'dog, cat, or mouse'
     */
    toList(items = [], conjunction = true) { return '' }

}

/**
 * @class
 * @global
 * @hideconstructor
 */
export class Mask {

    /**
     * The mask to apply to an input.
     *
     * @type {string}
     * @memberof Mask#
     */
    mask = ''

    /**
     * Creates a new regular expression that matches a single
     * token from the mask to be replaced by the next input character.
     *
     * @function Mask#rxToken
     * @returns {RegExp}
     */
    rxToken = () => new RegExp()

    /**
     * Determines whether the given value from the input matches
     * the specified symbol type. If it does, the input will be
     * included in the output. Otherwise, the mask literal will
     * be copied to the output.
     *
     * @function Mask#test
     * @param {string} symbol The symbol to test the value against.
     * @param {string} value The value to test against the symbol.
     * @returns {boolean}
     */
    test = (symbol, value) => true

}