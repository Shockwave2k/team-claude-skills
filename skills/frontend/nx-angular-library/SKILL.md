---
name: nx-angular-library
description: Use this when generating or organizing Angular libraries in a Neolink NX monorepo. Covers the four library types (feature/ui/data-access/util), scope tags, import boundaries enforced by `@nx/eslint-plugin`, and where shared tRPC types live.
---

# NX Angular libraries (Neolink frontend)

NX libraries are the main organisational unit. We classify every lib by **type** and **scope** and enforce the boundaries via `@nx/enforce-module-boundaries`.

## Library types

| Type | Contains | May depend on |
|------|----------|---------------|
| `feature` | Smart components wired to state, route entry points | `ui`, `data-access`, `util` |
| `ui` | Dumb presentational components, no DI beyond Angular primitives | `util` |
| `data-access` | Stores, services, tRPC client, HTTP, socket.io | `util` |
| `util` | Pure helpers, constants, Zod schemas, types | — |

A `feature` lib renders pages. A `ui` lib renders pixels. A `data-access` lib talks to the outside world. A `util` lib is functions.

## Scope tags

Scope = business domain (e.g. `portal`, `logistics`, `shared`). Every lib gets two tags:

- `type:<feature|ui|data-access|util>`
- `scope:<domain>`

Dependency rule: a lib may only import from `scope:<same>` or `scope:shared`.

## Generating a library

    nx g @nx/angular:library \
      --directory=libs/portal/users/feature-list \
      --name=portal-users-feature-list \
      --tags=type:feature,scope:portal \
      --standalone \
      --changeDetection=OnPush \
      --style=scss

Naming: `libs/<scope>/<domain>/<type>-<slug>`. The `<type>-` prefix in the folder name is load-bearing — it makes boundary violations obvious on sight.

## Index exports

`index.ts` is the public surface. Export **only** what consumers need:

    export { UserListComponent } from './lib/user-list/user-list.component';
    export { provideUsersFeature } from './lib/users.providers';

Do not barrel-export internals just in case. Unused exports block tree-shaking and invite cross-layer imports.

## Where tRPC types live

- The shared `AppRouter` *type* export from the backend is pulled in by `libs/shared/api/data-access` (type-only import).
- The runtime tRPC client is built there and exposed via a provider.
- Feature libs inject the client from `data-access`; they never construct it.

## Boundary violations

`@nx/enforce-module-boundaries` catches these at lint time. When it fires, the fix is almost never `eslint-disable` — it's usually one of:

- Wrong type assignment (a `ui` lib reaching into `data-access` → promote to `feature`, or move the data call up).
- Missing scope tag (lib was generated without `--tags`).
- Circular dep between features (extract shared code to a `util` or `data-access` lib under `scope:shared`).

## Don't

- Don't create libraries without tags.
- Don't put services in `ui` libs.
- Don't put components in `util` libs.
- Don't re-export from `index.ts` just to shorten an import path — the boundary rules care about paths.
