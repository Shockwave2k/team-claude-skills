# Agent Delegation

When the user asks for multiple showcase pages in one go (e.g. "build pages for
mat-slide-toggle, mat-slider, mat-stepper, mat-table, mat-tabs, mat-tooltip, mat-tree"),
the efficient pattern is **one `general-purpose` subagent per page, spawned in parallel**.

Main thread keeps ownership of the shared-writer files so agents don't step on each
other.

## Division of responsibility

| File / concern | Owner |
|---|---|
| `apps/<app>/src/app/pages/mat3/ui-<name>/<name>.component.ts` (new file) | **Subagent** |
| `apps/<app>/src/app/app.routes.ts` (add lazy route) | **Main thread** |
| `apps/<app>/src/app/layout/feat-navigation/navigation.data.ts` (add nav entry, alphabetized) | **Main thread** |
| `apps/<app>/src/app/core/icon.ts` (register any new icons) | **Main thread** |
| Integration verification (build + browser check) | **Main thread** |

Tell agents explicitly not to touch the three shared-writer files. They should
**report** which icons they want registered and let the main thread handle it.

## Spawning the agents

Send all subagent invocations in a **single message with multiple Agent tool uses**
so they actually run in parallel:

```
Agent({
    description: "Build mat3 slide-toggle page",
    subagent_type: "general-purpose",
    prompt: "<self-contained prompt — see template below>",
}),
Agent({ ... for slider ... }),
Agent({ ... for stepper ... }),
...
```

## Agent prompt template

Adapt this for each component. Fill in `<COMPONENT_NAME>`, `<COMPONENT_SELECTOR>`,
the variant list, and any component-specific context (e.g. date-adapter setup for
datepicker, the v21-specific API quirks from `references/gotchas.md`).

```
Build a Material 3 <COMPONENT_NAME> showcase page inside the portal-example Angular 21
app at /Users/vandecker/Neolink/neolink-v3/portal-website.

## Create exactly this file

`apps/portal-example/src/app/pages/mat3/ui-<KEBAB_NAME>/<KEBAB_NAME>.component.ts`

Do NOT modify any other file — main thread wires routes/nav/icons afterwards.

## Pattern (read first)

- `apps/portal-example/src/app/pages/mat3/ui-button/button.component.ts` — page shape
- `apps/portal-example/src/app/pages/mat3/ui-<CLOSEST_ANALOGUE>/<...>.component.ts` —
  the closest existing page (e.g. for datepicker, read form-field; for menu, read dialog)
- `apps/portal-example/src/app/shared/ui-code-block/code-block.component.ts`

## Non-negotiable conventions

- Selector `exm-<KEBAB_NAME>-showcase`, class `<PascalName>ShowcaseComponent`
- `ChangeDetectionStrategy.OnPush`, standalone, imports array, no NgModules
- Angular 21 only: signal() / input() / inject() / @if / @for (with track)
- Explanation `<p>` tags use `class="mt-1 mb-4 text-neutral-600 dark:text-neutral-300"`
  — NEVER `text-sm` (body default is 14 px; text-sm is 12 px, too small)
- Import CodeBlockComponent from `../../../shared/ui-code-block/code-block.component`
  (3 levels up from pages/mat3/ui-<name>/)
- Each section: `<h2>` numbered title, `<p>` description, demo wrapper,
  `<exm-code-block [code]="snippets.xxx" />`
- Demo wrapper: `<mat-card appearance="outlined" class="mb-3">` with inner
  `<div class="flex <layout> p-6">` (pick `flex-wrap items-center gap-3` for inline demos,
  `flex-wrap items-start gap-4` for form fields, `flex-col gap-3` for stacked)
- Header: blue eyebrow "Material 3", `<h1><COMPONENT_NAME></h1>`, explanation,
  M3 color caveat paragraph
- `protected readonly snippets = { ... }` on the class

## Variants to cover

Angular Material 21 exports `<LIST OF EXPORTS>` from `@angular/material/<module>`.

Number each section in the UI (`1.`, `2.`, …).

1. <First variant — shortest useful demo>
2. <Second variant>
...
N. <Last variant>

Interactive demos must actually work — wire a signal() or FormControl where needed.

## M3 color caveat

Include the boilerplate paragraph about `color="primary|accent|warn"` being ignored
under M3. Recolor via `--mat-sys-*` or `--mat-<name>-*` tokens in
`libs/styles/src/components/material.css`.

## Icons available

Listed in apps/portal-example/src/app/core/icon.ts. Common ones already registered:
home, chevron-right, move-right, panel-left, mouse-pointer-click, copy, check, plus,
x, square-check, pen-line, sun-moon, credit-card, toggle-left, toggle-right, tags,
calendar-days, app-window, chevrons-up-down, bold, italic, underline, align-left,
align-center, align-right, list, menu, chevrons-left-right, gauge, loader-circle,
circle-dot, sliders-horizontal, list-checks, table, layout-panel-top, info,
folder-tree, folder, file-text, badge, bell, mail, inbox, clock, type.

If you want an icon that isn't registered, use an already-registered stand-in and
list your desired icon in the report (pascal-case, matching the lucide-static export
name — e.g. `Settings`, `User`, `LogOut`, `FileText`, `Search`).

## Gotchas to watch for

<Pick the relevant ones from references/gotchas.md for this component. E.g., for
MatSelectionList mention array-binding; for MatDialog the generic-typing quirk; for
MatSlider the child-thumb API; for MatTabs the alignTabs attribute; for MatTree the
v21 childrenAccessor API.>

## Report back (under 180 words)

1. File path created
2. Exact Angular Material + forms + CDK imports used
3. Icons you'd like registered (pascal-case lucide) or "none"
4. Anything you deliberately cut from the variant list + why
5. Interactive demos worth eyeballing on the main thread

Do not run the dev server. Do not modify any file other than the one you create.
```

## Main-thread workflow after agents return

1. **Read each agent's report** — note the icon requests and any cuts.
2. **Scan the created files** for:
   - Correct selector (`exm-<name>-showcase`)
   - `OnPush`
   - `CodeBlockComponent` import at the right relative depth
   - `<mat-card appearance="outlined">` demo wrappers (not raw glass-card divs)
   - No `text-sm` on explanation paragraphs
3. **Register icons** collected from all agent reports:
   - Import pascal-case from `lucide-static` at the top of `core/icon.ts`
   - Add `matIconRegistry.addSvgIconLiteral("kebab-name", ...)` line
4. **Add routes** — one lazy route per page in `app.routes.ts`:
   ```ts
   {
       path: "mat3/<name>",
       loadComponent: () =>
           import("./pages/mat3/ui-<name>/<name>.component").then(
               (m) => m.<Name>ShowcaseComponent,
           ),
   },
   ```
5. **Add nav entries** alphabetized within Material 3 children array in
   `navigation.data.ts`.
6. **Build + verify**:
   ```bash
   rm -rf .angular/cache
   npx nx build portal-example --skip-nx-cache
   ```
   Then via the Claude Preview MCP (or a manual `nx serve`): navigate to each new
   route, assert the host element renders, check console for errors, and eyeball any
   interactive demos the agent flagged.

## Fixing agent output

Common issues to fix after agents return (all seen during the long portal-example run):

- **`MatDialog.open<TemplateRef<unknown>, ...>(...)`** — wrong generic. Fix to
  `open<unknown, ...>`. See gotcha #4.
- **`appearance="elevated"`** — type error. Drop the attribute. See gotcha #5.
- **`--mat-sys-*` tokens declared flat** in a new palette role — use
  `light-dark(light, dark)`. See design-system.md.
- **Signal writes inside template interpolation** — NG0600. Wrap in
  `queueMicrotask()`. See gotcha #2.
- **MatSelectionList bound to a scalar** — even `[multiple]="false"` wants
  `string[]`. See gotcha #3.
- **Stand-in icons in prose**: if the agent used `home` (stand-in for `bell`) but
  wrote "using bell stand-in" in the text, update the prose after swapping in the
  real icon.

## When a single agent is enough

For a single showcase page, you don't need parallelism — just write the file yourself
or spawn one agent. The parallel pattern pays off at 3+ pages.
