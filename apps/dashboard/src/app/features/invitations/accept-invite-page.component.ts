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
import { Store } from '@ngrx/store';
import { ApiService } from '../../core/services/api.service';
import { AuthActions } from '../../core/store/auth/auth.actions';
import { selectIsAuthenticated } from '../../core/store/auth/auth.selectors';

@Component({
  selector: 'app-accept-invite-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen items-center justify-center bg-surface-container-low px-4 py-10">
      <main class="relative flex w-full max-w-[440px] flex-col gap-lg overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-xl shadow-soft">
        <div class="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-tertiary"></div>

        <header class="mt-sm flex flex-col items-center text-center">
          <div class="mb-md flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container text-on-primary-container shadow-sm">
            <span class="material-symbols-outlined fill text-[32px]">group_add</span>
          </div>
          <h1 class="font-h2 text-h2 text-on-surface">Accept Invitation</h1>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Create your account to join the workspace.
          </p>
        </header>

        <p
          *ngIf="!token()"
          class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container"
        >
          This invite link is missing its token.
        </p>

        <form class="mt-sm flex flex-col gap-md" [formGroup]="form" (ngSubmit)="submit()">
          <label class="flex flex-col gap-xs">
            <span class="font-label-md text-label-md text-on-surface">Full Name</span>
            <input class="taskcore-input" formControlName="fullName" type="text" />
          </label>

          <label class="flex flex-col gap-xs">
            <span class="font-label-md text-label-md text-on-surface">Password</span>
            <input class="taskcore-input" formControlName="password" type="password" />
          </label>

          <p
            *ngIf="error()"
            class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container"
          >
            {{ error() }}
          </p>

          <button
            class="mt-sm flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 font-label-lg text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-px hover:bg-surface-tint disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
            [disabled]="form.invalid || loading() || !token()"
            type="submit"
          >
            {{ loading() ? 'Joining...' : 'Join Workspace' }}
            <span class="material-symbols-outlined ml-2 text-[18px]">arrow_forward</span>
          </button>
        </form>

        <p class="border-t border-outline-variant/30 pt-lg text-center font-label-sm text-label-sm text-on-surface-variant">
          Already have an account?
          <a routerLink="/login" class="text-primary hover:underline">Sign in</a>
        </p>
      </main>
    </section>
  `,
})
export class AcceptInvitePageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);

  readonly token = signal(this.route.snapshot.queryParamMap.get('token') ?? '');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.token.set(params.get('token') ?? ''));

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
    if (this.form.invalid || !this.token()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.api
      .acceptInvitation({
        token: this.token(),
        ...this.form.getRawValue(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.store.dispatch(
            AuthActions.loginSuccess({
              token: response.accessToken,
              user: response.user,
            }),
          );
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Unable to accept this invite.');
          this.loading.set(false);
        },
      });
  }
}
