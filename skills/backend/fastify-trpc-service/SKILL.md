---
name: fastify-trpc-service
description: Use this when adding or modifying a Fastify route, plugin, or tRPC router/procedure in a Neolink NX backend. Covers autoload layout, the `@neolinkrnd/fastify-bundle-*` house bundles, Zod with `@sinclair/typemap` for route schemas, and how Fastify HTTP routes and tRPC coexist.
---

# Fastify + tRPC service (Neolink backend)

## Stack

- NX monorepo (v22+) with `@nx/node` + `@nx/esbuild`.
- Fastify 5 with `@fastify/autoload`, `@fastify/sensible`, `fastify-plugin`.
- tRPC v11 (`@trpc/server`, `@trpc/client`).
- Zod for validation. `@sinclair/typemap` converts Zod → JSON Schema for Fastify's built-in validator.
- House bundles (always prefer these over hand-rolled equivalents):
  - `@neolinkrnd/fastify-bundle-default-controller` — controller skeleton.
  - `@neolinkrnd/fastify-bundle-error-handler` — error normalisation.
  - `@neolinkrnd/fastify-bundle-schema-builder` — request/response schema helpers.
  - `@neolinkrnd/fastify-bundle-status-code` — typed status-code helpers.
- Data layer: Mongoose (MongoDB) and `mssql` (SQL Server). Secrets via `node-vault`.
- Tests: Jest + `@swc-node/register`.

## When to use

- Adding a new HTTP route, plugin, or tRPC procedure to a backend app.
- Moving shared code into a Fastify plugin.
- Defining request/response schemas for a new endpoint.

## File layout (NX node app)

    apps/<service>/src/
      main.ts                 # bootstrap: build app, register autoload roots
      app/
        app.ts                # exported `app` plugin (autoload root)
        plugins/              # cross-cutting plugins (auth, db, cors, trpc)
        routes/               # Fastify HTTP routes, autoloaded
        trpc/
          context.ts          # createContext()
          router.ts           # AppRouter (exported for the FE client)
          routers/<domain>.ts # per-domain sub-routers

## Choosing HTTP route vs tRPC procedure

- **tRPC** for anything consumed by our Angular frontend — end-to-end types are the whole point.
- **HTTP route** for webhooks, health probes, file up/download, third-party callbacks, and anything consumed by non-TS clients.

## Fastify HTTP route pattern

Use `@sinclair/typemap` so Zod is the single source of truth:

    import type { FastifyPluginAsync } from 'fastify';
    import { z } from 'zod';
    import { TypeMap } from '@sinclair/typemap';

    const ParamsSchema = z.object({ id: z.string().uuid() });
    const ResponseSchema = z.object({ id: z.string(), name: z.string() });

    const route: FastifyPluginAsync = async (app) => {
      app.get('/users/:id', {
        schema: {
          params: TypeMap(ParamsSchema),
          response: { 200: TypeMap(ResponseSchema) },
        },
      }, async (req) => {
        const { id } = req.params as z.infer<typeof ParamsSchema>;
        return app.users.findById(id); // decorator from a plugin
      });
    };

    export default route;

Rules:
- Never build JSON Schema by hand — always go through `TypeMap(zodSchema)`.
- Use `@neolinkrnd/fastify-bundle-schema-builder` helpers when composing repeated schema shapes.
- Throw via `@neolinkrnd/fastify-bundle-status-code` (e.g. `throw notFound('user', id)`), never `reply.status(404).send(...)`.

## tRPC procedure pattern

    import { z } from 'zod';
    import { router, publicProcedure } from '../trpc';

    export const userRouter = router({
      byId: publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.object({ id: z.string(), name: z.string() }))
        .query(({ input, ctx }) => ctx.users.findById(input.id)),
    });

Mount it once in the root router and register the tRPC Fastify adapter as a plugin. The frontend imports `AppRouter` as a **type only** — never pull runtime code across the FE/BE boundary.

## Error handling

Register `@neolinkrnd/fastify-bundle-error-handler` once at the top of `app.ts`. Throw domain errors; the bundle maps them to consistent response shapes. Do not `try/catch` just to `reply.send` — let the bundle see the error.

## Conventions

- Files and route paths: `kebab-case`.
- One plugin per concern; `fastify-plugin` wrap only when the plugin must hoist decorators/hooks (see the `fastify-plugin` skill).
- No top-level `await` in route files — use plugin lifecycle hooks.
- Import `AppRouter` type in the frontend with `import type { AppRouter } from '...'` to keep the bundle tree-shaken.
