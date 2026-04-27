import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../core/store/auth/auth.actions';
import { selectError, selectLoading } from '../../core/store/auth/auth.reducer';
import { selectIsAuthenticated } from '../../core/store/auth/auth.selectors';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-signup-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen items-center justify-center bg-surface-container-low px-4 py-10">
      <main class="relative flex w-full max-w-[480px] flex-col gap-lg overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-xl shadow-soft">
        <div class="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-tertiary"></div>

        <header class="mt-sm flex flex-col items-center text-center">
          <div class="mb-md flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container text-on-primary-container shadow-sm">
            <span class="material-symbols-outlined fill text-[32px]">task_alt</span>
          </div>
          <h1 class="font-h2 text-h2 text-on-surface">Create your account</h1>
          <p class="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            You'll be set up as the <strong>Owner</strong> of your organisation.
          </p>
        </header>

        <form class="mt-sm flex flex-col gap-md" [formGroup]="form" (ngSubmit)="submit()">

          <!-- Full name -->
          <div class="flex flex-col gap-xs">
            <label class="font-label-md text-label-md text-on-surface" for="fullName">Full Name</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-outline">person</span>
              <input
                id="fullName"
                class="taskcore-input pl-10"
                formControlName="fullName"
                placeholder="Jane Smith"
                type="text"
                autocomplete="name"
              />
            </div>
            <p *ngIf="f['fullName'].touched && f['fullName'].errors?.['required']"
               class="text-xs text-error">Full name is required.</p>
          </div>

          <!-- Organisation name -->
          <div class="flex flex-col gap-xs">
            <label class="font-label-md text-label-md text-on-surface" for="organizationName">Organisation Name</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-outline">business</span>
              <input
                id="organizationName"
                class="taskcore-input pl-10"
                formControlName="organizationName"
                placeholder="Acme Corp"
                type="text"
              />
            </div>
            <p *ngIf="f['organizationName'].touched && f['organizationName'].errors?.['required']"
               class="text-xs text-error">Organisation name is required.</p>
          </div>

          <!-- Email -->
          <div class="flex flex-col gap-xs">
            <label class="font-label-md text-label-md text-on-surface" for="email">Work Email</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-outline">mail</span>
              <input
                id="email"
                class="taskcore-input pl-10"
                formControlName="email"
                placeholder="jane@acme.com"
                type="email"
                autocomplete="email"
              />
            </div>
            <p *ngIf="f['email'].touched && f['email'].errors?.['email']"
               class="text-xs text-error">Enter a valid email address.</p>
          </div>

          <!-- Password -->
          <div class="flex flex-col gap-xs">
            <label class="font-label-md text-label-md text-on-surface" for="password">Password</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-outline">lock</span>
              <input
                id="password"
                class="taskcore-input pl-10"
                formControlName="password"
                placeholder="Min 8 characters"
                type="password"
                autocomplete="new-password"
              />
            </div>
            <p *ngIf="f['password'].touched && f['password'].errors?.['minlength']"
               class="text-xs text-error">Password must be at least 8 characters.</p>
          </div>

          <!-- Confirm password -->
          <div class="flex flex-col gap-xs">
            <label class="font-label-md text-label-md text-on-surface" for="confirmPassword">Confirm Password</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-outline">lock_reset</span>
              <input
                id="confirmPassword"
                class="taskcore-input pl-10"
                formControlName="confirmPassword"
                placeholder="Repeat password"
                type="password"
                autocomplete="new-password"
              />
            </div>
            <p *ngIf="f['confirmPassword'].touched && form.errors?.['passwordMismatch']"
               class="text-xs text-error">Passwords do not match.</p>
          </div>

          <!-- Server error -->
          <p *ngIf="error()"
             class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container">
            {{ error() }}
          </p>

          <button
            class="mt-sm flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-label-lg text-label-lg text-on-primary shadow-sm transition-all duration-200 hover:-translate-y-px hover:bg-surface-tint disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
            [disabled]="form.invalid || loading()"
            type="submit"
          >
            {{ loading() ? 'Creating account...' : 'Create account' }}
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>

        <p class="text-center font-label-sm text-label-sm text-on-surface-variant">
          Already have an account?
          <a routerLink="/login" class="text-primary hover:underline">Sign in</a>
        </p>
      </main>
    </section>
  `,
})
export class SignupPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = this.store.selectSignal(selectLoading);
  readonly error = this.store.selectSignal(selectError);

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      organizationName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch }
  );

  get f() {
    return this.form.controls;
  }

  constructor() {
    this.store
      .select(selectIsAuthenticated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((authed) => {
        if (authed) void this.router.navigateByUrl('/tasks');
      });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { confirmPassword, ...payload } = this.form.getRawValue();
    this.store.dispatch(AuthActions.registerRequested({ payload }));
  }
}
