/**
 * Provides utility methods for working with Tracker instances or collectors.
 *
 * @module tracker/utils
 */

import isString from 'lodash/isString.js';
import mapValues from 'lodash/mapValues.js';
import transform from 'lodash/transform.js';
import isObjectLike from 'lodash/isObjectLike.js';
import cloneDeep from 'lodash/cloneDeep.js';

function toMap(dict, value, key) {
    return dict.set(key, { rx: toRegExp(key), value });
}

function toRegExp(key) {
    return new RegExp(`\\b${key}\\b`, 'g');
}

function newInstanceOf(value) {
    return cloneDeep(Object.getPrototypeOf(value));
}

function replace({ rx, value }) {
    this.string = this.string.replace(rx, value);
}

/**
 * Wraps a collector so the {@link TrackingInfo} instance's key and value
 * strings will be replaced according to the specified map. Used
 * primarily to convert system codes into human-readable values
 * before passing to a collector.
 *
 * @function replacer
 * @param {Function} collector The collector function to wrap. Will
 * be invoked with a new TrackingInfo instance whose keys and values
 * will be replaced according to the given map.
 * @param {object.<string, string> | Map<string, string>} map The
 * mapping of values to replace. For example, `{ 'en': 'English' }`
 * would change all instances of `'en'` to `'English'`. **NOTE:**
 * Word boundaries and casing are respected, so `'en'` would *not*
 * replace `'length'`, `'EN'`, or `'eng'`.
 * @example
 * const map = {
 *   lang: 'language',
 *   en: 'English',
 *   es: 'Spanish',
 * };
 *
 * const collector = replacer(console.log, map);
 * export const tracker = createTracker(collector);
 *
 * tracker.event('set lang', { avail: ['es', 'en'], selected: 'en' });
 *
 * `{
 *   id: '09850c98-8d0e-4520-a61c-9401c750dec6',
 *   type: 'event',
 *   label: 'set language',
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
export function replacer(collector, map) {

    const dict = transform(map, toMap, new Map());

    function substitute(value) {
        if (!isString(value))
            return value;
        const context = { string: value };
        dict.forEach(replace, context);
        return context.string;
    }

    function transformer(out, value, key) {
        const key1 = substitute(key);
        if (isObjectLike(value)) {
            out[key1] = transform(value, transformer, newInstanceOf(value));
        } else
            out[key1] = substitute(value);
        return out;
    }

    function topLevel(value) {
        if (isObjectLike(value)) {
            return transform(value, transformer, newInstanceOf(value));
        }
        return substitute(value);
    }

    return function collect(info, ...args) {
        const clone = mapValues(cloneDeep(info), topLevel);
        return collector(clone, ...args);
    };

}