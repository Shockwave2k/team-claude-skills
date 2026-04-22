---
name: fastify-plugin
description: Use this when creating or refactoring a Fastify plugin in a Neolink backend. Covers when to wrap with `fastify-plugin` vs leave encapsulated, typed decorators, dependency ordering, and the `@neolinkrnd/fastify-bundle-*` naming convention for reusable plugins.
---

# Fastify plugins (Neolink backend)

Fastify's plugin system is its encapsulation model. Getting the wrap/no-wrap decision right is the single highest-leverage thing to know.

## When to wrap with `fastify-plugin`

Wrap with `fp(...)` when the plugin needs to **hoist** something to the parent scope:

- Registers a decorator others depend on (`app.decorate('users', …)`).
- Registers a hook that should apply across sibling plugins.
- Adds a schema, error handler, or global middleware.

## When to leave encapsulated (no `fp`)

- Route plugins. Encapsulation is what lets you `register(route, { prefix: '/v1' })` without leaking hooks.
- Feature-local plugins that should not influence siblings.

Rule of thumb: if *other* code would break after you remove the plugin from the tree, it probably needs to stay encapsulated. If removing it breaks the *whole app*, it probably needed `fp`.

## Typed plugin skeleton

    import type { FastifyPluginAsync } from 'fastify';
    import fp from 'fastify-plugin';

    declare module 'fastify' {
      interface FastifyInstance {
        clock: { now: () => Date };
      }
    }

    const clockPlugin: FastifyPluginAsync = async (app) => {
      app.decorate('clock', { now: () => new Date() });
    };

    export default fp(clockPlugin, {
      name: 'clock',
      dependencies: [], // list plugin names this one needs registered first
    });

## Conventions

- Shared internal plugins live under `@neolinkrnd/fastify-bundle-<name>`. If you are promoting code out of an app into a reusable bundle, follow that prefix — it is how our registry finds them.
- Always set `name:` on `fp(...)` so `dependencies: []` on other plugins is checkable.
- Always add a `declare module 'fastify'` augmentation when decorating — untyped decorators break autocomplete for every consumer.
- Autoload resolves files in alphabetical order. If you need ordering, use `dependencies`, not filename tricks.
- No side effects at import time. All work happens inside the exported async function.

## Testing

- Build the plugin into a test Fastify instance with `fastify({ logger: false })`, register the plugin, assert on decorated behaviour.
- Use `light-my-request` (built into Fastify) for route-level tests — no network.
- Jest + `@swc-node/register` is the stack. No `ts-jest` for new suites.
