import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Role, TaskActivityType, TaskDetail } from '@nx-temp/data';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { selectUser } from '../../core/store/auth/auth.reducer';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      <a routerLink="/tasks" class="inline-flex items-center gap-2 text-sm text-primary">
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to tasks
      </a>

      <div *ngIf="task(); else loadingState" class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-sm uppercase tracking-[0.18em] text-on-surface-variant">{{ task()!.id }}</p>
              <h1 class="mt-2 font-h2 text-h2 text-on-surface">{{ task()!.title }}</h1>
              <p class="mt-3 text-sm leading-6 text-on-surface-variant">{{ task()!.description || 'No description provided.' }}</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <span class="rounded-full bg-primary-container px-3 py-1 text-xs font-semibold text-on-primary-container">{{ task()!.status }}</span>
              <span class="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface">{{ task()!.priority }}</span>
            </div>
          </div>

          <dl class="mt-6 grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl bg-surface-container-low p-4">
              <dt class="text-xs uppercase tracking-wider text-on-surface-variant">Organization</dt>
              <dd class="mt-2 text-sm text-on-surface">{{ task()!.organizationName }}</dd>
            </div>
            <div class="rounded-xl bg-surface-container-low p-4">
              <dt class="text-xs uppercase tracking-wider text-on-surface-variant">Created By</dt>
              <dd class="mt-2 text-sm text-on-surface">{{ task()!.createdByName }}</dd>
            </div>
            <div class="rounded-xl bg-surface-container-low p-4">
              <dt class="text-xs uppercase tracking-wider text-on-surface-variant">Assignee</dt>
              <dd class="mt-2 text-sm text-on-surface">{{ task()!.assigneeName || 'Unassigned' }}</dd>
            </div>
            <div class="rounded-xl bg-surface-container-low p-4">
              <dt class="text-xs uppercase tracking-wider text-on-surface-variant">Due Date</dt>
              <dd class="mt-2 text-sm text-on-surface">{{ task()!.dueDate || 'None' }}</dd>
            </div>
          </dl>

          <div class="mt-6">
            <h2 class="font-label-lg text-on-surface">Tags</h2>
            <div class="mt-3 flex flex-wrap gap-2">
              <span *ngFor="let tag of task()!.tags" class="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface">
                #{{ tag }}
              </span>
              <span *ngIf="task()!.tags.length === 0" class="text-sm text-on-surface-variant">No tags yet.</span>
            </div>
          </div>
        </article>

        <aside class="space-y-6">
          <section class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card">
            <div class="flex items-center justify-between">
              <h2 class="font-label-lg text-on-surface">Activity</h2>
              <span class="text-xs text-on-surface-variant">{{ task()!.activities.length }} events</span>
            </div>

            <ol class="mt-5 space-y-4">
              <li *ngFor="let activity of task()!.activities" class="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-xs font-semibold uppercase tracking-wider text-primary">{{ labelForActivity(activity.type) }}</span>
                  <span class="text-xs text-on-surface-variant">{{ relativeTimestamp(activity.createdAt) }}</span>
                </div>
                <p class="mt-3 text-sm text-on-surface">{{ activity.message }}</p>
                <p *ngIf="activity.actorName" class="mt-2 text-xs text-on-surface-variant">By {{ activity.actorName }}</p>
              </li>
            </ol>
          </section>

          <section *ngIf="canComment()" class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card">
            <h2 class="font-label-lg text-on-surface">Add Comment</h2>
            <form class="mt-4 space-y-3" [formGroup]="commentForm" (ngSubmit)="submitComment()">
              <textarea class="min-h-28 w-full rounded-xl border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface outline-none" formControlName="message"></textarea>
              <button class="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary" type="submit">
                Post Comment
              </button>
            </form>
          </section>
        </aside>
      </div>
    </section>

    <ng-template #loadingState>
      <div class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
        {{ error() || 'Loading task details...' }}
      </div>
    </ng-template>
  `,
})
export class TaskDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);

  readonly task = signal<TaskDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly user = this.store.selectSignal(selectUser);
  readonly canComment = computed(() => this.user()?.role !== Role.Viewer);

  readonly commentForm = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  constructor() {
    this.route.paramMap.subscribe(async (params) => {
      const id = params.get('id');
      if (!id) {
        this.error.set('Task not found.');
        return;
      }

      try {
        const task = await firstValueFrom(this.api.getTaskDetail(id));
        this.task.set(task ?? null);
      } catch {
        this.error.set('Unable to load task details.');
      }
    });
  }

  async submitComment() {
    const task = this.task();
    if (!task || this.commentForm.invalid) {
      return;
    }

    try {
      await firstValueFrom(this.api.addTaskComment(task.id, this.commentForm.getRawValue().message));
      const refreshed = await firstValueFrom(this.api.getTaskDetail(task.id));
      this.task.set(refreshed ?? null);
      this.commentForm.reset({ message: '' });
    } catch {
      this.error.set('Unable to add comment.');
    }
  }

  labelForActivity(type: TaskActivityType) {
    switch (type) {
      case TaskActivityType.TaskCreated:
        return 'Created';
      case TaskActivityType.TaskUpdated:
        return 'Updated';
      case TaskActivityType.StatusChanged:
        return 'Status';
      case TaskActivityType.Comment:
        return 'Comment';
    }
  }

  relativeTimestamp(value: string) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
