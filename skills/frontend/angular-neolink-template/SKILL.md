---
name: angular-neolink-template
description: >
  Coding conventions and page templates for the Neolink portal-website Nx monorepo
  (apps/portal-example, portal-neolink, portal-hive). Use for ANY Angular 21 work
  in that repo: building Material 3 showcase pages under pages/mat3/ui-COMPONENT/,
  touching libs/styles, registering icons in core/icon.ts, or debugging the known
  gotchas (Vite/Nx cache staleness, NG0600 signal-during-render, MatSelectionList
  array-only, MatDialog.open generic typing, Tailwind v4 vs Sass conflict,
  MatCard appearance elevated type error, @types/luxon, MatSlider child-thumb
  API, mat-tab alignTabs, MatTree childrenAccessor). Trigger on portal-example,
  portal-neolink, portal-hive, "Neolink template", "portal-example pattern",
  mat3 showcase, Foundation section, glass-card, Inter font, --mat-sys-* tokens,
  exm- prefix, or any mention of building a Material component reference page
  in this repo. Also trigger on paths like apps/portal-*/src/app/pages/mat3/
  or libs/styles/src/. Casual mentions of "neolink portal" should trigger too.
---

# Angular Neolink Template

Conventions, templates, and gotcha fixes for the Neolink portal-website Nx monorepo at
`/Users/vandecker/Neolink/neolink-v3/portal-website`.

This skill packages the patterns established across `portal-example` — the component
reference playground — so that `portal-neolink` and `portal-hive` (and any future
sibling apps) can adopt them without rediscovering the same decisions.

## When this skill applies

- Building a new Material 3 component showcase page under `apps/portal-*/src/app/pages/mat3/`
- Adding a theme/token reference page under `apps/portal-*/src/app/pages/foundation/`
- Touching the shared design system at `libs/styles/`
- Registering lucide icons in `core/icon.ts`
- Writing any new Angular 21 component in `apps/portal-*`
- Debugging any of the known gotchas listed below
- Extracting something new to `libs/` — check the decision rule in **Workspace layout**

If none of the above — for instance, you're writing plain TypeScript that happens to
be in the repo — this skill may be too specific; use your general Angular 21
knowledge instead.

## Workspace layout

```
portal-website/
├── apps/
│   ├── portal-example/       # Component reference playground (this skill originated here)
│   ├── portal-neolink/       # Product portal (in-progress)
│   └── portal-hive/          # Product portal (in-progress)
└── libs/
    ├── styles/               # Shared design system (CSS only — no TS)
    └── shared/
        ├── util-theming/     # Palette generation from seed hex colors
        ├── util-media/       # Breakpoint signals
        └── util-local-storage/
```

**App-first rule** (from the `anthropic-skills:angular-nx-architect` skill): code lives
inside the app that owns it. Extract to `libs/` only when 2+ apps *actually* need the
same code and the user agrees. Don't speculate.

**Exception in this repo**: `libs/styles/` already exists because the design system
explicitly exists for all three portal apps. New design tokens / Material overrides
go there, not in an app.

## Folder convention inside each app

```
apps/<app>/src/app/
├── core/
│   └── icon.ts                        # Lucide icon registry (shared by the whole app)
├── layout/
│   ├── feat-shell/                    # Smart — mat-sidenav wrapper
│   ├── feat-sidebar/                  # Smart — sidebar host
│   └── feat-navigation/               # Smart — nav tree + nav.data.ts
├── shared/
│   └── ui-code-block/                 # Reusable copy-to-clipboard code snippet
└── pages/
    ├── home/                          # Single-file home page (no wrapper folder)
    ├── mat3/
    │   ├── ui-button/button.component.ts
    │   ├── ui-checkbox/checkbox.component.ts
    │   └── ...                         # One ui-<component>/ folder per Material component
    └── foundation/
        └── ui-typography/typography.component.ts
```

### The `ui-*` vs `feat-*` decision

Route-target ≠ `feat-*`. The test is **what the component does**, not whether it has a URL.

- `feat-*` — smart container. Injects **app services** (auth, data, business state) and/or
  reacts to route params. The `layout/feat-shell` and `layout/feat-navigation` are
  `feat-*` because they inject app-level services.
- `ui-*` — purely presentational. May inject *framework* services (`MatDialog`,
  `MatPaginatorIntl`, `MatSort` via `viewChild`) but no app services. Has no business
  logic. **All the `mat3/` showcase pages qualify as `ui-*`** even though they're route
  targets — they exist solely to demonstrate Material components.

If a new page would only inject Angular/Material framework pieces and show
visuals/reference info, put it under `ui-<name>/`. If it injects `AuthService` or
drives a real business workflow, `feat-<name>/`.

### Collapsing the intermediate folder

Old pattern was `pages/mat3/<component>/feat-<component>/<name>.component.ts`. This
was collapsed to `pages/mat3/ui-<component>/<name>.component.ts` — the extra
`<component>/` level only pays off once a page grows siblings (`data-access/`,
`ui-*/`, `util/`). Re-add it the moment that happens.

## Angular 21 non-negotiables

Every component you write in this repo must follow these. No exceptions:

- `standalone: true` — no NgModules. Use the `imports:` array on the component.
- `changeDetection: ChangeDetectionStrategy.OnPush`
- `signal()` / `computed()` / `effect()` / `input()` / `output()` / `viewChild.required()`
  for reactivity. Don't use RxJS `BehaviorSubject` for local state.
- `inject(Service)` for DI. **Never** constructor-based injection.
- `@if` / `@for (item of items; track item.id)` / `@switch` in templates. **Never**
  `*ngIf` / `*ngFor`. Tracking is mandatory in `@for`.
- Functional guards, resolvers, interceptors (`CanActivateFn`, `ResolveFn`, etc.)
- Zoneless CD via `provideZonelessChangeDetection()` in `app.config.ts`.
- Font-family inheritance: body copy default is `text-base` (14 px). **Do NOT put
  `text-sm` on explanation `<p>` elements** — it renders too small against this scale.

## Selector convention

Each app has a prefix in its `project.json`:

- `portal-example` → `exm-`
- `portal-neolink` → check `apps/portal-neolink/project.json`
- `portal-hive` → same

Showcase page selectors are `<prefix>-<component>-showcase`:

```ts
selector: "exm-button-showcase"
selector: "exm-typography-showcase"
```

## Design system (libs/styles)

The shared CSS lib is **not consumed via an `index.scss` aggregator** — two build-pipeline
realities forced this:

1. Tailwind v4's `--leading-*: initial;` glob syntax isn't valid Sass — renaming the
   `.css` files to `.scss` would make Sass throw.
2. Angular's esbuild rebase-importer mangles relative `.css` `@import` paths inside
   Sass-processed entries — a lib-side `index.scss` with `@import "./tailwind/variants.css"`
   rebases against the consuming app and breaks.

**So**: each app lists the 10 lib imports directly in its `src/styles.scss`. Example
from `apps/portal-example/src/styles.scss`:

```scss
@import "tailwindcss" important;

/* Tailwind custom variants, theme tokens, utilities */
@import "../../../libs/styles/src/tailwind/variants.css";
@import "../../../libs/styles/src/tailwind/theme.css";
@import "../../../libs/styles/src/tailwind/utilities.css";

/* Angular CDK overlays (dialog / menu / tooltip portals) */
@import "@angular/cdk/overlay-prebuilt.css";

/* Base resets + typography */
@import "../../../libs/styles/src/base/base.css";
@import "../../../libs/styles/src/base/typography.css";

/* Component overrides */
@import "../../../libs/styles/src/components/a.css";
@import "../../../libs/styles/src/components/input.css";
@import "../../../libs/styles/src/components/kbd.css";
@import "../../../libs/styles/src/components/material.css";

/* Per-app overrides go here */
```

**Order matters.** Variants → theme → utilities → CDK → base → components. Don't rearrange.

The font is **Inter** loaded from Google Fonts via the variable-axis URL
(`family=Inter:wght@100..900`). Body `font-family` resolves to
`Inter, system-ui, sans-serif`. The size scale runs `text-2xs` (8 px) through `text-5xl`
(40 px) with 4 weights (normal/medium/semibold/bold).

For deeper details — the glass-card utility, the `--mat-sys-*` palette with light-dark()
handling, how to add a new token — see `references/design-system.md`.

## Showcase page template — the headline pattern

Every `ui-*/*.component.ts` under `mat3/` or `foundation/` follows the same shape. The
exact boilerplate is in `references/showcase-template.md`. Minimal skeleton:

```ts
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatCard } from "@angular/material/card";
import { CodeBlockComponent } from "../../../shared/ui-code-block/code-block.component";

@Component({
    selector: "exm-<name>-showcase",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatCard, /* ...Material pieces... */, CodeBlockComponent],
    template: `
        <div class="mx-auto w-full max-w-5xl p-6">
            <header class="mb-8">
                <div class="text-sm font-medium text-blue-500 dark:text-blue-400">Material 3</div>
                <h1 class="mt-1 text-3xl font-semibold tracking-tight"><Name></h1>
                <p class="mt-2 leading-relaxed text-neutral-600 dark:text-neutral-300">...</p>
                <p class="mt-2 leading-relaxed text-neutral-500 dark:text-neutral-400">
                    M3 caveat paragraph — recolor via --mat-sys-* / --mat-<name>-* tokens.
                </p>
            </header>

            <section class="mb-10">
                <h2 class="text-xl font-semibold tracking-tight">1. <Variant></h2>
                <p class="mt-1 mb-4 text-neutral-600 dark:text-neutral-300">...</p>
                <mat-card appearance="outlined" class="mb-3">
                    <div class="flex flex-wrap items-center gap-3 p-6">
                        <!-- live demo here -->
                    </div>
                </mat-card>
                <exm-code-block [code]="snippets.basic" />
            </section>
        </div>
    `
})
export class <Name>ShowcaseComponent {
    protected readonly snippets = {
        basic: `<!-- copy-pasteable snippet -->`
    };
}
```

**Key rules:**
- Blue `Material 3` (or `Foundation`) eyebrow + `<h1>` + explanation + M3 caveat paragraph.
- Numbered sections (`1.`, `2.`, …) so the reader can scan.
- Demo wrapper is always `<mat-card appearance="outlined" class="mb-3">` — never `<div class="glass-card">` (that's the code-block's job).
- Inner layout div picks `flex flex-wrap items-center gap-3 p-6` (buttons/chips),
  `flex flex-wrap items-start gap-4 p-6` (form fields), or `flex flex-col gap-4 p-6` (stacked).
- `appearance` on `<mat-card>` is only `"outlined"` or `"filled"` — `"elevated"` is a type
  error; elevated is the default, achieved by omitting the attribute.
- Snippet object on the class so the code-block gets a template literal via `[code]`.

## The exm-code-block component

At `apps/<app>/src/app/shared/ui-code-block/code-block.component.ts`. Usage:

```html
<exm-code-block [code]="snippets.basic" />
<exm-code-block [code]="snippets.filled" language="html" />
```

Import path from mat3/foundation pages (3 levels up from `pages/mat3/ui-<name>/`):

```ts
import { CodeBlockComponent } from "../../../shared/ui-code-block/code-block.component";
```

## Icon registry

All MatIcon icons are registered centrally in `apps/<app>/src/app/core/icon.ts` via
`matIconRegistry.addSvgIconLiteral(kebabName, sanitizer.bypassSecurityTrustHtml(PascalName))`.
Icons come from `lucide-static`.

**Workflow when you need a new icon**:

1. Import the PascalCase name at the top of `icon.ts`:
   ```ts
   import { ..., Settings, ... } from "lucide-static";
   ```
2. Register it with the kebab-case name:
   ```ts
   matIconRegistry.addSvgIconLiteral("settings", domSanitizer.bypassSecurityTrustHtml(Settings));
   ```
3. Reference in templates by kebab-case: `<mat-icon svgIcon="settings" />`

When delegating showcase-page work to subagents, tell them to report back icons they
need rather than register them directly — the main thread keeps `icon.ts` as a shared
single-writer file.

## The M3 color caveat (important pitfall)

Angular Material 21's M3 theme **ignores the legacy `color="primary|accent|warn"`
input**. Filled buttons, checkboxes, radio buttons, progress bars — none of them
respond to `color` under M3.

Don't render demos that assume `color` works. Instead:

- In showcase prose: include the standard M3 caveat paragraph (see the template above).
- Recoloring is done by overriding `--mat-sys-*` tokens in
  `libs/styles/src/components/material.css`, or per-component tokens like
  `--mat-button-filled-container-color`, `--mat-card-outlined-container-color`.
- For tokens that need to flip between schemes (e.g. primary needs to be bright in
  dark mode so text-button labels stay readable), use `light-dark(lightValue, darkValue)`
  — not just a flat variable. This is already set up for primary/secondary/tertiary/error.

## Known gotchas (top 10)

These all bit us during portal-example work. Reference + reproduction in
`references/gotchas.md`. Quick list:

1. **Vite/Angular cache staleness** — after file moves/renames, `rm -rf .angular/cache` before rebuilding. If the build still references old paths, `npx nx reset` clears the daemon.
2. **NG0600 (signal write during render)** — defer template-triggered signal writes with `queueMicrotask(() => signal.update(...))`.
3. **MatSelectionList `[multiple]="false"` still takes an array** — model as `string[]` (length ≤ 1). Scalar ngModel crashes `_setOptionsFromValues`.
4. **`MatDialog.open<T, D, R>()` first generic is the view context**, not `TemplateRef<unknown>`. Use `dialog.open<unknown, void, string>(tpl, ...)` for typed `afterClosed()`.
5. **MatCard `appearance="elevated"` is a type error** — v21 accepts `'outlined' | 'filled'`; elevated is the default (omit the attribute).
6. **`@types/luxon`** must be installed when using `@angular/material-luxon-adapter`, otherwise `import { DateTime } from "luxon"` fails type check.
7. **Unitless CSS font-size** — `--text-md: 1;` is invalid, browser falls back to inherited. Always include rem/px.
8. **MatSlider new API** — `<mat-slider>` is a container; thumbs are child `<input matSliderThumb>` / `<input matSliderStartThumb>` / `<input matSliderEndThumb>`.
9. **Mat-tab alignment** — it's `mat-align-tabs="start|center|end"` in v21, NOT `align` or `labelAlignment`. Stretch attribute is `mat-stretch-tabs`.
10. **Mat-tree v21 API** — use `<mat-tree [dataSource] [childrenAccessor]>` with `*matTreeNodeDef`. Don't pull the older `TreeControl` / `TreeFlattener` classic route unless you need the low-level control.

## Building multiple showcase pages: use subagents

When the user asks for several mat3 pages at once (e.g. "do mat-slide-toggle, mat-slider,
mat-stepper, mat-table, mat-tabs, mat-tooltip, mat-tree"), spawn one `general-purpose`
agent per page in parallel — one agent per file.

Main-thread responsibilities that agents must NOT touch:
- `apps/<app>/src/app/app.routes.ts` (routes)
- `apps/<app>/src/app/layout/feat-navigation/navigation.data.ts` (nav entries)
- `apps/<app>/src/app/core/icon.ts` (icon registry)

Full agent prompt template and reporting contract: `references/agent-delegation.md`.

## When you finish a page

Main thread wires the integration and verifies:

1. Register any icons the agent requested (pascal-case in the lucide-static import +
   kebab-case registry entry).
2. Add a `loadComponent` lazy route in `app.routes.ts`.
3. Add a navigation entry in `navigation.data.ts` (alphabetized within its section).
4. `rm -rf .angular/cache` then `npx nx build portal-<app>` to confirm no type errors.
5. Spin up `nx serve portal-<app>` (or the Claude Preview MCP if available) and
   eval-check the page: query for `exm-<name>-showcase` host, count sections, verify
   no console errors.

## Additional references in this skill

- **`references/showcase-template.md`** — full copy-pasteable page boilerplate, including
  the header/section/snippets-object shape and a worked example (button or checkbox).
- **`references/design-system.md`** — libs/styles deep dive: glass-card utility,
  `--mat-sys-*` light-dark pattern, how to add a new token, why no index.scss,
  per-app override approach.
- **`references/gotchas.md`** — the 10 gotchas with reproduction, fix, and the
  commit/date we discovered them.
- **`references/agent-delegation.md`** — subagent prompt template and the reporting
  contract (file path / imports / icons / cuts / demos to eyeball).
