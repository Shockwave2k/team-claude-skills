# Angular 21 Component & Service Templates

These templates follow Angular 21 defaults: signals, zoneless, standalone, inject().

## Standalone Component (Feature)

A "smart" component that lives in a `feat-*` library. It injects services and manages state.

```typescript
import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { <ServiceName> } from '@myorg/<domain>-data-access';
import { <UiComponent> } from '@myorg/<domain>-ui-<n>';

@Component({
  selector: 'app-<feature-name>',
  standalone: true,
  imports: [<UiComponent>],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p>Loading...</p>
    } @else {
      @for (item of items(); track item.id) {
        <app-<ui-component> [item]="item" (selected)="onSelect($event)" />
      } @empty {
        <p>No items found.</p>
      }
    }
  `,
})
export class <FeatureName>Component {
  private readonly service = inject(<ServiceName>);

  readonly loading = signal(true);
  readonly items = signal<Item[]>([]);
  readonly itemCount = computed(() => this.items().length);

  constructor() {
    this.loadItems();
  }

  private async loadItems() {
    this.loading.set(true);
    const data = await this.service.getAll();
    this.items.set(data);
    this.loading.set(false);
  }

  onSelect(item: Item) {
    // handle selection
  }
}
```

## Standalone Component (UI / Presentational)

A "dumb" component in a `ui-*` library. No injected services — only inputs and outputs.

```typescript
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-<component-name>',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" (click)="selected.emit(item())">
      <h3>{{ item().name }}</h3>
      <p>{{ item().description }}</p>
    </div>
  `,
})
export class <ComponentName>Component {
  readonly item = input.required<Item>();
  readonly selected = output<Item>();
}
```

## Signal-Based Service (Data Access)

Lives in a `data-access` library. Manages API calls and shared state.

```typescript
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class <ServiceName>Service {
  private readonly http = inject(HttpClient);

  private readonly _items = signal<Item[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Public read-only signals
  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly itemCount = computed(() => this._items().length);

  async getAll(): Promise<Item[]> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const items = await firstValueFrom(
        this.http.get<Item[]>('/api/items')
      );
      this._items.set(items);
      return items;
    } catch (err) {
      this._error.set('Failed to load items');
      return [];
    } finally {
      this._loading.set(false);
    }
  }

  async getById(id: string): Promise<Item | undefined> {
    const item = await firstValueFrom(
      this.http.get<Item>(`/api/items/${id}`)
    );
    return item;
  }
}
```

## Functional Guard

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@myorg/shared-data-access';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};
```

## Functional Interceptor

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@myorg/shared-data-access';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req);
};
```

## App Config (Zoneless)

```typescript
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { authInterceptor } from '@myorg/shared-data-access';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

## Route Configuration with Lazy Loading

```typescript
import { Route } from '@angular/router';
import { authGuard } from '@myorg/shared-data-access';

export const appRoutes: Route[] = [
  {
    path: 'products',
    loadComponent: () =>
      import('@myorg/products-feat-product-list').then(
        (m) => m.ProductListComponent
      ),
  },
  {
    path: 'products/:id',
    loadComponent: () =>
      import('@myorg/products-feat-product-detail').then(
        (m) => m.ProductDetailComponent
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadChildren: () =>
      import('@myorg/admin-feat-dashboard').then(
        (m) => m.adminRoutes
      ),
  },
  { path: '', redirectTo: 'products', pathMatch: 'full' },
];
```
