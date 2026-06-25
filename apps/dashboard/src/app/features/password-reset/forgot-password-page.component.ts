import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen items-center justify-center bg-surface-container-low px-4 py-10">
      <main class="relative flex w-full max-w-[440px] flex-col gap-lg overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-xl shadow-soft">
        <div class="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-tertiary"></div>

        <header class="mt-sm flex flex-col items-center text-center">
          <div class="mb-md flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container text-on-primary-container shadow-sm">
            <span class="material-symbols-outlined fill text-[32px]">lock_reset</span>
          </div>
          <h1 class="font-h2 text-h2 text-on-surface">Reset Password</h1>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Enter your work email and we will send a reset link if the account exists.
          </p>
        </header>

        <form class="mt-sm flex flex-col gap-md" [formGroup]="form" (ngSubmit)="submit()">
          <label class="flex flex-col gap-xs">
            <span class="font-label-md text-label-md text-on-surface">Corporate Email</span>
            <input class="taskcore-input" formControlName="email" placeholder="name@company.com" type="email" />
          </label>

          <p
            *ngIf="message()"
            class="rounded-lg border border-primary/30 bg-primary-container px-md py-sm text-body-sm text-on-primary-container"
          >
            {{ message() }}
          </p>

          <p
            *ngIf="error()"
            class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container"
          >
            {{ error() }}
          </p>

          <button
            class="mt-sm flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 font-label-lg text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-px hover:bg-surface-tint disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
            [disabled]="form.invalid || loading()"
            type="submit"
          >
            {{ loading() ? 'Sending...' : 'Send Reset Link' }}
            <span class="material-symbols-outlined ml-2 text-[18px]">outgoing_mail</span>
          </button>
        </form>

        <p class="border-t border-outline-variant/30 pt-lg text-center font-label-sm text-label-sm text-on-surface-variant">
          Remembered your password?
          <a routerLink="/login" class="text-primary hover:underline">Sign in</a>
        </p>
      </main>
    </section>
  `,
})
export class ForgotPasswordPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.message.set(null);
    this.error.set(null);
    this.api
      .forgotPassword(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.set('If that account exists, a reset link has been sent.');
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Unable to request a reset link.');
          this.loading.set(false);
        },
      });
  }
}
