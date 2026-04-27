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
import { Role, UserSummary } from '@nx-temp/data';
import { Store } from '@ngrx/store';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { selectUser } from '../../core/store/auth/auth.reducer';

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex h-full flex-col gap-8">

      <!-- Header -->
      <div class="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 class="font-h1 text-h1 text-on-background">Team Members</h1>
          <p class="mt-1 flex items-center gap-2 text-body-sm text-on-surface-variant">
            <span class="h-2 w-2 rounded-full bg-secondary"></span>
            {{ members().length }} member{{ members().length === 1 ? '' : 's' }} in
            {{ currentUser()?.organizationName }}
          </p>
        </div>
      </div>

      <div class="grid gap-8 xl:grid-cols-[1fr_380px]">

        <!-- Member list -->
        <div class="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-outline-variant bg-surface-container-low font-label-lg text-label-lg text-on-surface-variant">
                  <th class="px-6 py-4 font-semibold">Name</th>
                  <th class="px-6 py-4 font-semibold">Email</th>
                  <th class="px-6 py-4 font-semibold">Role</th>
                  <th class="px-6 py-4 font-semibold">Organisation</th>
                  <th class="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-body-sm text-on-surface">
                <tr *ngFor="let member of members()" class="taskcore-table-row">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container font-semibold text-on-primary-container text-sm">
                        {{ member.fullName.charAt(0).toUpperCase() }}
                      </div>
                      <span class="font-medium text-on-surface">{{ member.fullName }}</span>
                      <span *ngIf="member.id === currentUser()?.id"
                            class="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                        You
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-on-surface-variant">{{ member.email }}</td>
                  <td class="px-6 py-4">
                    <span class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          [class.bg-error-container]="member.role === Role.Owner"
                          [class.text-on-error-container]="member.role === Role.Owner"
                          [class.bg-primary-container]="member.role === Role.Admin"
                          [class.text-on-primary-container]="member.role === Role.Admin"
                          [class.bg-surface-container-high]="member.role === Role.Viewer"
                          [class.text-on-surface-variant]="member.role === Role.Viewer">
                      {{ member.role }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-on-surface-variant">{{ member.organizationName }}</td>
                  <td class="px-6 py-4">
                    <div class="flex justify-end">
                      <button
                        *ngIf="canRemove(member)"
                        class="taskcore-danger-button"
                        type="button"
                        (click)="removeMember(member)"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="members().length === 0">
                  <td colspan="5" class="px-6 py-10 text-center text-on-surface-variant">
                    No team members yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Add member form -->
        <div class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card">
          <h2 class="mb-1 font-h3 text-h3 text-on-surface">Add a team member</h2>
          <p class="mb-6 text-body-sm text-on-surface-variant">
            They can sign in immediately with the credentials you set.
            <span *ngIf="currentUser()?.role === Role.Admin" class="block mt-1 text-outline">
              As an Admin you can add Admins and Viewers.
            </span>
          </p>

          <form class="flex flex-col gap-md" [formGroup]="form" (ngSubmit)="addMember()">

            <label class="flex flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Full Name</span>
              <input class="taskcore-input" formControlName="fullName" placeholder="Jane Smith" type="text" />
            </label>

            <label class="flex flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Work Email</span>
              <input class="taskcore-input" formControlName="email" placeholder="jane@company.com" type="email" />
            </label>

            <label class="flex flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Temporary Password</span>
              <input class="taskcore-input" formControlName="password" placeholder="Min 8 characters" type="password" />
              <span class="text-xs text-on-surface-variant">Share this with the member — they can update it later.</span>
            </label>

            <label class="flex flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Role</span>
              <select class="taskcore-input" formControlName="role">
                <option *ngFor="let r of assignableRoles()" [value]="r">{{ r | titlecase }}</option>
              </select>
            </label>

            <p *ngIf="formError()"
               class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container">
              {{ formError() }}
            </p>

            <button
              class="mt-sm flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-label-lg text-label-lg text-on-primary transition-all hover:-translate-y-px hover:bg-surface-tint disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
              [disabled]="form.invalid || saving()"
              type="submit"
            >
              {{ saving() ? 'Adding...' : 'Add member' }}
              <span class="material-symbols-outlined text-[18px]">person_add</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  `,
})
export class TeamPageComponent {
  protected readonly Role = Role;

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.store.selectSignal(selectUser);
  readonly members = signal<UserSummary[]>([]);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: [Role.Viewer, Validators.required],
  });

  constructor() {
    this.loadMembers();
  }

  assignableRoles(): Role[] {
    return this.currentUser()?.role === Role.Owner
      ? [Role.Owner, Role.Admin, Role.Viewer]
      : [Role.Admin, Role.Viewer];
  }

  canRemove(member: UserSummary): boolean {
    const me = this.currentUser();
    if (!me || member.id === me.id) return false;
    // Admin cannot remove Owner
    if (me.role === Role.Admin && member.role === Role.Owner) return false;
    return true;
  }

  addMember() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    this.api
      .createTeamMember(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (newMember) => {
          this.members.update((list) => [...list, newMember]);
          this.form.reset({ fullName: '', email: '', password: '', role: Role.Viewer });
          this.toast.success('Member added', `${newMember.fullName} can now sign in.`);
          this.saving.set(false);
        },
        error: (err) => {
          this.formError.set(err?.error?.message ?? 'Failed to add member. Please try again.');
          this.saving.set(false);
        },
      });
  }

  removeMember(member: UserSummary) {
    this.api
      .removeTeamMember(member.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.members.update((list) => list.filter((m) => m.id !== member.id));
          this.toast.success('Member removed', `${member.fullName} has been removed.`);
        },
        error: (err) => {
          this.toast.error('Remove failed', err?.error?.message ?? 'Unable to remove member.');
        },
      });
  }

  private loadMembers() {
    this.api
      .listUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((members) => this.members.set(members));
  }
}
