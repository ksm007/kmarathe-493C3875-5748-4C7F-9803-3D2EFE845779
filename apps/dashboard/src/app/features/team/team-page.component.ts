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
import { InvitationResponse, Role, UserSummary } from '@nx-temp/data';
import { Store } from '@ngrx/store';
import { forkJoin } from 'rxjs';
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
      <div class="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 class="font-h1 text-h1 text-on-background">Team Members</h1>
          <p class="mt-1 flex items-center gap-2 text-body-sm text-on-surface-variant">
            <span class="h-2 w-2 rounded-full bg-secondary"></span>
            {{ members().length }} member{{ members().length === 1 ? '' : 's' }} and
            {{ pendingInvitations().length }} pending invite{{ pendingInvitations().length === 1 ? '' : 's' }} in
            {{ currentUser()?.organizationName }}
          </p>
        </div>
      </div>

      <div class="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div class="space-y-6">
          <div class="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card">
            <div class="border-b border-outline-variant bg-surface-container-low px-6 py-4">
              <h2 class="font-h3 text-h3 text-on-surface">Members</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-left">
                <thead>
                  <tr class="border-b border-outline-variant bg-surface-container-low font-label-lg text-label-lg text-on-surface-variant">
                    <th class="px-6 py-4 font-semibold">Name</th>
                    <th class="px-6 py-4 font-semibold">Email</th>
                    <th class="px-6 py-4 font-semibold">Role</th>
                    <th class="px-6 py-4 font-semibold">Organization</th>
                    <th class="px-6 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-body-sm text-on-surface">
                  <tr *ngFor="let member of members(); trackBy: trackByMemberId" class="taskcore-table-row">
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
                          {{ member.fullName.charAt(0).toUpperCase() }}
                        </div>
                        <span class="font-medium text-on-surface">{{ member.fullName }}</span>
                        <span
                          *ngIf="member.id === currentUser()?.id"
                          class="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant"
                        >
                          You
                        </span>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-on-surface-variant">{{ member.email }}</td>
                    <td class="px-6 py-4">
                      <span
                        class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        [class.bg-error-container]="member.role === Role.Owner"
                        [class.text-on-error-container]="member.role === Role.Owner"
                        [class.bg-primary-container]="member.role === Role.Admin"
                        [class.text-on-primary-container]="member.role === Role.Admin"
                        [class.bg-surface-container-high]="member.role === Role.Viewer"
                        [class.text-on-surface-variant]="member.role === Role.Viewer"
                      >
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

          <div class="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card">
            <div class="border-b border-outline-variant bg-surface-container-low px-6 py-4">
              <h2 class="font-h3 text-h3 text-on-surface">Invitations</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-left">
                <thead>
                  <tr class="border-b border-outline-variant bg-surface-container-low font-label-lg text-label-lg text-on-surface-variant">
                    <th class="px-6 py-4 font-semibold">Email</th>
                    <th class="px-6 py-4 font-semibold">Role</th>
                    <th class="px-6 py-4 font-semibold">Status</th>
                    <th class="px-6 py-4 font-semibold">Expires</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-body-sm text-on-surface">
                  <tr *ngFor="let invitation of invitations(); trackBy: trackByInvitationId" class="taskcore-table-row">
                    <td class="px-6 py-4 font-medium text-on-surface">{{ invitation.email }}</td>
                    <td class="px-6 py-4 text-on-surface-variant">{{ invitation.role }}</td>
                    <td class="px-6 py-4">
                      <span
                        class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        [class.bg-primary-container]="invitation.status === 'pending'"
                        [class.text-on-primary-container]="invitation.status === 'pending'"
                        [class.bg-surface-container-high]="invitation.status !== 'pending'"
                        [class.text-on-surface-variant]="invitation.status !== 'pending'"
                      >
                        {{ invitation.status }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-on-surface-variant">
                      {{ invitation.expiresAt | date: 'mediumDate' }}
                    </td>
                  </tr>
                  <tr *ngIf="invitations().length === 0">
                    <td colspan="4" class="px-6 py-10 text-center text-on-surface-variant">
                      No invitations yet.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card">
          <h2 class="mb-1 font-h3 text-h3 text-on-surface">Invite a team member</h2>
          <p class="mb-6 text-body-sm text-on-surface-variant">
            The backend creates a single-use invite and sends it by email.
            <span *ngIf="currentUser()?.role === Role.Admin" class="mt-1 block text-outline">
              As an Admin you can invite Admins and Viewers.
            </span>
          </p>

          <form class="flex flex-col gap-md" [formGroup]="form" (ngSubmit)="sendInvite()">
            <label class="flex flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Work Email</span>
              <input class="taskcore-input" formControlName="email" placeholder="jane@company.com" type="email" />
            </label>

            <label class="flex flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Role</span>
              <select class="taskcore-input" formControlName="role">
                <option *ngFor="let r of assignableRoles()" [value]="r">{{ r | titlecase }}</option>
              </select>
            </label>

            <p
              *ngIf="formError()"
              class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container"
            >
              {{ formError() }}
            </p>

            <button
              class="mt-sm flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-label-lg text-label-lg text-on-primary transition-all hover:-translate-y-px hover:bg-surface-tint disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
              [disabled]="form.invalid || saving()"
              type="submit"
            >
              {{ saving() ? 'Sending...' : 'Send invite' }}
              <span class="material-symbols-outlined text-[18px]">outgoing_mail</span>
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
  readonly invitations = signal<InvitationResponse[]>([]);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: [Role.Viewer, Validators.required],
  });

  constructor() {
    this.loadTeam();
  }

  pendingInvitations() {
    return this.invitations().filter((invitation) => invitation.status === 'pending');
  }

  assignableRoles(): Role[] {
    return this.currentUser()?.role === Role.Owner
      ? [Role.Owner, Role.Admin, Role.Viewer]
      : [Role.Admin, Role.Viewer];
  }

  canRemove(member: UserSummary): boolean {
    const me = this.currentUser();
    if (!me || member.id === me.id) return false;
    if (me.role === Role.Admin && member.role === Role.Owner) return false;
    return true;
  }

  sendInvite() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    this.api
      .createInvitation(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const email = this.form.controls.email.value;
          this.form.reset({ email: '', role: Role.Viewer });
          this.toast.success('Invite sent', `${email} can accept from their email.`);
          this.loadTeam();
        },
        error: (err) => {
          this.formError.set(err?.error?.message ?? 'Failed to send invite. Please try again.');
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

  trackByMemberId(_: number, member: UserSummary) {
    return member.id;
  }

  trackByInvitationId(_: number, invitation: InvitationResponse) {
    return invitation.id;
  }

  private loadTeam() {
    forkJoin({
      members: this.api.listUsers(),
      invitations: this.api.listInvitations(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ members, invitations }) => {
          this.members.set(members);
          this.invitations.set(invitations);
          this.saving.set(false);
        },
        error: () => {
          this.toast.error('Team unavailable', 'Unable to load team members and invitations.');
          this.saving.set(false);
        },
      });
  }
}
