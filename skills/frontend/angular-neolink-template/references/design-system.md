# Design System — libs/styles

The shared CSS library consumed by every portal app in the monorepo.

## File layout

```
libs/styles/
├── project.json                  # tags: scope:shared, type:ui
├── tsconfig.json                 # empty (no TS in this lib)
└── src/
    ├── base/
    │   ├── base.css              # Global resets + body classes
    │   └── typography.css        # Heading defaults, prose rules
    ├── components/
    │   ├── material.css          # --mat-sys-* and --mat-<component>-* overrides (largest file)
    │   ├── input.css             # Native <input> chrome
    │   ├── a.css                 # Anchor defaults
    │   └── kbd.css               # <kbd> styling for keyboard-shortcut hints
    └── tailwind/
        ├── variants.css          # Custom @variant (scheme-light, scheme-dark)
        ├── theme.css             # @theme tokens: colors, sizes, weights, fonts, tracking
        └── utilities.css         # Custom @utility primitives (glass-card, prose, etc.)
```

## Why no `index.scss` aggregator

Two pipeline constraints collide and make a lib-side aggregator painful:

1. **Tailwind v4's `--leading-*: initial;` glob syntax isn't valid Sass.** Renaming
   `.css` files to `.scss` would make Sass throw on that line (and others like `--tracking-*: initial;`, `--text-*: initial;`).
2. **Angular's esbuild rebase-importer mangles relative `.css` imports inside a
   Sass-processed entry.** If `libs/styles/src/index.scss` does
   `@import "./tailwind/variants.css";`, the rebase resolves against the consuming
   *app's* directory, not the lib's — so the build fails with "Can't find stylesheet".

**Solution**: each app's `styles.scss` imports the lib files **directly**, in the
required order. Repeating the import block across apps is mild duplication (one
block of ~10 lines per app) — worth it to avoid fighting the build pipeline.

## Consumer pattern

Every app's `src/styles.scss` looks like this:

```scss
/* You can add global styles to this file, and also import other style files */

/* -------------------------------------------------------------------------- */
/* Tailwind CSS                                                               */
/* -------------------------------------------------------------------------- */
@import "tailwindcss" important;

/* -------------------------------------------------------------------------- */
/* Shared design system — libs/styles                                         */
/* -------------------------------------------------------------------------- */
/* Imported file-by-file rather than through an index.scss aggregator because */
/* Tailwind v4's `--leading-*: initial;` glob syntax and Angular's CSS-import */
/* rebase-importer don't cooperate when the lib has nested @imports. Keep the */
/* order: variants -> theme -> utilities, then CDK, then base, then           */
/* components. Copy this block to new apps that consume the shared design     */
/* system.                                                                    */

/* Tailwind custom variants, theme tokens, utilities */
@import "../../../libs/styles/src/tailwind/variants.css";
@import "../../../libs/styles/src/tailwind/theme.css";
@import "../../../libs/styles/src/tailwind/utilities.css";

/* Angular CDK overlays (dialog / menu / tooltip portals) */
@import "@angular/cdk/overlay-prebuilt.css";

/* Base resets + typography */
@import "../../../libs/styles/src/base/base.css";
@import "../../../libs/styles/src/base/typography.css";

/* Component overrides (Material, input, anchor, kbd) */
@import "../../../libs/styles/src/components/a.css";
@import "../../../libs/styles/src/components/input.css";
@import "../../../libs/styles/src/components/kbd.css";
@import "../../../libs/styles/src/components/material.css";

/* -------------------------------------------------------------------------- */
/* Per-app overrides                                                          */
/* -------------------------------------------------------------------------- */
/* Layer any app-specific token overrides below this line. The shared lib     */
/* exposes the full --color-*, --text-*, --mat-sys-*, and --mat-<component>-* */
/* surfaces — re-declare any of them inside a scoped selector or @theme block */
/* to retint this app only.                                                   */
```

The relative depth (`../../../`) assumes `styles.scss` lives at `apps/<app>/src/`. If
you move it back to `apps/<app>/src/styles/styles.scss`, add one more `../`.

**Don't forget** to point the `build` target at the right file in the app's `project.json`:

```json
"styles": ["apps/<app>/src/styles.scss"]
```

## Per-app overrides

Three ways to customize for a single app, in order of preference:

### 1. Override a CSS variable in the app's styles.scss

Tiniest blast radius, most common case. Example — neolink wants a different primary:

```scss
/* apps/portal-neolink/src/styles.scss — at the bottom */
#neolink {
    --color-primary-600: #0ea5e9;
}
```

### 2. Re-declare an @theme token

For Tailwind-generated utilities, override inside a new `@theme` block:

```scss
@theme {
    --font-sans: "Geist", system-ui, sans-serif;
}
```

### 3. Fork a specific component override

If the shared `--mat-<component>-*` defaults are wrong for an app, add a scoped
override file in that app's `src/styles/` (create the folder if it doesn't exist) and
list it after the shared imports. Rare — only reach for this when tokens can't express
the difference.

## The --mat-sys-* palette (light-dark pattern)

Under M3, `primary`, `secondary`, `tertiary`, and `error` need to flip **shades**
between light and dark modes so tinted glyphs (text-button labels, links, focus rings)
stay readable on whichever surface the scheme lands on. Generic pattern in
`libs/styles/src/components/material.css`:

```css
/* Primary — dark mode shifts to a lighter shade (200) so text-button labels
   stay legible on dark surfaces. Light mode keeps the stronger 600 shade. */
--mat-sys-primary: light-dark(var(--color-primary-600), var(--color-primary-200));
--mat-sys-on-primary: light-dark(var(--color-primary-50), var(--color-primary-950));
--mat-sys-primary-container: light-dark(var(--color-primary-50), var(--color-primary-900));
```

Key rule: **the `on-*` token must invert too**. If `primary` goes from dark (600) to
light (200), `on-primary` must go from light (50) to dark (950) so filled-button text
stays readable on the new background.

If you add a new palette role, follow the same pattern. If you only define the
`600` shade flat, dark-mode glyphs on that color will disappear into dark cards — this
was the "Text button blends into the dark" bug from portal-example.

## The glass-card utility

Defined in `tailwind/utilities.css`. Used by the code-block component.

```css
@utility glass-card {
    background: light-dark(
        color-mix(in oklch, var(--color-white) 88%, transparent),
        color-mix(in oklch, var(--color-slate-900) 78%, transparent)
    );
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid
        light-dark(
            color-mix(in oklch, var(--color-white) 70%, transparent),
            color-mix(in oklch, var(--color-white) 14%, transparent)
        );
}
```

Opacity tuning (88 % light / 78 % dark) is deliberate — originally 30%/35% but that
made the content hard to read on the aurora background. Bumping to near-solid while
keeping the 16 px blur + 180 % saturate preserves the "frosted" aesthetic at the
edges while making the body legible.

**Where to use it**:
- Code block host class (already wired in `exm-code-block`).
- Any NEW floating surface that sits on top of the aurora image — a mat-card with
  appearance="outlined" handles most cases, but if you need a translucent chrome
  element (sidebar notification, toast, etc.), `glass-card` is the right primitive.

**Where NOT to use it**:
- Showcase demo wrappers — those use `<mat-card appearance="outlined">`. The surface
  comes from Material tokens so it's consistent with the rest of the Material
  chrome on the page.
- Inside a mat-card — you don't need another glass layer.

## The Inter font loading

In `apps/<app>/src/index.html`:

```html
<link
    rel="preconnect"
    href="https://fonts.googleapis.com" />
<link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin />
<link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
    rel="stylesheet" />
```

The `@100..900` variable-font URL ships a single font file that covers every weight
from 100 to 900 continuously. This means:

- Ad-hoc weights like `class="font-[450]"` / `class="font-[650]"` resolve to a real
  rendered weight — not a synthetic bolded fallback.
- No separate HTTP request per discrete weight.

In `libs/styles/src/tailwind/theme.css`:

```css
--font-sans: "Inter", system-ui, sans-serif;
--font-display: "Inter", system-ui, sans-serif;
--font-mono: ui-monospace;
```

## The text size scale

The project uses a dense-UI rhythm:

| Token | Pixel size | Intended use |
|---|---|---|
| `text-2xs` | 8 px | Metadata / caption / chip labels |
| `text-xs` | 10 px | Small secondary copy |
| `text-sm` | 12 px | Hints / form helper text |
| `text-base` | 14 px | **Body copy (default)** |
| `text-md` | 16 px | Slightly emphasized body (see gotcha about unitless declarations) |
| `text-lg` | 18 px | Lead paragraph |
| `text-xl` | 20 px | Subsection heading |
| `text-2xl` | 22 px | Section heading |
| `text-3xl` | 26 px | Page heading |
| `text-4xl` | 30 px | Display heading |
| `text-5xl` | 40 px | Hero display |

**Do not** put `text-sm` on an explanation `<p>` in a showcase page. Body default is
`text-base` (14 px) — adding `text-sm` makes it 12 px, which is too small against the
Inter + Tailwind scale. Let body paragraphs inherit.

## Adding a new token

1. Declare it in `libs/styles/src/tailwind/theme.css` under the `@theme` block
   (if it's a Tailwind-consumed token) or in the right `--mat-*` section of
   `libs/styles/src/components/material.css` (if it's a Material override).
2. If it should flip between schemes, use `light-dark(light-value, dark-value)`.
3. Commit. Every consuming app picks it up on next build — no per-app changes needed.

## Adding a new utility

Use Tailwind v4's `@utility` directive in `libs/styles/src/tailwind/utilities.css`:

```css
@utility my-utility {
    /* static rules */
}

@utility my-parametric-utility-* {
    /* rules where * is captured */
}
```

Document at the top of the file what the utility is for — the prose/typography ones
already have headers.
