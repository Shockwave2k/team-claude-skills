# Known Gotchas

Each of these bit us during portal-example work. Reach for this file when a symptom
matches — don't rediscover the fix.

## 1. Vite / Angular cache staleness after file moves

**Symptom**: after `git mv` or renaming a file, `nx build` references the old path
even though the file is gone. Error text like `Could not resolve "apps/.../old/path"`
even though the old path doesn't exist in `project.json` or any source file.

**Cause**: Angular's esbuild keeps virtual-entry paths cached under `.angular/cache/`.
The Nx daemon has its own layer of caching too.

**Fix**:

```bash
cd <workspace-root>
rm -rf .angular/cache
npx nx build portal-example --skip-nx-cache
```

If the error persists after the cache clear:

```bash
npx nx reset
```

This stops the Nx daemon and clears all of its in-memory state, then re-runs.

## 2. NG0600 — signals can't be written during template render

**Symptom**: `ERROR RuntimeError: NG0600: Writing to signals is not allowed while
Angular renders the template (eg. interpolations)`. Stack trace points to a function
called from inside a template interpolation.

**Example bug** (tabs showcase's `recordVisit` in a lazy `matTabContent`):

```ts
protected recordVisit(id: string): string {
    const now = new Date().toLocaleTimeString();
    const log = this.lazyVisits();
    if (!log.some((entry) => entry.id === id)) {
        this.lazyVisits.set([...log, { id, at: now }]); // ← NG0600 here
    }
    return now;
}
```

```html
<p>Rendered at: {{ recordVisit("Alpha") }}</p>  <!-- template calls recordVisit during render -->
```

**Fix**: defer the write to after the render pass via `queueMicrotask`:

```ts
protected recordVisit(id: string): string {
    const now = new Date().toLocaleTimeString();
    // Called from inside a template interpolation — defer the signal write
    // with queueMicrotask so we don't violate NG0600.
    queueMicrotask(() => {
        this.lazyVisits.update((prev) =>
            prev.some((e) => e.id === id) ? prev : [...prev, { id, at: now }],
        );
    });
    return now;
}
```

Alternative: restructure so the write happens in an event handler (click, input, etc.)
rather than in template evaluation.

## 3. `<mat-selection-list [multiple]="false">` still requires an array

**Symptom**: runtime error `TypeError: values.forEach is not a function` coming from
`_MatSelectionList._setOptionsFromValues`. Happens when binding `[(ngModel)]` or
`[formControl]` to a scalar value on a single-select list.

**Cause**: `MatSelectionList`'s `writeValue` unconditionally calls `values.forEach(...)`.
Even with `[multiple]="false"`, the control accessor expects an array of length 0 or 1.

**Fix**: model the state as `string[]` (or `T[]`), capped at one entry via the UI.
Unwrap for display:

```ts
protected selectedPlan: string[] = ["pro"];
```

```html
<mat-selection-list [multiple]="false" [(ngModel)]="selectedPlan">
    <mat-list-option value="free">Free</mat-list-option>
    <mat-list-option value="pro">Pro</mat-list-option>
</mat-selection-list>

<div>
    Chosen: {{ selectedPlan.length ? selectedPlan[0] : "none" }}
</div>
```

If you actually want a single-value control, reach for `mat-radio-group` instead —
it's a better fit semantically.

## 4. `MatDialog.open<T, D, R>()` — first generic is the view context, NOT the TemplateRef

**Symptom**: `TS2769: No overload matches this call. Argument of type 'TemplateRef<unknown>'
is not assignable to parameter of type 'ComponentType<TemplateRef<unknown>>'`.

**Cause**: intuition says the first generic is "the thing being opened", so people
type `dialog.open<TemplateRef<unknown>, void, string>(tpl, ...)`. Actually the first
generic is the **embedded view's context type**, not the TemplateRef itself. For
template-based dialogs where no context is used, the first generic is `unknown`.

**Fix**:

```ts
// For a TemplateRef-based dialog:
//   T = embedded-view context type (use `unknown` if no context)
//   D = `data` payload type (void if no data)
//   R = result type returned by `close(value)`
const ref = this.dialog.open<unknown, void, string>(this.confirmTpl(), {
    width: "420px",
});
ref.afterClosed().subscribe((choice) => {
    // choice: string | undefined
});
```

For component-based dialogs the first generic *is* the component type — that's where
the confusion comes from.

## 5. MatCard `appearance="elevated"` is a type error

**Symptom**: `TS2322: Type '"elevated"' is not assignable to type 'MatCardAppearance'`.

**Cause**: Angular Material v21 exports `type MatCardAppearance = 'outlined' | 'filled'`.
Elevated is the default — achieved by **omitting the attribute entirely**, not by
passing `"elevated"` as a value.

**Fix**:

```html
<!-- ❌ Wrong -->
<mat-card appearance="elevated">...</mat-card>

<!-- ✅ Elevated is the default -->
<mat-card>...</mat-card>

<!-- ✅ Explicit variants -->
<mat-card appearance="outlined">...</mat-card>
<mat-card appearance="filled">...</mat-card>
```

## 6. Luxon adapter needs `@types/luxon`

**Symptom**: `TS7016: Could not find a declaration file for module 'luxon'. '.../node_modules/luxon/build/es6/luxon.mjs' implicitly has an 'any' type.`

**Cause**: `@angular/material-luxon-adapter` and `luxon` ship without TS types;
`@types/luxon` is a separate dev dependency.

**Fix**:

```bash
npm install --save-dev @types/luxon
```

Imports that need it:

```ts
import { DateTime } from "luxon";
```

## 7. Unitless CSS font-size falls back silently

**Symptom**: a `--text-*` token declared like `--text-md: 1;` produces font-size
values identical to the parent — the utility appears to do nothing.

**Cause**: bare `1` is an invalid CSS `font-size` value. The browser discards the
declaration and falls back to inherited, which is usually `text-base`.

**Fix**: always use a unit — `rem`, `px`, or `em`:

```css
--text-md: 1rem;       /* ✅ 16 px */
--text-md: 16px;       /* ✅ also fine */
--text-md: 1;          /* ❌ invalid, silently ignored */
```

## 8. MatSlider's new child-thumb API (v21+)

**Symptom**: old Angular Material slider code like `<mat-slider [min] [max] [(ngModel)]="value">`
throws template errors — `min` / `max` not recognized, no visible thumb.

**Cause**: the slider was redesigned. `<mat-slider>` is now a **container** and the
thumb is a **child input**:

```html
<!-- Single thumb -->
<mat-slider [min]="0" [max]="100" [step]="5">
    <input matSliderThumb [(ngModel)]="volume" />
</mat-slider>

<!-- Range -->
<mat-slider [min]="0" [max]="100" [step]="1">
    <input matSliderStartThumb [(ngModel)]="rangeStart" />
    <input matSliderEndThumb [(ngModel)]="rangeEnd" />
</mat-slider>
```

Required imports:

```ts
import { MatSlider, MatSliderThumb, MatSliderRangeThumb } from "@angular/material/slider";
```

Use `MatSliderThumb` for the single-thumb case and `MatSliderRangeThumb` (which is the
class backing both `matSliderStartThumb` and `matSliderEndThumb`) for the range case.

## 9. MatTabs alignment API renamed

**Symptom**: `<mat-tab-group align="center">` appears to do nothing. Same for `labelAlignment`.

**Cause**: v21 uses `alignTabs` (property) / `mat-align-tabs` (attribute), not `align`.

**Fix**:

```html
<mat-tab-group mat-align-tabs="center">...</mat-tab-group>
<mat-tab-group mat-align-tabs="end">...</mat-tab-group>
```

And for the stretch behavior, it's `mat-stretch-tabs` (attribute) / `stretchTabs` (property):

```html
<mat-tab-group mat-stretch-tabs>...</mat-tab-group>
<mat-tab-group [mat-stretch-tabs]="false">...</mat-tab-group>
```

## 10. MatTree's simpler v21 API

**Symptom**: looking at old Angular Material tree examples with
`MatTreeFlatDataSource`, `MatTreeFlattener`, `FlatTreeControl` — all the scaffolding
feels excessive.

**Cause**: Angular Material 21 introduced a simpler standalone `<mat-tree>` API that
takes a `dataSource` + `childrenAccessor` directly — no explicit `TreeControl` or
`TreeFlattener` needed for most cases.

**Preferred v21 pattern**:

```html
<mat-tree
    [dataSource]="TREE_DATA"
    [childrenAccessor]="childrenAccessor">
    <!-- Leaf nodes -->
    <mat-tree-node *matTreeNodeDef="let node" matTreeNodePadding>
        <span class="inline-block w-10"></span>
        <mat-icon svgIcon="file-text" class="mr-2 text-neutral-500" />
        <span>{{ node.name }}</span>
    </mat-tree-node>

    <!-- Branches -->
    <mat-tree-node *matTreeNodeDef="let node; when: hasChild" matTreeNodePadding>
        <button matIconButton matTreeNodeToggle>
            <mat-icon svgIcon="chevron-right" [class.rotate-90]="node.expanded" />
        </button>
        <mat-icon svgIcon="folder" class="mr-2 text-blue-500" />
        <span>{{ node.name }}</span>
    </mat-tree-node>
</mat-tree>
```

Component class:

```ts
protected readonly childrenAccessor = (node: FileNode) => node.children ?? [];
protected readonly hasChild = (_: number, node: FileNode) => !!node.children?.length;
```

The older `TreeControl` / `TreeFlattener` route still works but it's substantially more
code for no benefit unless you specifically need the low-level control (cross-node
state syncing, partial rebuilds, etc.).

Note: `*matTreeNodeDef` **is** a structural directive — one of the rare remaining places
in Angular 21 where the old `*` syntax is still required. Don't try to rewrite it to
`@if`/`@for`; the tree's renderer depends on the structural directive contract.

## When something else breaks

If the symptom isn't in this list:

1. `rm -rf .angular/cache` + `npx nx reset` first. A surprising share of "builds
   fine on my machine but breaks after X" issues are cache staleness.
2. Check whether the component's API changed in the latest Angular Material version
   — they ship breaking changes every major. Look at
   `node_modules/@angular/material/types/<component>.d.ts` for the actual exported
   surface.
3. If it's a Tailwind thing, check the generated CSS at
   `dist/apps/<app>/browser/styles-*.css` to see what Tailwind actually emitted —
   sometimes a `@theme` declaration doesn't produce the utility you expected.
