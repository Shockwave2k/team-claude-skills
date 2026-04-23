# Library Scaffold Reference

How to create a new domain library from scratch following Nx conventions.

## Library Directory Structure

Each library follows this layout:

```
packages/<domain>/<type>[-<name>]/
├── src/
│   ├── index.ts                 # Public API barrel
│   └── lib/
│       ├── <component>.ts       # Component / service / util files
│       ├── <component>.spec.ts  # Tests
│       └── <model>.ts           # Types and interfaces
├── project.json                 # Nx project config with tags
├── tsconfig.json                # Extends root tsconfig
├── tsconfig.lib.json            # Build config
└── tsconfig.spec.json           # Test config
```

## project.json

Every library needs a `project.json` with proper scope and type tags:

```json
{
  "name": "<domain>-<type>-<name>",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/<domain>/<type>-<name>/src",
  "projectType": "library",
  "tags": ["scope:<domain>", "type:<type>"],
  "targets": {
    "lint": {
      "executor": "@nx/eslint:lint"
    },
    "test": {
      "executor": "@nx/vite:test",
      "options": {
        "reportsDirectory": "../../coverage/packages/<domain>/<type>-<name>"
      }
    }
  }
}
```

### Tag Reference

**Scope tags** — one per library, matches the business domain:
- `scope:products`
- `scope:orders`
- `scope:checkout`
- `scope:user-management`
- `scope:shared`

**Type tags** — one per library, matches the architectural layer:
- `type:feature` — routable smart components
- `type:ui` — presentational components
- `type:data-access` — services, API clients, state
- `type:util` — pure functions, types, constants

## index.ts (Barrel / Public API)

Only export what consumers should use. Keep internals private.

```typescript
// packages/products/feat-product-list/src/index.ts
export { ProductListComponent } from './lib/product-list.component';

// If the library owns child routes:
export { productRoutes } from './lib/products.routes';
```

```typescript
// packages/products/data-access/src/index.ts
export { ProductService } from './lib/product.service';
export type { Product, ProductFilter } from './lib/product.model';
```

```typescript
// packages/products/ui-product-card/src/index.ts
export { ProductCardComponent } from './lib/product-card.component';
```

Only export what is part of the public API. Internal helpers, private components, and implementation details stay unexported.

## tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```

## tsconfig.lib.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true,
    "declarationMap": true,
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "vitest.config.ts"]
}
```

## tsconfig.spec.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "types": ["vitest/globals"]
  },
  "include": [
    "vitest.config.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "src/**/*.d.ts"
  ]
}
```

## Adding a New Domain — Full Checklist

When the user asks to add a new domain (e.g. "add an orders domain"):

1. Create `packages/orders/data-access/` with service, models, project.json
2. Create `packages/orders/feat-<n>/` for each routable feature
3. Create `packages/orders/ui-<n>/` for any presentational components
4. Add path mappings to `tsconfig.base.json`
5. Add scope rules to `eslint.config.mjs` — decide which other domains `orders` can depend on
6. Add lazy-loaded route entries to `app.routes.ts`
7. Run `nx lint` to verify no boundary violations

## Using Nx Generators

If Nx CLI is available, prefer generators over manual creation:

```bash
# Generate a new library
nx g @nx/angular:library \
  --name=feat-product-list \
  --directory=packages/products/feat-product-list \
  --tags="scope:products,type:feature" \
  --standalone \
  --skipModule

# Generate a component inside a library
nx g @nx/angular:component \
  --name=product-list \
  --project=products-feat-product-list \
  --standalone \
  --changeDetection=OnPush
```

When Nx CLI is not available (e.g. generating code in an artifact), create the files manually following the templates above.
