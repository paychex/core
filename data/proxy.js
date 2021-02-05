import cond from 'lodash/cond.js';
import omit from 'lodash/omit.js';
import isEmpty from 'lodash/isEmpty.js';
import isArray from 'lodash/isArray.js';
import isNumber from 'lodash/isNumber.js';
import isObject from 'lodash/isObject.js';
import matches from 'lodash/matches.js';
import constant from 'lodash/constant.js';
import stubTrue from 'lodash/stubTrue.js';
import mergeWith from 'lodash/mergeWith.js';

import { DataProxy } from '../types/data.js';

class Unused extends DataProxy {}

const DOUBLE_SLASH = /\/\//g;
const LEADING_SLASHES = /^\/+/;

const merge = (lhs, rhs) => mergeWith(lhs, rhs, arrayConcat);

function arrayConcat(lhs, rhs) {
    if (isArray(lhs)) {
        return lhs.concat(rhs);
    }
}

/**
 * @ignore
 * @this {ProxyRule}
 */
function patternMatches([key, pattern]) {
    return new RegExp(pattern, 'i').test(this[key]);
}

/**
 * @ignore
 * @this {ProxyRule}
 */
function ruleMatches(rule) {
    const { match = {} } = rule;
    return Object.entries(match).every(patternMatches, this);
}

function withoutMatchObject(rule) {
    return omit(rule, 'match');
}

const equals = rhs => lhs => lhs === rhs;
const suffix = after => value => `${value}${after}`;
const prefix = before => value => `${before}${value}`;

const format = {
    protocol: cond([
        [matches('file'), constant('file:///')],
        [isEmpty, constant('//')],
        [stubTrue, suffix('://')]
    ]),
    port: cond([
        [equals(80), constant('')],
        [isNumber, prefix(':')],
        [stubTrue, constant('')]
    ]),
    path: cond([
        [isEmpty, constant('')],
        [stubTrue, prefix('/')]
    ])
};

/**
* Creates a new proxy instance.
*
* @function module:data.createProxy
* @returns {DataProxy}
* @example
* import {createProxy} from '@paychex/data'
* import rules from '~/config/proxy'
* export const proxy = createProxy();
* proxy.use(rules);
*/
export function createProxy() {

    const config = [];

    return {

        url(...args) {
            const request = isObject(args[0]) ? args[0] : {
                port: 80,
                protocol: '',
                base: args.shift(),
                path: args.join('/')
                    .replace(DOUBLE_SLASH, '/')
                    .replace(LEADING_SLASHES, ''),
            };
            const { protocol = '', host = request.base, port = 80 } = config
                .filter(ruleMatches, request)
                .reduce(merge, request);
            return [
                host ? format.protocol(protocol) : '',
                host,
                format.port(port),
                format.path(request.path)
            ].join('');
        },

        apply(request) {
            return config
                .filter(ruleMatches, request)
                .map(withoutMatchObject)
                .reduce(merge, request);
        },

        use(...rules) {
            config.push(...Array.prototype.concat.apply([], rules));
        },

    };

}
