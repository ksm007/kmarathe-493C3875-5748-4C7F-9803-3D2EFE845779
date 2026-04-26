import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { AuditActions } from '../../core/store/audit/audit.actions';
import { selectAuditError, selectEntries } from '../../core/store/audit/audit.reducer';

@Component({
  selector: 'app-audit-log-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-lg">
      <div class="mb-2 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 class="font-h1 text-h1 text-on-surface">System Audit Logs</h1>
          <p class="font-body-md text-body-md text-on-surface-variant">Review all system activities, security events, and administrative actions.</p>
        </div>
        <button class="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-4 py-2 font-label-lg text-label-lg text-on-surface transition-colors hover:bg-surface-container-high" type="button">
          <span class="material-symbols-outlined text-[20px]">download</span>
          Export CSV
        </button>
      </div>

      <p *ngIf="error()" class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container">
        {{ error() }}
      </p>

      <div class="taskcore-raised p-6">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex min-w-[200px] flex-grow flex-col gap-1.5">
            <label class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Date Range</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">calendar_today</span>
              <input class="taskcore-input cursor-pointer pl-10" readonly type="text" value="Last 7 Days" />
              <span class="material-symbols-outlined pointer-events-none absolute right-3 top-2.5 text-on-surface-variant text-[20px]">arrow_drop_down</span>
            </div>
          </div>

          <div class="flex min-w-[200px] flex-grow flex-col gap-1.5">
            <label class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Event Type</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">filter_alt</span>
              <select class="taskcore-input appearance-none pl-10">
                <option>All Events</option>
                <option>Task</option>
                <option>Authentication</option>
                <option>Audit</option>
              </select>
              <span class="material-symbols-outlined pointer-events-none absolute right-3 top-2.5 text-on-surface-variant text-[20px]">arrow_drop_down</span>
            </div>
          </div>

          <div class="flex min-w-[200px] flex-grow flex-col gap-1.5">
            <label class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">User / Actor</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">person_search</span>
              <input class="taskcore-input pl-10" placeholder="Search by name or ID..." type="text" />
            </div>
          </div>

          <div class="flex flex-col gap-1.5 self-end pb-[2px]">
            <button class="flex items-center gap-2 px-4 py-2 font-label-lg text-label-lg text-primary transition-colors hover:rounded-lg hover:bg-primary-fixed" type="button">
              Clear All
            </button>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05),0_2px_6px_-2px_rgba(0,0,0,0.03)]">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="border-b border-outline-variant bg-surface-container-low font-label-lg text-label-lg text-on-surface-variant">
                <th class="whitespace-nowrap px-6 py-4 font-semibold">Timestamp (UTC)</th>
                <th class="px-6 py-4 font-semibold">Actor</th>
                <th class="px-6 py-4 font-semibold">Action</th>
                <th class="px-6 py-4 font-semibold">Resource ID</th>
                <th class="px-6 py-4 font-semibold">Organization</th>
                <th class="px-6 py-4 text-center font-semibold">Status</th>
                <th class="px-6 py-4 text-right font-semibold">Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-body-sm text-on-surface">
              <tr *ngFor="let entry of entries(); trackBy: trackById" class="taskcore-table-row group">
                <td class="whitespace-nowrap px-6 py-4 font-mono text-xs text-on-surface-variant">
                  {{ entry.createdAt | date: 'yyyy-MM-dd HH:mm:ss' }}
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-xs font-medium text-on-surface ring-1 ring-outline-variant">
                      {{ actorInitials(entry.actorEmail) }}
                    </div>
                    <div>
                      <div class="font-medium">{{ actorName(entry.actorEmail) }}</div>
                      <div class="text-xs text-on-surface-variant">{{ entry.actorEmail || 'system actor' }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]" [class.text-primary]="entry.allowed" [class.text-error]="!entry.allowed">
                      {{ entry.allowed ? 'edit_document' : 'warning' }}
                    </span>
                    <span>{{ entry.action }}</span>
                  </div>
                </td>
                <td class="px-6 py-4 font-mono text-xs text-on-surface-variant">
                  {{ entry.resourceId || entry.resource }}
                </td>
                <td class="px-6 py-4 text-sm text-on-surface-variant">
                  {{ entry.organizationId || 'n/a' }}
                </td>
                <td class="px-6 py-4 text-center">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                    [class.border-secondary-fixed-dim]="entry.allowed"
                    [class.bg-secondary-fixed]="entry.allowed"
                    [class.text-secondary]="entry.allowed"
                    [class.border-error]="!entry.allowed"
                    [class.bg-error-container]="!entry.allowed"
                    [class.text-on-error-container]="!entry.allowed"
                  >
                    <span class="h-1.5 w-1.5 rounded-full" [class.bg-secondary]="entry.allowed" [class.bg-error]="!entry.allowed"></span>
                    {{ entry.allowed ? 'Success' : 'Failed' }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <button class="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-primary-fixed hover:text-primary" [title]="entry.reason || 'No extra details'" type="button">
                    <span class="material-symbols-outlined text-[20px]">open_in_new</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between border-t border-outline-variant bg-surface-container-lowest px-6 py-4">
          <div class="text-sm text-on-surface-variant">
            Showing <span class="font-medium text-on-surface">1</span> to
            <span class="font-medium text-on-surface">{{ entries().length }}</span> of
            <span class="font-medium text-on-surface">{{ entries().length }}</span> entries
          </div>
          <div class="flex items-center gap-2">
            <button class="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container" disabled type="button">
              <span class="material-symbols-outlined">chevron_left</span>
            </button>
            <button class="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-medium text-on-primary" type="button">1</button>
            <button class="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container" disabled type="button">
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class AuditLogPageComponent {
  private readonly store = inject(Store);

  readonly entries = this.store.selectSignal(selectEntries);
  readonly error = this.store.selectSignal(selectAuditError);

  constructor() {
    this.store.dispatch(AuditActions.loadRequested({ limit: 100 }));
  }

  trackById(_index: number, entry: { id: string }) {
    return entry.id;
  }

  actorInitials(email: string | null) {
    if (!email) {
      return 'SYS';
    }

    return email.slice(0, 2).toUpperCase();
  }

  actorName(email: string | null) {
    if (!email) {
      return 'System Process';
    }

    return email
      .split('@')[0]
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
