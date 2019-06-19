# @paychex/core

Provides framework-agnostic functionality for use in applications.

## Commands

To install the necessary dependencies:

```bash
npm run install
```

To generate documentation files:

```bash
npm run docs
```

## Modules

The @paychex/core library contains functionality separated into various modules:

name | description
:--- | :---
[index]{@link module:index} | Contains utilities that do not fall under any of the other module categories.
[data]{@link module:data} | Provides methods for creating and configuring a data layer, providing applications the ability to invoke data operations for various endpoints.
[data/utils]{@link module:data/utils} | Functionality used to customize a DataLayer pipeline.
[errors]{@link module:errors} | Provides utility methods for working with Errors.
[models]{@link module:models} | Provides utilities for working with collections of structured data.
[process]{@link module:process} | Provides utilities for running complex, asynchronous processes.
[signals]{@link module:signals} | Provides utilities for synchronizing blocks of code.
[stores]{@link module:stores} | Provides client-side storage. How long data is persisted for depends on the store type and configuration options.
[stores/utils]{@link module:stores/utils} | Utility methods for working with Stores.
[tracker]{@link module:tracker} | Provides event, error, and performance logging for applications.
[test]{@link module:test} | Provides functionality useful during unit testing.

## Contributing

Before creating a new feature for the `@paychex/core` library, please read [CONTRIBUTING.md](https://code.paychex.com/projects/HTML5/repos/paychex-core/browse/CONTRIBUTING.md?at=refs%2Fheads%2Fdevelop).
