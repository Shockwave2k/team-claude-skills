---
name: zod-schema
description: Use this when defining, reusing, or refactoring Zod schemas in Neolink backend or frontend code. Covers where shared schemas live, naming, input/output separation, strictness, and converting Zod to JSON Schema via `@sinclair/typemap` for Fastify.
---

# Zod schemas (Neolink FE + BE)

Zod is the single source of truth for validation and types across our stack. Backends use it for request/response validation. Frontends use it for form validation and for inferring types from shared schemas.

## Where schemas live

- **Shared across FE and BE** → `libs/shared/<domain>/util/schemas/`. Both apps depend on this lib.
- **Backend-only** (e.g. DB query shapes) → inside the service under `apps/<svc>/src/app/<domain>/schemas.ts`.
- **Frontend-only** (e.g. form-only UI state) → inside the feature lib.

When a schema might get used on both sides, create it shared from day one. Moving it later means touching two import graphs.

## Naming

- Schema: `ThingSchema` (`UserSchema`, `CreateUserInputSchema`).
- Inferred type: `Thing` via `export type Thing = z.infer<typeof ThingSchema>;`.
- Keep the `*Schema` / bare type pairing consistent — readers rely on it.

## Input / output are separate schemas

Do not reuse one schema for both directions.

    // inputs — what the client is allowed to send
    export const CreateUserInputSchema = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(200),
    }).strict();
    export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

    // outputs — what the server returns
    export const UserSchema = z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string(),
      createdAt: z.string().datetime(),
    });
    export type User = z.infer<typeof UserSchema>;

Separating them:
- prevents clients from smuggling server-controlled fields (`id`, `createdAt`);
- lets outputs add fields without breaking input validation;
- makes tRPC `.input()` / `.output()` pairs obvious.

## Strictness

- API **inputs** → `.strict()`. Unknown keys are a client bug; fail loud.
- API **outputs** → default (no `.strict`, no `.passthrough`). Stripping unknowns on the way out silently is fine.
- **DB shapes** → default. Mongoose/mssql add fields we don't always care about.
- `.passthrough()` only with a comment explaining why.

## Zod → JSON Schema for Fastify

Fastify's validator wants JSON Schema. Convert at the route boundary with `@sinclair/typemap` — do not maintain parallel hand-written JSON Schemas.

    import { TypeMap } from '@sinclair/typemap';
    import { CreateUserInputSchema, UserSchema } from '@shared/users/util';

    app.post('/users', {
      schema: {
        body: TypeMap(CreateUserInputSchema),
        response: { 201: TypeMap(UserSchema) },
      },
    }, handler);

For tRPC, pass the Zod schema directly — no conversion needed.

## Reuse via composition

- `.extend({...})`, `.pick({...})`, `.omit({...})`, `.partial()` — use these before duplicating.
- `z.discriminatedUnion('type', [...])` for tagged unions — plays nicer with JSON Schema than `z.union`.

## Don't

- Don't `.parse()` inside route handlers — Fastify's validator already ran. Use the typed request body/params directly.
- Don't hand-write TypeScript types that shadow a Zod schema. Infer, always.
- Don't use `z.any()` or `z.unknown()` on public API boundaries. If the shape is genuinely dynamic, describe it with a discriminated union.
