## @paychex/core

Provides framework-agnostic functionality for use in all Paychex FLEX applications.

### Commands

To install the necessary dependencies:
```bash
$ npm run install
```

To generate documentation files:
```bash
$ npm run docs
```

### Modules

The @paychex/core library contains functionality separated into various modules:

 - data  
 Provides methods for creating and configuring a data layer, providing applications the ability to
 invoke data operations for various endpoints.
 - data/utils  
 Provides utility methods for working with data operations.
 - stores  
 Provides client-side storage. How long data is persisted for depends on the store type and configuration options.

### Data Module

Enables data operations between client code and various backends through registered adapters.

Initializing the @paychex/core data pipeline requires 3 steps:

1. create a new Proxy instance
2. configure the Proxy rules
3. create a new DataLayer instance
4. register adapters

__NOTE:__ These steps will typically have already been done for you.

```javascript
// data.js

import {createProxy, createDataLayer} from '@paychex/core/data'
import proxyRules from '~/config/proxy'
import {PaychexRestAdapter} from '~/data/adapters'

export const proxy = createProxy();
proxy.use(proxyRules);

export const dataLayer = createDataLayer({
    proxy,
    ... // see documentation
});
dataLayer.setAdapter('@paychex/rest', PaychexRestAdapter);
```

#### Data Definition Objects

Every single data operation is represented by a unique Data Definition Object (DDO) that provides the details necessary for the data layer's adapters to invoke the data call.

Here are all the properties you can specify on a DDO:

Property | Type | Required | Default | Description
--- | --- | --- | --- | ---
adapter | string | yes | | The adapter to use to complete the request.
base | string | yes | | Used by the Proxy to determine a base path.
path | string | yes | | Combined with the base path to construct a full URL.
method | string | no | GET | The HTTP verb to use.
withCredentials | boolean | no | false | Whether to send Cookies with the request.
compression | boolean | no | false | Whether to gzip the request payload. The server will need to decompress the payload.
timeout | number | no | | The number of milliseconds to wait before aborting the data call.
headers | object | no | `{accept: 'application/json'}` | The HTTP headers to use on the request.
ignore | object | no | | Can be used to skip certain adapter behaviors. See your adapter's documentation for details.
retry | function | no | | Determines whether a failed request should be retried.
cache | Cache | no | | Controls caching logic for requests.
transformRequest | function | no | | Transforms the payload and/or headers sent with a request.
transformResponse | function | no | | Transforms the response payload before sending it back to callers.

__NOTE:__ Certain adapters may require additional properties on your DDO. For example, an adapter to handle Paychex remote calls may require an `operation` property.

#### Invoking a Data Operation

Here is how you might invoke a complex data operation that includes encryption, caching, automatic retry, and data transformations. For more information on any of these methods, view this package's documentation.

```javascript
import { normalize } from 'normalizr';
import { call, put } from 'redux-saga/effects';
import { withFalloff } from '@paychex/core/data/utils';
import { createRequest, fetch } from '@paychex/landing/data';
import { indexedDB, withEncryption } from '@paychex/core/stores';
import { ifRequestMethod, ifResponseStatus } from '@paychex/core/data/utils';
 
import { User } from '~/data/schemas';
import { setLoading, cue } from '~/data/actions';

const userInfoCache = ((key, hash) => {
 
    const store = indexedDB({store: 'userInfo'});
    const encrypted = withEncryption(store, {key});
     
    return {
 
        get: ifRequestMethod('GET', async function get(request, proxy) {
            return await encrypted.get(hash);
        }),
 
        set: ifResponseStatus(200, async function set(request, response, proxy) {
            return await encrypted.set(hash, response);
        })
 
    };
 
})(window.userKey, window.userHash);

const setUserInfo = (user) => ({
    type: 'set-user-info',
    payload: user
});

const loadUserInfo = {
    method: 'GET',
    base: 'landing',
    path: '/users/:guid',
    adapter: '@paychex/rest',
    retry: withFalloff(3, 500),
    cache: userInfoCache,
    transformResponse(data) {
        return normalize(User, data);
    }
};

export function* getUserInfo(guid) {
    const request = createRequest(loadUserInfo, {guid});
    try {
        yield put(setLoading(true));
        const user = yield call(fetch, request);
        yield put(setUserInfo(user));
    } catch (e) {
        yield put(cue(e));
    } finally {
        yield put(setLoading(false));
    }
}
```