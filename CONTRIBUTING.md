# Contributing to @paychex/core

Thank you for wanting to contribute to the `@paychex/core` library!

Please read this entire file before pushing any code to the repository.

## Design Philosophy

Code written for a library is different from application code. A library provides a toolbox for other developers. And much like a screwdriver or a hammer, library code is completely unaware of how it will be used. Also like a tool, each exported feature in a library should serve a single well-defined purpose.

To that end, when developing a new feature in `@paychex/core`, always seek to provide the _minimum viable product_ for that feature. **Be ruthless in excluding requirements which are not absolutely necessary for the base functionality.**

For example, each Store instance is solely responsible for coordinating with its persistence mechanism. Functionality such as encryption and key-prefixing (while important and perhaps even required by all Stores) has been separated from the Store implementations. This enables each Store to focus on doing _one_ thing as well as it can.

This also follows standard programming best practices ([DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself), [SRP](https://en.wikipedia.org/wiki/Single_responsibility_principle), and _especially_ [O-C](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle)). In general, restricting your feature to core functionality will actually _improve_ extension later.

If you have written your feature following SRP and O-C principles, you should be able to extend (not modify) your base feature quite easily using the "Proxy" pattern:

```text
A proxy is an object that has the same interface as another object and is used in place of that other object. It provides a surrogate or placeholder for another object to control access to it. It intends to add a wrapper and delegation to protect the real component from undue complexity.
```

Proxy methods in `@paychex/core` can be identified by their name. Each starts with the prefix 'with':

- `withEncryption`
- `withPrefix`
- `withNesting`

In general, the Proxy methods in `@paychex/core` have the following signature:

```text
export function withFeature( delegate:IDelegate [, options:{[string]: any}] ): IDelegate
```

In other words, Proxy methods:

1. name the feature they are adding to the interface
2. accept an implementation of the interface as their first argument
3. (optionally) accept configuration information necessary for the feature
4. return an implementation of the same interface

It's the returned implementation that consumers will access. It's the Proxy's job to determine when and how it should access the delegate's public members. See the code for examples of how various `@paychex/core` proxy methods work with their delegates.

## Commit Messages

Try to follow the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/#summary) standard. See [this wiki page](https://wiki.paychex.com/display/ENTAPPS/Git+Commit+Standards) for more information.

## Unit Tests

This repository contains code that will be used by many developers. Accordingly, you should aim for 100% code coverage of any features you write. Each conditional branch should be tested, edge cases should be considered, and errors should be propagated appropriately.

## Pull Requests

Please ensure you do the following before submitting any code for review:

- Use [Paychex Gitflow standards](https://wiki.paychex.com/display/ENTAPPS/GitFlow+for+SSO) to name your branches correctly.
- Use [conventional commit](https://www.conventionalcommits.org/en/v1.0.0-beta.3/#summary) messages on all commits.
- Reach out to at least one repository maintainer early in development to assist with design decisions.
- Ensure your test coverage is at 100%.

Finally, because your code will be consumed by many other developers, please allow enough time for the maintainers to review your proposed changes thoroughly.