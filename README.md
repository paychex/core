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

name | description
:--- | :---
[data]{@link module:data} | Provides methods for creating and configuring a data layer, providing applications the ability to invoke data operations for various endpoints.
[data/utils]{@link module:data/utils} | Provides utility methods for working with data operations.
[errors]{@link module:errors} | Provides utility methods for working with Errors.
[router]{@link module:router} | Ensure URL changes and component navigation are reflected correctly.
[stores]{@link module:stores} | Provides client-side storage. How long data is persisted for depends on the store type and configuration options.
