/**
 * Enables data operations between client code and various backends through registered adapters.
 *
 * Initializing the @paychex/core data pipeline requires 3 steps:
 *
 * 1. create a new Proxy instance
 * 2. configure the Proxy rules
 * 3. create a new DataLayer instance
 * 4. register adapters
 *
 * __NOTE:__ These steps will typically have already been done for you.
 *
 * ```javascript
 * // data.js
 *
 * import {createProxy, createDataLayer} from '@paychex/core/data'
 * import proxyRules from '~/config/proxy'
 * import {PaychexRestAdapter} from '~/data/adapters'
 *
 * export const proxy = createProxy();
 * proxy.use(proxyRules);
 *
 * export const dataLayer = createDataLayer({
 *     proxy,
 *     ... // see documentation
 * });
 * dataLayer.setAdapter('@paychex/rest', PaychexRestAdapter);
 * ```
 *
 * #### Invoking a Data Operation
 *
 * Here is how you might invoke a complex data operation that includes encryption, caching, automatic retry, and data transformations. For more information on any of these methods, view this package's documentation.
 *
 * ```javascript
 * import { normalize } from 'normalizr';
 * import { call, put } from 'redux-saga/effects';
 * import { withFalloff } from '@paychex/core/data/utils';
 * import { createRequest, fetch } from '@paychex/landing/data';
 * import { indexedDB, withEncryption, asResponseCache } from '@paychex/core/stores';
 *
 * import { User } from '~/data/schemas';
 * import { setLoading, cue } from '~/data/actions';
 *
 * const userInfoCache = ((key, iv) => {
 *     const store = indexedDB({store: 'userInfo'});
 *     const encrypted = withEncryption(store, {key, iv});
 *     return asResponseCache(encrypted);
 * })(window.userKey, window.userGuid);
 *
 * const setUserInfo = (user) => ({
 *     type: 'set-user-info',
 *     payload: user
 * });
 *
 * const loadUserInfo = {
 *     method: 'GET',
 *     base: 'landing',
 *     path: '/users/:guid',
 *     adapter: '@paychex/rest',
 *     retry: withFalloff(3, 500),
 *     cache: userInfoCache,
 *     transformResponse(data) {
 *         return normalize(User, data);
 *     }
 * };
 *
 * export function* getUserInfo(guid) {
 *     const request = createRequest(loadUserInfo, {guid});
 *     try {
 *         yield put(setLoading(true));
 *         const user = yield call(fetch, request);
 *         yield put(setUserInfo(user));
 *     } catch (e) {
 *         yield put(cue(e));
 *     } finally {
 *         yield put(setLoading(false));
 *     }
 * }
 * ```
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
     * import {proxy, reauth, reconnect, diagnostics} from '~/config/data'
     * const dataLayer = createDataLayer({
     *   proxy,
     *   reauth,
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