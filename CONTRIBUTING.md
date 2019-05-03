# Contributor's Guide

Thank you for wanting to contribute to the `@paychex/core` library!

Please read this entire file before pushing any code to the repository.

## Patterns & Principles

Code written for a library is different from application code. A library provides a toolbox for other developers. And much like a screwdriver or a hammer, library code is completely unaware of how it will be used. Also like a tool, each exported feature in a library should serve a single well-defined purpose.

To that end, when developing a new feature in `@paychex/core`, always seek to provide the _minimum viable product_ for that feature. **Be ruthless in excluding requirements which are not absolutely necessary for the base functionality.**

For example, each Store instance is solely responsible for coordinating with its persistence mechanism. Functionality such as encryption and key-prefixing (while important and perhaps even required by all Stores) has been separated from the Store implementations. This enables each Store to focus on doing _one_ thing as well as it can.

This also follows standard programming best practices ([DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself), [SRP](https://en.wikipedia.org/wiki/Single_responsibility_principle), and _especially_ [O-C](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle)). In general, restricting your feature to core functionality will actually _improve_ extension later.

### Extending Functionality: Useful Design Patterns

If you have written your feature following SRP and O-C principles, you should be able to extend (not modify) your base feature quite easily using the following design patterns:

- **Proxy**: wraps an object and returns the same interface
- **Adapter**: wraps an object and returns a different interface
- **Decorator**: wraps an object and _adds_ methods to the interface

To assist consumers, the following naming convention should apply to your extension methods: If you are _narrowing_ or _changing_ the interface, name your method `as<Feature>`; if you are returning the same or _expanded_ interface, name your method `with<Feature>`. In other words, Proxy and Delegate wrappers typically start with `with` while Adapter wrappers start with `as`.

**IMPORTANT:** Wrapper methods must _never_ modify the original, wrapped object. Imagine if `withEncryption()` modified the underlying `indexedDB()` store -- all other consumers of the store would receive encryption even though they didn't ask for it. New code should not change the behavior of existing code.

To summarize, wrapper methods should:

1. appropriately name the feature they are adding to the interface
2. accept an implementation of the interface as their first argument
3. never mutate the delegated implementation
4. (optionally) accept configuration information necessary for the feature

One simple way to ensure delegates are not mutated is to use the [object spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax#Spread_in_object_literals):

```javascript
export function withUppercase(delegate) {
    return {

        // spread ensures the same API is available on
        // our Proxy object as on the inner delegate
        ...delegate,

        // redefining wrappedMethod below means it will
        // be used in place of the delegate's original
        // wrappedMethod that was spread above

        /**
         * uppercases the arg to wrappedMethod
         */
        wrappedMethod(arg) {
            const upper = String(arg).toUpperCase();
            return delegate.wrappedMethod(upper);
        }

    };
}
```

Now that we know how the wrapper methods should work, let's examine each design pattern in detail.

#### Proxy Pattern

> A proxy is an object that has the same interface as another object and is used in place of that other object. It provides a surrogate or placeholder for another object to control access to it. It intends to add a wrapper and delegation to protect the real component from undue complexity.

Proxy methods in `@paychex/core` can be identified by their name. Each starts with the prefix `'with'`:

- `withEncryption`
- `withPrefix`
- `withNesting`

In general, the Proxy methods in `@paychex/core` have the following signature:

```text
export function withFeature( delegate:IDelegate [, options:{[string]: any}] ): IDelegate
```

It's the returned implementation that consumers will access. It's the Proxy's job to determine when and how it should access the delegate's public members. See the code for examples of how various `@paychex/core` proxy methods work with their delegates.

#### Adapter Pattern

> An adapter allows the interface of an existing class to be used as another interface. It is often used to make existing classes work with others without modifying their source code.

Adapter methods in `@paychex/core` can be identified by their name. Each starts with the prefix `'as'`:

- `asResponseCache`

For example, the `asResponseCache` adapter method wraps a `Store` implementation so it satisfies the `Cache` interface, allowing a Store to be used to persist data layer `Response` objects.

In general, the Adapter methods in `@paychex/core` have the following signature:

```text
export function asFeature( delegate:IDelegate [, options:{[string]: any}] ): IOtherInterface
```

#### Decorator Pattern

> A decorator modifies the surface API of a single object, often by adding new functionality.

Decorator methods in `@paychex/core` can be identified by their name. Like Proxies, each decorator wrapper starts with the prefix `'with'`:

- `withOrdering`

For example, the `withOrdering` decorator method wraps a `ModelList` implementation to add an `orderBy` method. This is a decorator because it extends the underlying ModelList interface with new methods, _expanding_ the public API.

In general, the Decorator methods in `@paychex/core` have the following signature:

```text
export function withFeature( delegate:IDelegate [, options:{[string]: any}] ): IDelegate & IOtherInterface
```

### Patterns & Principles Summary

If we apply single-responsibility and open/close principles to our code -- and if we've been ruthless in eliminating non-essential features from a class's core functionality -- then we can easily provide new features through `proxy`, `adapter`, and `decorator` wrapper methods.

## Commit Messages

Try to follow the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/#summary) standard. See [this wiki page](https://wiki.paychex.com/display/ENTAPPS/Git+Commit+Standards) for more information.

## Documentation

Make sure your public methods and types are all documented. Use [jsDocs](http://usejsdoc.org/index.html) and run `npm run docs` to ensure your documentation compiles. Include examples of typical use cases.

## Unit Tests

This repository contains code that will be used by many developers. Accordingly, you should aim for 100% code coverage of any features you write. Each conditional branch should be tested, edge cases should be considered, and errors should be propagated appropriately.

## Pull Requests

Please ensure you do the following before submitting any code for review:

- Use [Paychex Gitflow standards](https://wiki.paychex.com/display/ENTAPPS/GitFlow+for+SSO) to name your branches correctly.
- Use [conventional commit](https://www.conventionalcommits.org/en/v1.0.0-beta.3/#summary) messages on all commits.
- Reach out to at least one repository maintainer early in development to assist with design decisions.
- Ensure your test coverage is at 100%.
- Write documentation for any public methods.

Finally, because your code will be consumed by many other developers, please allow enough time for the maintainers to review your proposed changes thoroughly.