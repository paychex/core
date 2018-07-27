import QS from 'query-string';

const rxToken = /:([^\/]+)/g;

const replacer = params => (_, key) => {
    const value = params[key];
    return (delete params[key]) ? value : '';
}

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
 * @exports data/Tokenizer
 * @param {string} [url='']
 * @param {Object} [params={}]
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
export default function tokenize(url = '', params = {}) {
    const out = url.replace(rxToken, replacer(params));
    const sep = out.includes('?') ? '' : '?'
    return out + sep + QS.stringify(params);
}
