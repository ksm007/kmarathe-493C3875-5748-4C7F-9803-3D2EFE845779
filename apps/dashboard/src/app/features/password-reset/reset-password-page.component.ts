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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen items-center justify-center bg-surface-container-low px-4 py-10">
      <main class="relative flex w-full max-w-[440px] flex-col gap-lg overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-xl shadow-soft">
        <div class="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-tertiary"></div>

        <header class="mt-sm flex flex-col items-center text-center">
          <div class="mb-md flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container text-on-primary-container shadow-sm">
            <span class="material-symbols-outlined fill text-[32px]">password</span>
          </div>
          <h1 class="font-h2 text-h2 text-on-surface">Choose New Password</h1>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Reset links expire after 30 minutes and can only be used once.
          </p>
        </header>

        <p
          *ngIf="!token()"
          class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container"
        >
          This reset link is missing its token.
        </p>

        <form class="mt-sm flex flex-col gap-md" [formGroup]="form" (ngSubmit)="submit()">
          <label class="flex flex-col gap-xs">
            <span class="font-label-md text-label-md text-on-surface">New Password</span>
            <input class="taskcore-input" formControlName="newPassword" type="password" />
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
            [disabled]="form.invalid || loading() || !token() || completed()"
            type="submit"
          >
            {{ loading() ? 'Saving...' : 'Reset Password' }}
            <span class="material-symbols-outlined ml-2 text-[18px]">arrow_forward</span>
          </button>
        </form>

        <p class="border-t border-outline-variant/30 pt-lg text-center font-label-sm text-label-sm text-on-surface-variant">
          Ready to sign in?
          <a routerLink="/login" class="text-primary hover:underline">Go to login</a>
        </p>
      </main>
    </section>
  `,
})
export class ResetPasswordPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly token = signal(this.route.snapshot.queryParamMap.get('token') ?? '');
  readonly loading = signal(false);
  readonly completed = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.token.set(params.get('token') ?? ''));
  }

  submit() {
    if (this.form.invalid || !this.token()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.message.set(null);
    this.error.set(null);
    this.api
      .resetPassword({
        token: this.token(),
        newPassword: this.form.controls.newPassword.value,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.completed.set(true);
          this.message.set('Your password has been reset. Redirecting to sign in.');
          this.loading.set(false);
          setTimeout(() => void this.router.navigateByUrl('/login'), 1200);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Unable to reset password.');
          this.loading.set(false);
        },
      });
  }
}
