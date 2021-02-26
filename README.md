# @paychex/core

Provides framework-agnostic functionality for use in applications.

## Commands

To install the necessary dependencies:

```bash
npm install
```

To generate documentation files:

```bash
npm run docs
```

To create distributable bundles:

```bash
npm run build
```

## Modules

The @paychex/core library contains functionality separated into various modules:

name | description
:--- | :---
[data]{@link module:data} | Provides methods for creating and configuring a data layer, providing applications the ability to invoke data operations for various endpoints.
[data/utils]{@link module:data/utils} | Functionality used to customize a DataLayer pipeline.
[errors]{@link module:errors} | Provides utility methods for working with Errors.
[events]{@link module:events} | Provides an event bus for publish/subscribe behavior.
[functions]{@link module:functions} | Provides wrappers for functions to extend behavior.
[models]{@link module:models} | Provides utilities for working with collections of structured data.
[models/utils]{@link module:models/utils} | Extends ModelCollection instances with helpful functionality.
[process]{@link module:process} | Provides utilities for running complex, asynchronous processes.
[signals]{@link module:signals} | Provides utilities for synchronizing blocks of code.
[stores]{@link module:stores} | Provides client-side storage. How long data is persisted for depends on the store type and configuration options.
[stores/utils]{@link module:stores/utils} | Utility methods for working with Stores.
[trackers]{@link module:trackers} | Provides event, error, and performance logging for applications.
[trackers/utils]{@link module:trackers/utils} | Provides utility methods for working with Tracker instances or collectors.
[test]{@link module:test} | Provides functionality useful during unit testing.

All code is exported through a top-level namespace you can access in the following ways:

### esm

```js
import * as core from '@paychex/core';
import { events } from '@paychex/core';
```

### commonjs

```js
const core = require('@paychex/core');
const { events } = require('@paychex/core');
```

### amd

```js
define(['@paychex/core'], function(core) {});
define(['@paychex/core'], function({ events }) {});
```

```js
require(['@paychex/core'], function(core) {});
require(['@paychex/core'], function({ events }) {});
```

### iife (web browser)

```js
const core = window['@paychex/core'];
const { events } = window['@paychex/core'];
```

## Contributing

Before creating a new feature for the `@paychex/core` library, please read [CONTRIBUTING.md](https://github.com/paychex/core/blob/master/CONTRIBUTING.md).
