const DOUBLE_SLASH = /\/\//g;
const LEADING_SLASHES = /^\/+/;

/**
 * Represents a single rule in a proxy instance.
 * 
 * @typedef {Object} ProxyRule
 * @alias ProxyRule
 * @property {string} [protocol] 'http', 'https', 'file', etc.
 * @property {string} [host] 'myapps.paychex.com', 'localhost', etc.
 * @property {number} [port] 80, 8080, etc.
 * @property {?string} [version] Used by data adapters to modify the request so it targets a
 * specific version of an endpoint. Different adapters will modify requests in different ways,
 * depending on how the endpoint expects versions to be noted.
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

export default function createProxy() {

    const config = [];

    return /** @lends Proxy.prototype */ {

        /**
         * Uses the current proxy rules to construct a URL based on the given arguments.
         *
         * @param {string} base A base value, e.g. 'payroll' or 'party'.
         * @param {(...string|string[])} paths One or more URL paths to combine into the final URL.
         * @returns {string} A URL with the appropriate protocol, host, port, and paths
         * given the currently configured proxy rules.
         */
        url(base, ...paths) {
            const path = Array.prototype.concat.apply([], paths)
                .join('/')
                .replace(DOUBLE_SLASH, '/')
                .replace(LEADING_SLASHES, '');
            const { protocol = '', host = base, port = 80 } = config
                .filter(({match: {
                    base: targetBase = '',
                    path: targetPath = ''
                } = {}} = {}) =>
                    (!targetBase || new RegExp(targetBase, 'i').test(base))
                    && (!targetPath || new RegExp(targetPath, 'i').test(path)))
                .reduce((out, rule) => Object.assign(out, rule), {});
            return `${protocol}${protocol ? ':' : ''}//${protocol === 'file' ? '/' : ''}${host}${port === 80 ? '' : `:${port}`}${path ? `/${path}` : ''}`;
        },

        /**
         * Returns a version string that will be used by an adapter registered with
         * the data layer to ensure the data operation uses the appropriate version
         * of its target endpoint.
         *
         * @param {Request} request The request object whose key/value pairs will be used
         * to determine which proxy rules should be used to determine the version.
         * @returns {string?} A version string, e.g. 'v2', 'application/json+v1', or
         * 'http://api.paychex.com/my-endpoint/v3'
         */
        version(request) {
            return config
                .filter(({match = {}} = {}) =>
                    Object.entries(match).every(([key, pattern]) =>
                        new RegExp(pattern, 'i').test(request[key])))
                .reduce((v, {version}) => version || v, undefined);
        },

        /**
         * Add rules to the proxy instance. The order rules are added determines
         * the order they are applied.
         * @param {(...ProxyRule|ProxyRule[])} rules The rules to use to configure this proxy instance.
         */
        use(...rules) {
            config.push(...Array.prototype.concat.apply([], rules));
        },

        /**
         * Retrieves the user's authorization token (e.g. JWT or OAuth).
         * @async
         * @param {boolean} [refresh] Whether to generate a new token for the current user.
         * @returns {Promise<string>} The user's authorization token.
         */
        async auth(refresh) {
            throw new Error('not implemented');
        },

        /**
         * Retrieves the user's private encryption key.
         * @async
         * @returns {Promise<string>} The user's private encryption key.
         */
        async key() {
            throw new Error('not implemented');
        }

    };

}