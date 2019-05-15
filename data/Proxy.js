import omit from 'lodash/omit';
import isArray from 'lodash/isArray';
import mergeWith from 'lodash/mergeWith';

const DOUBLE_SLASH = /\/\//g;
const LEADING_SLASHES = /^\/+/;

const merge = (lhs, rhs) => mergeWith(lhs, rhs, arrayConcat);

function arrayConcat(lhs, rhs) {
    if (isArray(lhs)) {
        return lhs.concat(rhs);
    }
}

function patternMatches([key, pattern]) {
    return new RegExp(pattern, 'i').test(this[key]);
}

function ruleMatches(rule) {
    const { match = {} } = rule;
    return Object.entries(match).every(patternMatches, this);
}

function withoutMatchObject(rule) {
    return omit(rule, 'match');
}

/**
 * Represents a single rule in a proxy instance. A Proxy rule looks like a normal Request
 * object with an additional property `match` that specifies the property values on a Request
 * instance that must match in order for the rule to be applied.
 *
 * @global
 * @typedef {Object} ProxyRule
 * @alias ProxyRule
 * @mixes Request
 * @property {string} [protocol] 'http', 'https', 'file', etc.
 * @property {string} [host] 'myapps.paychex.com', 'localhost', etc.
 * @property {number} [port] 80, 8080, etc.
 * @property {Object.<string, string>} match One or more keys in a request object whose values must match
 * the given regular expression patterns. E.g.: `{base: 'payroll'}` or `{base: 'party', path: 'load.+'}`
 */

/**
 * The Proxy provides an intercept layer based on build- and run-time configurations to enable
 * easier local development, impersonation, dynamic endpoints, static data redirects, and user-
 * and environment-specific versioning.
 *
 * @interface Proxy
 */

/**
* Creates a new proxy instance.
*
* @function module:data.createProxy
* @returns {Proxy}
* @example
* import {createProxy} from '@paychex/data'
* import rules from '~/config/proxy'
* export const proxy = createProxy();
* proxy.use(rules);
*/
export function createProxy() {

    const config = [];

    return /** @lends Proxy.prototype */ {

        /**
         * Uses the current proxy rules to construct a URL based on the given arguments.
         *
         * @param {string} base A base value, e.g. 'payroll' or 'party'.
         * @param {(...string|string[])} paths One or more URL paths to combine into the final URL.
         * @returns {string} A URL with the appropriate protocol, host, port, and paths
         * given the currently configured proxy rules.
         * @example
         * import { proxy } from '~/path/to/data';
         * import { tokenize } from '@paychex/core/data';
         *
         * proxy.use({
         *   port: 8118,
         *   protocol: 'https',
         *   host: 'ecs.cloud.paychex.com',
         *   match: {
         *     base: 'paychex-cloud'
         *   }
         * });
         *
         * ```html
         *   <img src="{{ getCloudImage('avatars', 'e13d429a') }}" alt="" />
         *   <!-- https://ecs.cloud.paychex.com:8118/avatars/e13d429a -->
         * ```
         * export function getCloudImage(bucket, id) {
         *   const url = proxy.url('paychex-cloud', '/:bucket', '/:id');
         *   return tokenize(url, { bucket, id });
         * }
         */
        url(base, ...paths) {
            const path = Array.prototype.concat.apply([], paths)
                .join('/')
                .replace(DOUBLE_SLASH, '/')
                .replace(LEADING_SLASHES, '');
            const { protocol = '', host = base, port = 80 } = config
                .filter(ruleMatches, { base, path })
                .reduce(merge, {});
            return `${protocol}${protocol ? ':' : ''}//${protocol === 'file' ? '/' : ''}${host}${port === 80 ? '' : `:${port}`}${path ? `/${path}` : ''}`;
        },

        /**
         * Modifies the input Request object according to any matching Proxy rules.
         * Rules are applied in the order they were added to the Proxy, so later rules will
         * always override earlier rules.
         *
         * **NOTE:** You will not typically call this method directly. Instead, the
         * DataLayer.createRequest method will invoke this function on your behalf. See
         * that method for details.
         *
         * @param {Request} request The request object whose key/value pairs will be used
         * to determine which proxy rules should be used to determine the version.
         * @returns {Request} The input Request object, with properties modified according
         * to the matching Proxy rules.
         * @see {@link DataLayer#createRequest createRequest} &mdash; invokes the apply
         * method for you
         * @example
         * import { rethrow, fatal } from '@paychex/core/errors';
         * import { proxy, createRequest, fetch } from '~/path/to/data';
         * import switches from '../config/features';
         *
         * if (switches.useV2endpoint) {
         *   // switch from Remote to REST endpoint
         *   proxy.use({
         *     path: '/v2/endpoint',
         *     adapter: '@paychex/rest',
         *     match: {
         *       path: '/endpoint',
         *       adapter: '@paychex/remote'
         *     }
         *   });
         * }
         *
         * export function getEndpointData() {
         *   // createRequest modifies the Request
         *   // object generated by the DDO using
         *   // Proxy rules, including the one above
         *   const request = createRequest({
         *     base: 'my-project',
         *     adapter: '@paychex/remote',
         *     operation: 'someOperation',
         *     destination: 'myEndpointClass',
         *     path: '/endpoint',
         *     method: 'POST'
         *   });
         *   const response = fetch(request)
         *     .then(rethrow(fatal()));
         *   return response.data;
         * }
         */
        apply(request) {
            return config
                .filter(ruleMatches, request)
                .map(withoutMatchObject)
                .reduce(merge, request);
        },

        /**
         * Add rules to the proxy instance. The order rules are added determines
         * the order they are applied.
         * @param {(...ProxyRule|ProxyRule[])} rules The rules to use to configure this proxy instance.
         * @example
         * import { proxy } from '~/path/to/data';
         *
         * // any {@link Request Requests} with base == 'paychex-cloud'
         * // will be routed to https://ecs.cloud.paychex.com:8118
         * proxy.use({
         *   port: 8118,
         *   protocol: 'https',
         *   host: 'ecs.cloud.paychex.com',
         *   match: {
         *     base: 'paychex-cloud'
         *   }
         * });
         */
        use(...rules) {
            config.push(...Array.prototype.concat.apply([], rules));
        },

    };

}
