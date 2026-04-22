---
name: angular-19-component
description: Use this when adding or modifying Angular 19 components in a Neolink NX frontend. Covers standalone components, signals, the new @if/@for/@switch control flow, `inject()` over constructor DI, OnPush defaults, and Angular Material + Tailwind styling conventions.
---

# Angular 19 components (Neolink frontend)

## Stack

- NX monorepo with `@nx/angular`, Angular 19.2.
- Standalone components everywhere — no new NgModules.
- Angular Material 19 + `@angular/cdk` + Tailwind 3 (with `prettier-plugin-tailwindcss`).
- Signals-first state. RxJS still used for streams at the edges (HTTP, socket.io).
- Tests: Vitest via `@analogjs/vitest-angular`. Playwright for E2E.
- Type-safe backend calls via the shared tRPC client (see `nx-angular-library` skill for where that lives).

## Hard rules for new code

- `standalone: true` is the default in Angular 19 — do not add it explicitly, and do not generate NgModules.
- `changeDetection: ChangeDetectionStrategy.OnPush` on every component.
- `inject()` inside fields, not constructor parameters. Reserve the constructor for logic.
- New control flow only: `@if`, `@for` (with `track`), `@switch`. No `*ngIf`, `*ngFor` in new code.
- Signals (`signal`, `computed`, `effect`) for component state. Avoid `BehaviorSubject` for UI state.
- Inputs/outputs via `input()`, `input.required()`, `output()` — not the `@Input()` / `@Output()` decorators.

## Component skeleton

    import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
    import { MatButtonModule } from '@angular/material/button';
    import { UserStore } from '@portal/users/data-access';

    @Component({
      selector: 'portal-user-card',
      imports: [MatButtonModule],
      changeDetection: ChangeDetectionStrategy.OnPush,
      templateUrl: './user-card.component.html',
      styleUrl: './user-card.component.scss',
    })
    export class UserCardComponent {
      private readonly store = inject(UserStore);

      readonly userId = input.required<string>();
      readonly user = computed(() => this.store.byId(this.userId()));
    }

Template:

    @if (user(); as u) {
      <div class="flex items-center gap-3 rounded-lg border p-4">
        <span class="font-medium">{{ u.name }}</span>
        <button mat-button>Open</button>
      </div>
    } @else {
      <span class="text-slate-500">Loading…</span>
    }

## Styling

- Layout, spacing, colors, typography → Tailwind utility classes.
- Interactive widgets (buttons, form fields, dialogs, tables) → Angular Material.
- Component `.scss` only for things Tailwind can't express cleanly (`::ng-deep` Material overrides, complex animations).
- Never mix `NgClass`/`[class.foo]` bindings with Tailwind utility toggling — use signal-driven class strings: `class="{{ active() ? 'bg-primary' : 'bg-surface' }}"`.
- Prettier auto-sorts Tailwind classes; run `nx format` before committing.

## File layout

    user-card.component.ts
    user-card.component.html
    user-card.component.scss   # only if there are component-scoped styles
    user-card.component.spec.ts

Inline templates only for trivial components (<20 template lines).

## Tests

- Vitest + `@analogjs/vitest-angular`. Do **not** add Jasmine/Karma to new libs.
- Test component logic via `TestBed.createComponent(...)`, not DOM snapshots.
- E2E: Playwright under `apps/<app>-e2e/`.

## Do-not list

- No `NgModule`, `CommonModule`, or `BrowserModule` in new code.
- No `ngOnChanges` gymnastics — derive with `computed()` instead.
- No `subscribe()` in component code paths that could be signals; use `toSignal()` at the boundary.
- No `any` on tRPC call return types — the point of tRPC is inferred types. If you reach for `any`, the router definition is wrong.
