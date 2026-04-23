# Showcase Page Template

Complete boilerplate for a `mat3/ui-<component>/<name>.component.ts` or
`foundation/ui-<topic>/<topic>.component.ts` page.

## File skeleton

```ts
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MatCard } from "@angular/material/card";
// ... other Material pieces specific to this showcase
import { CodeBlockComponent } from "../../../shared/ui-code-block/code-block.component";

@Component({
    selector: "exm-<name>-showcase",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatCard,
        MatButton,
        // ... the Material directives/components this page uses
        CodeBlockComponent,
    ],
    template: `
        <div class="mx-auto w-full max-w-5xl p-6">
            <header class="mb-8">
                <div class="text-sm font-medium text-blue-500 dark:text-blue-400">Material 3</div>
                <h1 class="mt-1 text-3xl font-semibold tracking-tight"><Component Name></h1>
                <p class="mt-2 leading-relaxed text-neutral-600 dark:text-neutral-300">
                    <One-paragraph intro to the component.> Pull the conceptual framing from the
                    Angular Material docs — what it's for, when to reach for it, the directive /
                    element name the user actually types.
                </p>
                <p class="mt-2 leading-relaxed text-neutral-500 dark:text-neutral-400">
                    Note: this portal uses an M3 theme, so the legacy
                    <code class="rounded bg-neutral-900/5 px-1 py-0.5 dark:bg-neutral-50/5">color="primary|accent|warn"</code>
                    input has no visual effect. Recolor by overriding the
                    <code class="rounded bg-neutral-900/5 px-1 py-0.5 dark:bg-neutral-50/5">--mat-sys-*</code>
                    or
                    <code class="rounded bg-neutral-900/5 px-1 py-0.5 dark:bg-neutral-50/5">--mat-<component>-*</code>
                    tokens in
                    <code class="rounded bg-neutral-900/5 px-1 py-0.5 dark:bg-neutral-50/5">libs/styles/src/components/material.css</code>.
                </p>
            </header>

            <!-- 1. First variant -->
            <section class="mb-10">
                <h2 class="text-xl font-semibold tracking-tight">1. <Variant title></h2>
                <p class="mt-1 mb-4 text-neutral-600 dark:text-neutral-300">
                    <Short description explaining when to use this variant — one sentence.>
                </p>
                <mat-card appearance="outlined" class="mb-3">
                    <div class="flex flex-wrap items-center gap-3 p-6">
                        <!-- live demo elements here -->
                    </div>
                </mat-card>
                <exm-code-block [code]="snippets.first" />
            </section>

            <!-- 2. Second variant -->
            <section class="mb-10">
                <h2 class="text-xl font-semibold tracking-tight">2. <Variant title></h2>
                <p class="mt-1 mb-4 text-neutral-600 dark:text-neutral-300">...</p>
                <mat-card appearance="outlined" class="mb-3">
                    <div class="flex flex-col gap-3 p-6">
                        <!-- live demo -->
                    </div>
                </mat-card>
                <exm-code-block [code]="snippets.second" />
            </section>

            <!-- ... more sections ... -->
        </div>
    `,
})
export class <ComponentName>ShowcaseComponent {
    // Interactive state lives here as signals / FormControls
    protected readonly someSignal = signal<string>("default");

    protected readonly snippets = {
        first: `<!-- Copy-pasteable HTML that the user could drop into their app -->
<some-element [input]="value">
  Text
</some-element>`,
        second: `// Component
protected readonly someSignal = signal<string>("default");

// Template
<some-element [(binding)]="someSignal">…</some-element>`,
    };
}
```

## The three section-wrapper layout choices

Pick the one that fits the content of each section:

### `flex flex-wrap items-center gap-3 p-6`

Default — use when demos are small inline elements (buttons, chips, icons, badges).

```html
<mat-card appearance="outlined" class="mb-3">
    <div class="flex flex-wrap items-center gap-3 p-6">
        <button matButton>Text</button>
        <button matButton disabled>Disabled</button>
    </div>
</mat-card>
```

### `flex flex-wrap items-start gap-4 p-6`

For demos where elements have varying vertical extent (form fields with labels, chip grids, date pickers).

```html
<mat-card appearance="outlined" class="mb-3">
    <div class="flex flex-wrap items-start gap-4 p-6">
        <mat-form-field>
            <mat-label>Name</mat-label>
            <input matInput />
        </mat-form-field>
    </div>
</mat-card>
```

### `flex flex-col gap-3 p-6` (or `gap-4`, `gap-6`)

For stacked content — list items, stepper rows, radio groups, menu items, select-all + children.

```html
<mat-card appearance="outlined" class="mb-3">
    <div class="flex flex-col gap-3 p-6">
        <mat-radio-group [(value)]="choice">
            <mat-radio-button value="a">Option A</mat-radio-button>
            <mat-radio-button value="b">Option B</mat-radio-button>
        </mat-radio-group>
    </div>
</mat-card>
```

## The snippets object pattern

Store code strings on the class so the template literal stays readable. Two accepted forms:

**Pure HTML** — paste-directly-into-template:

```ts
protected readonly snippets = {
    basic: `<button matButton>Text</button>
<button matButton disabled>Disabled</button>`,
};
```

**HTML + companion TS** — when the demo needs a FormControl / signal:

```ts
protected readonly snippets = {
    reactive: `// component.ts
protected readonly emailCtrl = new FormControl("", {
  nonNullable: true,
  validators: [Validators.required, Validators.email],
});

// template
<mat-form-field>
  <mat-label>Email</mat-label>
  <input matInput [formControl]="emailCtrl" />
  @if (emailCtrl.hasError("email")) {
    <mat-error>Enter a valid email</mat-error>
  }
</mat-form-field>`,
};
```

Keep snippets small — show the minimum a reader needs to reproduce the demo. Don't
reproduce the entire mat-card wrapper in the snippet; assume the reader knows where
to put it.

## Worked example — a complete checkbox showcase page

See `apps/portal-example/src/app/pages/mat3/ui-checkbox/checkbox.component.ts` in the
repo. It covers: basic / indeterminate / disabled / label position / reactive forms /
ngModel / select-all+indeterminate-parent / labelled-row. 8 sections total.

## Inline code styling in prose

For `<code>` spans inside explanation paragraphs, use the consistent utility class:

```html
<code class="rounded bg-neutral-900/5 px-1 py-0.5 dark:bg-neutral-50/5">matButton</code>
```

This renders at body font size with a subtle tinted pill background that works on both
the light card surface and (for any inline code that ends up on a glass surface) the
dark aurora scheme.

## When the page needs a "Variant axis" or extra metadata section

For pages like Typography or Button Toggle where there's a secondary aspect beyond
the primary variant list (e.g. font weights, hide-selection-indicator), add the section
AFTER the main variants, not before. Keep the main variant list contiguous so the
reader gets the component's core API first.

## Lazy route registration

Every showcase page is a lazy route target. Main thread adds this to `app.routes.ts`:

```ts
{
    path: "mat3/<name>",
    loadComponent: () =>
        import("./pages/mat3/ui-<name>/<name>.component").then(
            (m) => m.<Name>ShowcaseComponent,
        ),
},
```

Route path is always kebab-case of the component name. Module selector class name
matches the component name.

## Navigation entry

Add alphabetically within the `Material 3` children array in
`apps/<app>/src/app/layout/feat-navigation/navigation.data.ts`:

```ts
{
    id: "mat3-<name>",
    label: "<Label>",
    icon: "<kebab-case-icon>",
    route: "/mat3/<name>",
    activeOptions: { exact: true },
},
```

The icon name must be registered in `core/icon.ts` — see the icon registry section
of SKILL.md.
