---
name: angular-unit-test
description: Generate, scaffold, or fix Angular 21 unit tests using Vitest. Use this skill whenever the user asks to create tests, write test specs, test a component/service/pipe/directive, add test coverage, fix failing tests, generate test boilerplate, set up testing for Angular features, or mentions unit testing, spec files, TestBed, ComponentFixture, or any testing-related Angular concepts. Also trigger when user mentions Vitest, Jasmine migration, test mocking, or async testing patterns. Even casual phrases like "test this", "add tests for", "how do I test", or "my tests are failing" should activate this skill.
---

# Angular Unit Testing Skill

Generate production-ready Angular 21 unit tests following official testing best practices with Vitest as the default test runner.

## Quick Reference

**Default Test Runner**: Vitest (with jsdom for Node.js environment)
**Browser Testing**: Playwright or WebdriverIO for browser-specific APIs
**Key Imports**: `vitest`, `@angular/core/testing`, `@angular/platform-browser`

---

## Core Workflow

1. **Analyze the source file** to detect:
   - Component vs Service vs Pipe vs Directive
   - Standalone vs NgModule pattern (`standalone: true` in decorator)
   - Change detection strategy (`OnPush` vs Default)
   - Dependencies (services, routes, forms, HTTP)
   - Signals usage (`signal()`, `computed()`, `effect()`)
   - Async patterns (Observables, Promises)

2. **Generate appropriate test template** based on detected patterns

3. **Add edge case handling** for:
   - OnPush change detection
   - Signal-based reactivity
   - Route parameters (`ActivatedRoute`)
   - Reactive forms validation
   - HTTP mocking with `HttpTestingController`

4. **Follow naming conventions**:
   - Test file: `component-name.component.spec.ts`
   - Describe block: Component/Service class name
   - Test cases: Start with "should" (e.g., "should create")

---

## Testing Patterns by Type

### Pattern 1: Standalone Component (Default in Angular 21)

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent], // Standalone components go in imports
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

**When to use**: Component has `standalone: true` in `@Component` decorator

**Key differences from NgModule components**:
- Component itself goes in `imports`, not `declarations`
- Dependencies also go in `imports` array

---

### Pattern 2: NgModule Component (Legacy)

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MyComponent], // NgModule components go in declarations
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

**When to use**: Component does NOT have `standalone: true`

---

### Pattern 3: Service with Dependencies

```typescript
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MyService } from './my.service';
import { DependencyService } from './dependency.service';

describe('MyService', () => {
  let service: MyService;
  let mockDependency: DependencyService;

  beforeEach(() => {
    // Create a mock/stub of the dependency
    mockDependency = {
      someMethod: vi.fn().mockReturnValue('mocked value'),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        MyService,
        { provide: DependencyService, useValue: mockDependency },
      ],
    });

    service = TestBed.inject(MyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call dependency method', () => {
    service.methodThatUsesDependency();
    expect(mockDependency.someMethod).toHaveBeenCalled();
  });
});
```

**When to use**: Service injects other services in constructor

**Key points**:
- Mock dependencies with Vitest's `vi.fn()`
- Provide mocks using `{ provide: X, useValue: mockX }`
- Use `TestBed.inject()` to get service instance

---

### Pattern 4: HTTP Service Testing

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MyHttpService } from './my-http.service';

describe('MyHttpService', () => {
  let service: MyHttpService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MyHttpService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(MyHttpService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Verify no outstanding HTTP requests
    httpController.verify();
  });

  it('should GET /api/resource', () => {
    const mockData = [{ id: 1, name: 'Test' }];

    service.getAll().subscribe(data => {
      expect(data).toEqual(mockData);
    });

    const req = httpController.expectOne('/api/resource');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('should handle 500 error', () => {
    let error: any;
    
    service.getAll().subscribe({
      error: (e) => error = e
    });

    const req = httpController.expectOne('/api/resource');
    req.flush('Server error', { 
      status: 500, 
      statusText: 'Internal Server Error' 
    });

    expect(error.status).toBe(500);
  });
});
```

**When to use**: Service uses `HttpClient`

**Key points**:
- Use `provideHttpClient()` and `provideHttpClientTesting()`
- `httpController.expectOne()` verifies request was made
- `req.flush()` provides mock response
- Always call `httpController.verify()` in `afterEach`

---

### Pattern 5: Pipe Testing (Simplest)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyPipe } from './my.pipe';

describe('MyPipe', () => {
  let pipe: MyPipe;

  beforeEach(() => {
    pipe = new MyPipe();
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should transform input to output', () => {
    expect(pipe.transform('input')).toBe('expected output');
  });

  it('should handle null input', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('should handle undefined input', () => {
    expect(pipe.transform(undefined)).toBe('');
  });
});
```

**When to use**: Testing pipe classes

**Key points**:
- No TestBed needed for simple pipes
- Directly instantiate: `new MyPipe()`
- Test edge cases: null, undefined, empty string

---

### Pattern 6: Directive Testing with Host Component

```typescript
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { MyDirective } from './my.directive';

@Component({
  standalone: true,
  imports: [MyDirective],
  template: `<div appMyDirective [config]="config">content</div>`
})
class HostComponent {
  config = { enabled: true };
}

describe('MyDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    const directive = fixture.debugElement.query(By.directive(MyDirective));
    expect(directive).toBeTruthy();
  });

  it('should apply expected CSS class', () => {
    const el = fixture.debugElement.query(By.css('[appMyDirective]'));
    expect(el.nativeElement.classList.contains('expected-class')).toBe(true);
  });
});
```

**When to use**: Testing attribute directives

**Key points**:
- Create a test-only `HostComponent` with the directive applied
- Use `By.directive()` to query for directive instance
- Use `By.css()` to query for elements with directive applied

---

## Edge Cases and Special Scenarios

### Edge Case 1: OnPush Change Detection

```typescript
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
  selector: 'app-onpush',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div>{{ data.value }}</div>`
})
class OnPushComponent {
  @Input() data!: { value: string };
}

describe('OnPushComponent', () => {
  let component: OnPushComponent;
  let fixture: ComponentFixture<OnPushComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnPushComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OnPushComponent);
    component = fixture.componentInstance;
  });

  it('should update when input reference changes', () => {
    // ✅ CORRECT: Replace entire reference
    component.data = { value: 'initial' };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('initial');

    component.data = { value: 'updated' }; // New reference
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('updated');
  });

  it('should NOT update when mutating input in place', () => {
    // ❌ INCORRECT: This won't trigger change detection with OnPush
    component.data = { value: 'initial' };
    fixture.detectChanges();
    
    component.data.value = 'mutated'; // Same reference
    fixture.detectChanges(); // OnPush won't detect this
    expect(fixture.nativeElement.textContent).toContain('initial'); // Still old value
  });
});
```

**Detection**: `changeDetection: ChangeDetectionStrategy.OnPush` in component decorator

**Test strategy**:
- Always replace input references, never mutate
- Call `fixture.detectChanges()` after each reference change

---

### Edge Case 2: Components with Signals (Angular 16+)

```typescript
import { Component, signal, computed } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
  selector: 'app-signals',
  standalone: true,
  template: `
    <div>Count: {{ count() }}</div>
    <div>Double: {{ doubled() }}</div>
  `
})
class SignalsComponent {
  count = signal(0);
  doubled = computed(() => this.count() * 2);

  increment() {
    this.count.update(v => v + 1);
  }
}

describe('SignalsComponent', () => {
  let component: SignalsComponent;
  let fixture: ComponentFixture<SignalsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignalsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SignalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should update signal and computed value', () => {
    expect(component.count()).toBe(0);
    expect(component.doubled()).toBe(0);

    component.increment();
    // Signal updates are synchronous but batched
    fixture.detectChanges(); // Flush all pending effects
    
    expect(component.count()).toBe(1);
    expect(component.doubled()).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Count: 1');
    expect(fixture.nativeElement.textContent).toContain('Double: 2');
  });
});
```

**Detection**: Imports from `@angular/core` include `signal`, `computed`, or `effect`

**Test strategy**:
- Signal updates are synchronous but batched
- Call `fixture.detectChanges()` once after signal updates
- Assert on both signal values and DOM

---

### Edge Case 3: Components with ActivatedRoute

```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { convertToParamMap } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
  selector: 'app-routed',
  standalone: true,
  template: `<div>ID: {{ id }}</div>`
})
class RoutedComponent implements OnInit {
  id: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id');
  }
}

describe('RoutedComponent', () => {
  let component: RoutedComponent;
  let fixture: ComponentFixture<RoutedComponent>;

  beforeEach(async () => {
    const mockActivatedRoute = {
      params: of({ id: '123' }),
      snapshot: {
        paramMap: convertToParamMap({ id: '123' })
      }
    };

    await TestBed.configureTestingModule({
      imports: [RoutedComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RoutedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should read route parameter', () => {
    expect(component.id).toBe('123');
  });
});
```

**Detection**: Constructor injects `ActivatedRoute`

**Test strategy**:
- Never provide real `ActivatedRoute`
- Provide stub with `params` observable and `snapshot.paramMap`
- Use `convertToParamMap()` helper for snapshot

---

### Edge Case 4: Reactive Forms

```typescript
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
  selector: 'app-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <input formControlName="email" />
      <span class="error" *ngIf="form.get('email')?.invalid">Invalid email</span>
    </form>
  `
})
class FormComponent {
  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }
}

describe('FormComponent', () => {
  let component: FormComponent;
  let fixture: ComponentFixture<FormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should validate email field', () => {
    const emailControl = component.form.get('email');
    
    // Test invalid email
    emailControl?.setValue('invalid');
    expect(emailControl?.invalid).toBe(true);
    expect(emailControl?.errors?.['email']).toBeTruthy();
    
    // Test valid email
    emailControl?.setValue('test@example.com');
    expect(emailControl?.valid).toBe(true);
  });

  it('should show error message for invalid email', () => {
    const emailControl = component.form.get('email');
    emailControl?.setValue('invalid');
    emailControl?.markAsTouched();
    fixture.detectChanges();
    
    const error = fixture.nativeElement.querySelector('.error');
    expect(error).toBeTruthy();
  });
});
```

**Detection**: Component imports `ReactiveFormsModule` or uses `FormGroup`/`FormControl`

**Test strategy**:
- Import `ReactiveFormsModule` in test config
- Test validation by setting control values directly
- Call `fixture.detectChanges()` after value changes
- Assert on both control state and DOM error messages

---

### Edge Case 5: Async Testing with fakeAsync

```typescript
import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
  selector: 'app-async',
  standalone: true,
  template: `<div>{{ message }}</div>`
})
class AsyncComponent {
  message = '';

  loadData() {
    setTimeout(() => {
      this.message = 'Data loaded';
    }, 1000);
  }
}

describe('AsyncComponent', () => {
  let component: AsyncComponent;
  let fixture: ComponentFixture<AsyncComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsyncComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AsyncComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load data after timeout', fakeAsync(() => {
    component.loadData();
    
    // Fast-forward time by 1000ms
    tick(1000);
    fixture.detectChanges();
    
    expect(component.message).toBe('Data loaded');
    expect(fixture.nativeElement.textContent).toContain('Data loaded');
  }));
});
```

**Detection**: Component uses `setTimeout`, `setInterval`, or other async operations

**Test strategy**:
- Use `fakeAsync()` wrapper for the test
- Use `tick(milliseconds)` to fast-forward time
- Call `fixture.detectChanges()` after `tick()`

---

## Component Harness Pattern

For shared, reusable components, create a harness to provide a stable test API:

```typescript
// my-component.harness.ts
import { ComponentHarness } from '@angular/cdk/testing';

export class MyComponentHarness extends ComponentHarness {
  static hostSelector = 'app-my-component';

  private getTitle = this.locatorFor('h1');
  private getSubmitButton = this.locatorFor('[data-testid="submit"]');
  private getInput = this.locatorFor('input');

  async getTitleText(): Promise<string> {
    const title = await this.getTitle();
    return title.text();
  }

  async clickSubmit(): Promise<void> {
    const button = await this.getSubmitButton();
    await button.click();
  }

  async setInputValue(value: string): Promise<void> {
    const input = await this.getInput();
    await input.sendKeys(value);
  }

  async isSubmitDisabled(): Promise<boolean> {
    const button = await this.getSubmitButton();
    const disabled = await button.getAttribute('disabled');
    return disabled !== null;
  }
}

// my-component.spec.ts
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MyComponentHarness } from './my-component.harness';

describe('MyComponent', () => {
  let harness: MyComponentHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(MyComponent);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    harness = await loader.getHarness(MyComponentHarness);
  });

  it('should interact via harness', async () => {
    await harness.setInputValue('test');
    await harness.clickSubmit();
    const title = await harness.getTitleText();
    expect(title).toBe('Submitted');
  });
});
```

**When to use**: 
- Shared widget libraries
- Components with complex user interactions
- Tests that should survive implementation changes

**Benefits**:
- Decouples tests from DOM structure
- Same harness works in unit and E2E tests
- Provides stable API for component consumers

---

## Best Practices Checklist

### ✅ DO:

1. **Use Vitest** as the default test runner (Angular 21 default)
2. **Detect standalone vs NgModule** and use correct TestBed configuration
3. **Mock all external dependencies** (HTTP, services, routes)
4. **Test edge cases**: null, undefined, empty arrays, error states
5. **Use `fixture.detectChanges()`** after modifying component state
6. **Call `httpController.verify()`** in `afterEach` for HTTP tests
7. **Replace input references** for OnPush components (not mutate)
8. **Use `fakeAsync` and `tick()`** for async operations
9. **Test both component logic AND DOM rendering**
10. **Use descriptive test names** starting with "should"

### ❌ DON'T:

1. **Don't provide real ActivatedRoute** - always stub it
2. **Don't mutate inputs** on OnPush components
3. **Don't forget `compileComponents()`** in `beforeEach`
4. **Don't make real HTTP calls** - use `HttpTestingController`
5. **Don't test private methods** directly
6. **Don't use `setTimeout` in tests** - use `fakeAsync` and `tick`
7. **Don't mix async patterns** (avoid `async/await` + `fakeAsync`)
8. **Don't forget to import dependencies** in TestBed config
9. **Don't test implementation details** - test behavior
10. **Don't skip error case tests**

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Forgetting to Call `detectChanges()`

```typescript
// ❌ BAD
it('should update title', () => {
  component.title = 'New Title';
  // Missing fixture.detectChanges()!
  expect(fixture.nativeElement.textContent).toContain('New Title'); // FAILS
});

// ✅ GOOD
it('should update title', () => {
  component.title = 'New Title';
  fixture.detectChanges(); // Trigger change detection
  expect(fixture.nativeElement.textContent).toContain('New Title'); // PASSES
});
```

### Anti-Pattern 2: Testing Private Methods

```typescript
// ❌ BAD - Don't test private methods directly
it('should calculate total', () => {
  const result = (component as any).calculateTotal(); // BAD
  expect(result).toBe(100);
});

// ✅ GOOD - Test public API and observable behavior
it('should display correct total', () => {
  component.items = [{ price: 50 }, { price: 50 }];
  fixture.detectChanges();
  expect(component.total).toBe(100); // Test public property
  expect(fixture.nativeElement.querySelector('.total').textContent).toBe('100');
});
```

### Anti-Pattern 3: Over-Mocking

```typescript
// ❌ BAD - Mocking everything defeats the purpose
beforeEach(() => {
  mockService.getData = vi.fn().mockReturnValue(of(mockData));
  mockService.processData = vi.fn().mockReturnValue(processedData);
  mockService.validateData = vi.fn().mockReturnValue(true);
  // ... mocking 20 methods
});

// ✅ GOOD - Only mock external dependencies
beforeEach(() => {
  mockHttpService.get = vi.fn().mockReturnValue(of(mockData));
  // Service's internal methods like processData and validateData 
  // should run for real to test actual logic
});
```

---

## Performance Considerations

1. **Minimize TestBed resets**: Use `beforeEach` properly, don't recreate TestBed unnecessarily
2. **Avoid real HTTP calls**: Always use `HttpTestingController`
3. **Use `fakeAsync`** instead of real async delays
4. **Share expensive setup**: Extract common TestBed configs to helper functions
5. **Run tests in parallel**: Vitest supports parallel execution by default

---

## Migration from Karma/Jasmine

If migrating from Karma/Jasmine to Vitest:

1. Replace `describe`, `it`, `beforeEach` imports from `jasmine` with `vitest`
2. Replace `jasmine.createSpyObj` with Vitest mocks: `vi.fn()`
3. Replace `jasmine.SpyObj<T>` types with manual type definitions
4. Update `karma.conf.js` → `vitest.config.ts`
5. Change test script in `package.json` from `ng test` to `ng test` (CLI auto-detects Vitest)

**Example migration**:

```typescript
// Before (Jasmine)
import { createSpyObj, SpyObj } from 'jasmine';

let mockService: SpyObj<MyService>;
mockService = createSpyObj('MyService', ['getData']);
mockService.getData.and.returnValue(of(mockData));

// After (Vitest)
import { vi } from 'vitest';

let mockService: { getData: ReturnType<typeof vi.fn> };
mockService = {
  getData: vi.fn().mockReturnValue(of(mockData))
};
```

---

## Quick Decision Tree

```
User wants to test...
│
├─ Component?
│  ├─ Standalone (standalone: true) → Use imports: [Component]
│  ├─ NgModule (no standalone) → Use declarations: [Component]
│  ├─ Has OnPush? → Replace input references
│  ├─ Uses Signals? → Call detectChanges() after signal updates
│  ├─ Has ActivatedRoute? → Mock route params
│  └─ Has Reactive Forms? → Import ReactiveFormsModule, test validation
│
├─ Service?
│  ├─ Has dependencies? → Mock them with vi.fn()
│  ├─ Uses HttpClient? → Use HttpTestingController
│  └─ Async operations? → Use fakeAsync/tick or async/await
│
├─ Pipe?
│  └─ Directly instantiate with new Pipe()
│
└─ Directive?
   └─ Create HostComponent with directive applied
```

---

## Output Format

When generating tests, Claude should:

1. **Create the spec file** with proper naming: `{name}.spec.ts`
2. **Include all necessary imports** at the top
3. **Set up proper TestBed configuration** based on component type
4. **Include basic "should create" test** as baseline
5. **Add domain-specific tests** based on component functionality
6. **Add edge case tests** for detected patterns (OnPush, Signals, etc.)
7. **Follow AAA pattern**: Arrange, Act, Assert
8. **Use clear, descriptive test names** starting with "should"

---

## Version Compatibility Notes

**Angular 21 (Current)**:
- Vitest is default test runner
- Standalone components are recommended
- Signal-based reactivity is stable
- Use `provideHttpClient()` instead of `HttpClientModule`

**Angular 16-20**:
- Signals introduced in 16, stable in 17+
- Standalone components introduced in 14, stable in 15+
- Karma deprecated in favor of Vitest/Jest

**Angular 14 and earlier**:
- NgModule pattern only
- Use `HttpClientModule` instead of `provideHttpClient()`
- Karma + Jasmine as default test runner
