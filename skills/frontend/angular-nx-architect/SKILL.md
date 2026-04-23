---
name: angular-nx-architect
description: >
  Scaffold and organize Angular 21 projects in an Nx monorepo using an app-first approach:
  data-access, feat-*, ui-*, and util folders live inside each app, not in shared libs.
  Use this skill whenever the user asks to create, scaffold, refactor, or structure an Angular
  application or workspace with Nx. Trigger when the user mentions Angular project architecture,
  folder structure, feature organization, component placement, domain organization, Nx library
  or lib organization, module boundaries, or wants to generate Angular 21 components, features,
  or layouts following Nx-style conventions. Also trigger for phrases like "set up my Angular app",
  "how should I organize this feature", "where should I put this component", "refactor my layout
  folder", "add a new page", or "scaffold a feature inside my app". If the conversation involves
  Angular 21 project structure decisions — even casually — this skill applies.
---

# Angular 21 + Nx Architecture Skill

## Philosophy: App-First Organization

Each app in this monorepo is largely independent. Domain logic, layouts, and features stay
**inside the app that owns them**. The `libs/` folder is reserved for utilities that are
genuinely needed by two or more apps — and you only create a lib when the user explicitly asks
for one.

This keeps `nx affected` builds scoped correctly: a change to `portal-example`'s navigation
only rebuilds `portal-example`, not `portal-neolink` or `portal-hive`.

The Nx type conventions (`data-access`, `feat-*`, `ui-*`, `util`) still apply — but as folder
conventions *within* each app, not as separate library projects.

## Angular 21 Defaults

All generated code uses Angular 21's modern defaults:

- **Signals** for reactive state (`signal()`, `computed()`, `effect()`, `input()`, `output()`, `model()`)
- **Zoneless change detection** (`provideZonelessChangeDetection()`)
- **Standalone components** everywhere (no NgModules)
- **`inject()` function** instead of constructor injection
- **`@if` / `@for` / `@switch`** control flow (not `*ngIf` / `*ngFor`)
- **`ChangeDetectionStrategy.OnPush`** on every component
- **Vitest** as the test runner
- **`@angular/build`** with esbuild/Vite
- **Functional guards, resolvers, and interceptors**

Do NOT generate zone.js imports, NgModules, constructor-based DI, or structural directives.

## In-App Organization (The Core Pattern)

Every meaningful folder inside `src/app/` follows the same four-type structure:

| Folder         | Purpose                                                       |
|----------------|---------------------------------------------------------------|
| `data-access/` | Services, state signals, API calls, models for this feature   |
| `feat-*/`      | Smart/container components — wired to routes or parent state  |
| `ui-*/`        | Presentational components — no DI, driven by `input()`        |
| `util/`        | Pure functions, constants, type definitions                   |

This applies at every level — the `layout/` folder, each page folder, and any feature sub-folder.
You don't need all four in every folder; only create what's actually needed.

### Example: a fully organized portal-example

```
apps/portal-example/src/app/
├── layout/
│   ├── data-access/                  # Layout state (sidebar open, breakpoint signals)
│   │   └── layout-state.service.ts
│   ├── feat-shell/                   # Root layout shell (mat-sidenav wrapper)
│   │   ├── shell.component.ts
│   │   └── shell.component.html
│   ├── feat-navigation/              # Top navigation bar
│   │   ├── navigation.component.ts
│   │   └── navigation.data.ts
│   ├── feat-sidebar/                 # Side navigation
│   │   └── sidebar.component.ts
│   └── ui-nav-item/                  # Presentational nav item
│       └── nav-item.component.ts
├── pages/
│   ├── home/
│   │   ├── data-access/              # Home-specific data fetching/state
│   │   ├── feat-home/                # Home page smart component
│   │   │   └── home.component.ts
│   │   └── ui-*/                     # Presentational pieces for home
│   └── settings/
│       ├── data-access/
│       ├── feat-settings/
│       └── ui-*/
├── app.ts
├── app.config.ts
└── app.routes.ts
```

### Rules for placement

- **`feat-*`** components are allowed to inject services and react to route params.
- **`ui-*`** components must be fully driven by `input()` — no `inject()` for app services.
- **`data-access/`** holds services and signal-based state. Keep it co-located with the feature
  that owns it. If multiple sibling features share the same state, move `data-access/` one level up.
- **`util/`** is for pure, framework-free helpers — no Angular imports.

## Workspace Structure

```
my-workspace/
├── apps/
│   ├── portal-example/               # Self-contained app
│   ├── portal-neolink/               # Self-contained app
│   └── portal-hive/                  # Self-contained app
└── libs/
    └── shared/
        ├── util-theming/             # Created once, used by all apps
        ├── util-media/
        └── util-local-storage/
```

`libs/` only grows when the user asks to create a shared lib. The rule of thumb: if code lives in
one app, it stays in that app. If a second app needs the same thing, that's the moment to extract
it into `libs/` — but only when the user decides.

## When to Create a Lib

Only create a lib when:
1. The user explicitly asks for one, **or**
2. Two or more apps need the exact same code and the user agrees to extract it.

Never proactively move app-internal code into `libs/` during a refactor. That decision belongs to the user.

## Lib Naming Conventions

When libs are created, follow the same type prefix pattern:

| Prefix          | Purpose                                   | Example                          |
|-----------------|-------------------------------------------|----------------------------------|
| `util-*`        | Pure helpers, services, types             | `libs/shared/util-theming`       |
| `ui-*`          | Shared presentational components          | `libs/shared/ui-button`          |
| `data-access-*` | Shared services or state                  | `libs/shared/data-access-auth`   |
| `feat-*`        | Shared feature components (rare)          | `libs/shared/feat-login`         |

Each lib exposes its public API through `src/index.ts`.

## TypeScript Path Mappings

Add path aliases in `tsconfig.base.json` only for libs. Use relative imports inside an app:

```json
{
  "compilerOptions": {
    "paths": {
      "@my-workspace/shared-util-theming": ["libs/shared/util-theming/src/index.ts"],
      "@my-workspace/shared-util-media":   ["libs/shared/util-media/src/index.ts"]
    }
  }
}
```

Inside an app, import relatively:

```typescript
// Good — relative import within the same app
import { LayoutStateService } from '../data-access/layout-state.service';

// Good — lib import via path alias
import { Theming } from '@my-workspace/shared-util-theming';
```

## Module Boundary Tags

### App projects

Tag each app in its `project.json` with its own scope:

```json
{ "tags": ["scope:portal-example"] }
```

### Lib projects

Tag each lib with scope and type:

```json
{ "tags": ["scope:shared", "type:util"] }
```

### ESLint boundary rules

Configure `@nx/enforce-module-boundaries` so apps don't import from each other,
and libs only depend on libs of equal or lower layer:

```js
rules: {
  '@nx/enforce-module-boundaries': ['error', {
    depConstraints: [
      // Apps are fully isolated from each other
      { sourceTag: 'scope:portal-example', onlyDependOnLibsWithTags: ['scope:shared', 'scope:portal-example'] },
      { sourceTag: 'scope:portal-neolink',  onlyDependOnLibsWithTags: ['scope:shared', 'scope:portal-neolink'] },
      { sourceTag: 'scope:portal-hive',     onlyDependOnLibsWithTags: ['scope:shared', 'scope:portal-hive'] },

      // Shared lib type hierarchy
      { sourceTag: 'type:util',        onlyDependOnLibsWithTags: ['type:util'] },
      { sourceTag: 'type:ui',          onlyDependOnLibsWithTags: ['type:ui', 'type:util'] },
      { sourceTag: 'type:data-access', onlyDependOnLibsWithTags: ['type:data-access', 'type:util'] },
      { sourceTag: 'type:feature',     onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:data-access', 'type:util'] },
    ]
  }]
}
```

## Routing Pattern

The app shell lazily loads each page feature. `app.routes.ts` stays thin — it only maps URL paths
to components. Each page's smart component (`feat-*`) owns its internal routing if needed.

```typescript
// app.routes.ts
export const appRoutes: Route[] = [
  {
    path: '',
    component: ShellComponent,           // from layout/feat-shell/
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/feat-home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/feat-settings/settings.component').then(m => m.SettingsComponent),
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];
```

## Code Generation Templates

When asked to generate code, read the reference files for templates:

- **`references/component-templates.md`** — standalone component, signal-based service, route config
- **`references/library-scaffold.md`** — lib structure with project.json, index.ts, tsconfig (use only when creating a lib)

Always generate code that:
1. Uses `inject()` for DI
2. Uses `signal()`, `computed()`, `input()`, `output()` for reactivity
3. Uses `@if` / `@for` / `@switch` in templates
4. Uses `ChangeDetectionStrategy.OnPush`
5. Exports public API from `index.ts` (libs only)
6. Includes proper tags in `project.json` (libs only)

## Refactoring an Existing App

When the user asks to reorganize code inside an app, follow this workflow:

### Step 1: Understand the current structure

Read the app's directory tree, `app.routes.ts`, and key component files. Identify:
- What lives in `layout/` vs feature pages vs shared helpers
- Which components are smart (injecting services, responding to routes) vs presentational
- Which services are scoped to one feature vs used across the whole app

### Step 2: Map to the four types

For each folder or component, decide which type it belongs to:

```
Current file                             → Target location
──────────────────────────────────────────────────────────────────
layout/layout.component.ts               → layout/feat-shell/
layout/navigation/navigation.component   → layout/feat-navigation/
layout/sidebar/sidebar.component         → layout/feat-sidebar/
<purely presentational component>        → <feature>/ui-<name>/
<service / state>                        → <feature>/data-access/
<pure helpers / types>                   → <feature>/util/
```

Present the mapping to the user before moving any files — confirm they agree with the proposed structure.

### Step 3: Move files incrementally

Never break the app between steps. A safe order:

1. Create the new folder structure (empty folders)
2. Move `data-access/` services first (fewest dependents)
3. Move `ui-*` components (no DI, easiest to isolate)
4. Move `feat-*` components (update their imports to the moved services/ui)
5. Update `app.routes.ts` to point to new locations
6. Delete empty old folders
7. Run `nx lint` and `nx test` to verify

### Step 4: Verify

```bash
nx lint portal-example      # check boundary rules
nx test portal-example      # nothing broke
nx affected --target=build  # only the changed app should appear
```

## Adding a New Feature

When the user wants to add a new page or feature to an app:

1. Create a folder under `pages/<feature-name>/`
2. Add `data-access/`, `feat-<name>/`, and `ui-*/` subfolders as needed
3. Wire it into `app.routes.ts` with `loadComponent`
4. Keep everything within the app — don't create a lib unless asked

## Angular 21 Upgrade Patterns

When modernizing old patterns during a refactor:

| Old Pattern                              | Angular 21 Replacement                      |
|------------------------------------------|---------------------------------------------|
| `constructor(private svc: Service)`      | `private readonly svc = inject(Service)`    |
| `@Input() item: Item`                    | `readonly item = input<Item>()`             |
| `@Output() clicked = new EventEmitter()` | `readonly clicked = output<void>()`         |
| `*ngIf="condition"`                      | `@if (condition) { ... }`                   |
| `*ngFor="let x of items"`               | `@for (x of items; track x.id) { ... }`    |
| `NgModule` with declarations             | Standalone component with `imports: []`     |
| `BehaviorSubject` for local state        | `signal()` + `computed()`                   |
| Zone.js change detection                 | `provideZonelessChangeDetection()`          |

Only modernize when the user asks for it — some refactors are structure-only.
