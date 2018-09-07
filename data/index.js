/**
 * Connects Paychex applications to data sources.
 * 
 * @module data
 */

import createProxy from './Proxy';
import createDataLayer from './DataLayer';
import tokenize from './Tokenizer'

export {

    /**
     * Creates a new proxy instance.
     *
     * @function
     * @returns {Proxy}
     * @example
     * import {createProxy} from '@paychex/data'
     * import rules from '~/config/proxy'
     * export const proxy = createProxy();
     * proxy.use(rules);
     */
    createProxy,

    /**
     * Constructs a new DataLayer instance using the specified configuration object.
     * 
     * @function
     * @param {DataLayerConfiguration} config The configuration to use.
     * @returns {DataLayer}
     * @example
     * import {createDataLayer} from '@paychex/core/data'
     * import {proxy, upgrade, reconnect, diagnostics} from '~/config/data'
     * const dataLayer = createDataLayer({
     *   proxy,
     *   upgrade,
     *   reconnect,
     *   diagnostics
     *  });
     */
    createDataLayer,

    /**
     * Replaces tokens in a string with values from the provided lookup,
     * and then appends any unmatched key-value pairs in the lookup as
     * a querystring.
     * 
     * IMPORTANT: Nested objects will not be serialized; if you need to
     * pass complex objects to your endpoint, you should be doing it
     * through the request body; alternatively, use JSON.stringify on
     * the object yourself before passing it to serialize.
     * 
     * IMPORTANT: different falsy values are treated differently when
     * appending to the querystring:
     * 
     *  - {key: false} => 'key=false'
     *  - {key: null} => 'key'
     *  - {key: undefined} => ''
     *
     * @function
     * @param {string} [url=''] A URL that may contain tokens in the `:name` format. Any
     * tokens found in this format will be replaced with corresponding named values in
     * the `params` argument.
     * @param {Object} [params={}] Values to use to replace named tokens in the URL. Any
     * unmatched values will be appended to the URL as a properly encoded querystring.
     * @returns {string} A tokenized string with additional URL-encoded values
     * appened to the querystring.
     * @example
     * const url = tokenize('/clients/:id/apps', {id: '0012391'});
     * assert.equals(url, '/clients/0012391/apps');
     * @example
     * const url = tokenize('/my/endpoint', {offset: 1, pagesize: 20});
     * assert.equals(url, '/my/endpoint?offset=1&pagesize=20');
     * @example
     * const url = tokenize('/users/:guid/clients', {
     *   guid: '00123456789123456789',
     *   order: ['displayName', 'branch']
     * });
     * assert.equals(url, '/users/00123456789123456789/clients?order=displayName&order=branch');
     */
    tokenize
}