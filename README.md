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
[data]{@link data} | Provides methods for creating and configuring a data layer, providing applications the ability to invoke data operations for various endpoints.
[errors]{@link errors} | Provides utility methods for working with Errors.
[events]{@link events} | Provides an event bus for publish/subscribe behavior.
[formatters]{@link formatters} | Provides functionality to control text output.
[functions]{@link functions} | Provides wrappers for functions to extend behavior.
[models]{@link models} | Provides utilities for working with collections of structured data.
[process]{@link process} | Provides utilities for running complex, asynchronous processes.
[signals]{@link signals} | Provides utilities for synchronizing blocks of code.
[stores]{@link stores} | Provides client-side storage. How long data is persisted for depends on the store type and configuration options.
[trackers]{@link trackers} | Provides event, error, and performance logging for applications.
[validators]{@link validators} | Provides validation factories to enforce data quality.
[test]{@link test} | Provides functionality useful during unit testing.

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

### unit tests

```js
// esm
import { spy } from '@paychex/core/test';

// commonjs
const { spy } = require('@paychex/core/test');
```

## Contributing

Before creating a new feature for the `@paychex/core` library, please read [CONTRIBUTING.md](https://github.com/paychex/core/blob/master/CONTRIBUTING.md).
