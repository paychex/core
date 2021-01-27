/**
 * Provides utility methods for working with Tracker instances or collectors.
 *
 * @module tracker/utils
 */

import set from 'lodash/set.js';
import isString from 'lodash/isString.js';
import mapValues from 'lodash/mapValues.js';
import transform from 'lodash/transform.js';
import isObjectLike from 'lodash/isObjectLike.js';
import cloneDeep from 'lodash/cloneDeep.js';

function newInstanceOf(value) {
    return cloneDeep(Object.getPrototypeOf(value));
}

function replace(value, rx) {
    this.string = this.string.replace(rx, value);
}

/**
 * Wraps a collector so the {@link TrackingInfo} instance's key and value
 * strings will be replaced according to the specified map. Used
 * primarily to convert system codes into human-readable values
 * before passing to a collector.
 *
 * @function withReplacement
 * @param {Function} collector The collector function to wrap. Will
 * be invoked with a new TrackingInfo instance whose keys and values
 * will be replaced according to the given map.
 * @param {Map<RegExp, string>} map The
 * mapping of values to replace. For example, `/\ben\b/gi -> 'English'`
 * would change all instances of `'en'` to `'English'`. **NOTE:**
 * Be sure to use `\b` to indicate word boundaries, `^` and `$` to indicate
 * the start and end of a string, `/g` to enable multiple replacements
 * within a string, and `/i` to ignore case.
 * @example
 * const map = new Map([
 *   [/^lang$/, 'language'],
 *   [/\ben\b/i, 'English'],
 *   [/\bes\b/i, 'Spanish'],
 * ]);
 *
 * const collector = withReplacement(console.log, map);
 * export const tracker = createTracker(collector);
 *
 * tracker.event('lang', { avail: ['es', 'en'], selected: 'en' });
 *
 * `{
 *   id: '09850c98-8d0e-4520-a61c-9401c750dec6',
 *   type: 'event',
 *   label: 'language',
 *   start: 1611671260770,
 *   stop: 1611671260770,
 *   duration: 0,
 *   count: 1,
 *   data: {
 *     avail: [ 'Spanish', 'English' ],
 *     selected: 'English'
 *   }
 * }`
 */
export function withReplacement(collector, map) {

    function substitute(value) {
        if (!isString(value))
            return value;
        const context = { string: value };
        map.forEach(replace, context);
        return context.string;
    }

    function transformer(out, value, key) {
        return set(out, substitute(key), convert(value));
    }

    function convert(value) {
        if (isObjectLike(value)) {
            return transform(value, transformer, newInstanceOf(value));
        }
        return substitute(value);
    }

    return function collect(info, ...args) {
        const clone = mapValues(cloneDeep(info), convert);
        return collector(clone, ...args);
    };

}