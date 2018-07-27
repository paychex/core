## @paychex/core

Provides framework-agnostic functionality for use in all Paychex FLEX applications.

### Data Pipeline

Enables data operations between client code and various backends through registered adapters.

Initializing the @paychex/core data pipeline requires 3 steps:

1. create and configure a new Proxy instance
2. create a new DataLayer instance
3. configuring the Proxy rules

```javascript
// data.js

import {createProxy, createDataLayer} from '@paychex/core/data'
import proxyRules from '~/config/proxy'

const proxy = createProxy();
proxy.use(proxyRules);

export default createDataLayer({
    proxy,
    ... // other stuff, see documentation
});

export const myDDO = {
    ... // see documentation
};
```

Once the pipeline and proxy are configured, consumers can use the `createRequest` and `fetch` methods created above to make data calls:

```javascript
import DataLayer, {myDDO} from '~/data'

async function makeDataCall(arg1, arg2) {
    const { createRequest, fetch } = DataLayer;
    const request = createRequest(myDDO, {param: arg1}, arg2);
    try {
        const data = await fetch(request);
        // handle response
    } catch (e) {
        // handle errors
    }
}
```