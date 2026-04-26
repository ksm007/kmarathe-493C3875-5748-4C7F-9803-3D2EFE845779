import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../core/store/auth/auth.actions';
import { selectError, selectLoading } from '../../core/store/auth/auth.reducer';
import { selectIsAuthenticated } from '../../core/store/auth/auth.selectors';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen items-center justify-center bg-surface-container-low px-4 py-10">
      <main class="relative flex w-full max-w-[440px] flex-col gap-lg overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-xl shadow-soft">
        <div class="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-tertiary"></div>

        <header class="mt-sm flex flex-col items-center text-center">
          <div class="mb-md flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container text-on-primary-container shadow-sm">
            <span class="material-symbols-outlined fill text-[32px]">task_alt</span>
          </div>
          <h1 class="font-h2 text-h2 text-on-surface">Welcome Back</h1>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Secure Access to TaskSphere OS</p>
        </header>

        <form class="mt-sm flex flex-col gap-md" [formGroup]="form" (ngSubmit)="submit()">
          <div class="flex flex-col gap-xs">
            <label class="font-label-md text-label-md text-on-surface" for="email">Corporate Email</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-outline">mail</span>
              <input id="email" class="taskcore-input pl-10" formControlName="email" placeholder="name@company.com" type="email" />
            </div>
          </div>

          <div class="flex flex-col gap-xs">
            <div class="flex items-center justify-between">
              <label class="font-label-md text-label-md text-on-surface" for="password">Password</label>
              <button class="font-label-sm text-label-sm text-primary transition-colors hover:text-surface-tint" type="button">Forgot password?</button>
            </div>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-outline">lock</span>
              <input id="password" class="taskcore-input pl-10" formControlName="password" placeholder="••••••••" type="password" />
            </div>
          </div>

          <div class="mt-sm flex flex-col gap-lg">
            <div class="flex items-center justify-between gap-3">
              <label class="flex items-center gap-2">
                <input class="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                <span class="font-body-sm text-body-sm text-on-surface-variant">Remember me on this device</span>
              </label>
              <span class="font-label-sm text-label-sm text-primary">owner@acme.test</span>
            </div>

            <p *ngIf="error()" class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container">
              {{ error() }}
            </p>

            <button
              class="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 font-label-lg text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-px hover:bg-surface-tint disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
              [disabled]="form.invalid || loading()"
              type="submit"
            >
              {{ loading() ? 'Signing In...' : 'Sign In' }}
              <span class="material-symbols-outlined ml-2 text-[18px]">arrow_forward</span>
            </button>
          </div>
        </form>

        <div class="mt-sm flex flex-col gap-md border-t border-outline-variant/30 pt-lg">
          <button class="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface px-4 py-3 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low" type="button">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            Continue with SSO
          </button>
          <p class="text-center font-label-sm text-label-sm text-on-surface-variant">
            Having trouble accessing your account?
            <button class="text-primary hover:underline" type="button">Contact IT Support</button>
          </p>
        </div>
      </main>
    </section>
  `,
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = this.store.selectSignal(selectLoading);
  readonly error = this.store.selectSignal(selectError);

  readonly form = this.fb.nonNullable.group({
    email: ['owner@acme.test', [Validators.required, Validators.email]],
    password: ['Password123!', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.store
      .select(selectIsAuthenticated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isAuthenticated) => {
        if (isAuthenticated) {
          void this.router.navigateByUrl('/tasks');
        }
      });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.store.dispatch(AuthActions.loginRequested({ credentials: this.form.getRawValue() }));
  }
}
