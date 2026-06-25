import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AcceptanceCriteriaItem,
  Role,
  TaskActivityType,
  TaskDetail,
} from '@nx-temp/data';
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
              <dt class="text-xs uppercase tracking-wider text-on-surface-variant">Epic</dt>
              <dd class="mt-2 text-sm text-on-surface">{{ task()!.parentEpicTitle || 'None' }}</dd>
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

          <div class="mt-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="font-label-lg text-on-surface">Attachments</h2>
                <p class="mt-1 text-xs text-on-surface-variant">
                  PNG, JPEG, and WebP images only.
                </p>
              </div>
              <label
                *ngIf="canComment()"
                class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low"
              >
                <span class="material-symbols-outlined text-[18px]">upload</span>
                {{ uploadingAttachment() ? 'Uploading...' : 'Upload image' }}
                <input
                  class="hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  [disabled]="uploadingAttachment()"
                  (change)="uploadAttachment($event)"
                />
              </label>
            </div>

            <p
              *ngIf="attachmentError()"
              class="mt-3 rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container"
            >
              {{ attachmentError() }}
            </p>

            <div
              *ngIf="task()!.attachments.length > 0; else noAttachments"
              class="mt-4 grid gap-4 sm:grid-cols-2"
            >
              <article
                *ngFor="let attachment of task()!.attachments"
                class="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low"
              >
                <a
                  class="block bg-surface-container"
                  [href]="attachmentUrl(attachment.id)"
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    class="h-44 w-full object-cover"
                    [alt]="attachment.fileName"
                    [src]="attachmentUrl(attachment.id)"
                  />
                </a>
                <div class="flex items-center justify-between gap-3 p-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-on-surface">
                      {{ attachment.fileName }}
                    </p>
                    <p class="mt-1 text-xs text-on-surface-variant">
                      {{ formatBytes(attachment.byteSize) }} ·
                      {{ relativeTimestamp(attachment.createdAt) }}
                    </p>
                  </div>
                  <button
                    *ngIf="canComment()"
                    class="taskcore-danger-button"
                    type="button"
                    [disabled]="uploadingAttachment()"
                    (click)="deleteAttachment(attachment.id)"
                  >
                    Delete
                  </button>
                </div>
              </article>
            </div>

            <ng-template #noAttachments>
              <p class="mt-3 text-sm text-on-surface-variant">
                No image attachments yet.
              </p>
            </ng-template>
          </div>

          <div class="mt-6">
            <div class="flex items-center justify-between gap-3">
              <h2 class="font-label-lg text-on-surface">Acceptance Criteria</h2>
              <span class="text-xs text-on-surface-variant">
                {{ completedCriteriaCount() }} / {{ task()!.acceptanceCriteria.length }} complete
              </span>
            </div>

            <div class="mt-3 space-y-2">
              <label
                *ngFor="let item of task()!.acceptanceCriteria"
                class="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-3 text-sm text-on-surface"
              >
                <input
                  class="mt-1 h-4 w-4"
                  type="checkbox"
                  [checked]="item.completed"
                  [disabled]="!canComment()"
                  (change)="toggleCriteria(item, $any($event.target).checked)"
                />
                <span [class.line-through]="item.completed">{{ item.text }}</span>
              </label>

              <p *ngIf="task()!.acceptanceCriteria.length === 0" class="text-sm text-on-surface-variant">
                No acceptance criteria yet.
              </p>
            </div>

            <form
              *ngIf="canComment()"
              class="mt-4 flex flex-col gap-3 sm:flex-row"
              [formGroup]="criteriaForm"
              (ngSubmit)="addCriteria()"
            >
              <input
                class="taskcore-input flex-1"
                formControlName="text"
                placeholder="Add a criterion"
              />
              <button
                class="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
                type="submit"
              >
                Add
              </button>
            </form>
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
  readonly attachmentError = signal<string | null>(null);
  readonly uploadingAttachment = signal(false);
  readonly user = this.store.selectSignal(selectUser);
  readonly canComment = computed(() => this.user()?.role !== Role.Viewer);
  readonly completedCriteriaCount = computed(
    () =>
      this.task()?.acceptanceCriteria.filter((item) => item.completed).length ??
      0,
  );

  readonly commentForm = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.maxLength(2000)]],
  });
  readonly criteriaForm = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.maxLength(240)]],
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
      await this.refreshTask(task.id);
      this.commentForm.reset({ message: '' });
    } catch {
      this.error.set('Unable to add comment.');
    }
  }

  async toggleCriteria(item: AcceptanceCriteriaItem, completed: boolean) {
    const task = this.task();
    if (!task || !this.canComment()) {
      return;
    }

    const acceptanceCriteria = task.acceptanceCriteria.map((candidate) =>
      candidate.id === item.id ? { ...candidate, completed } : candidate,
    );
    await this.updateAcceptanceCriteria(acceptanceCriteria);
  }

  async addCriteria() {
    const task = this.task();
    if (!task || this.criteriaForm.invalid || !this.canComment()) {
      return;
    }

    const text = this.criteriaForm.getRawValue().text.trim();
    if (!text) {
      return;
    }

    await this.updateAcceptanceCriteria([
      ...task.acceptanceCriteria,
      { id: '', text, completed: false },
    ]);
    this.criteriaForm.reset({ text: '' });
  }

  async uploadAttachment(event: Event) {
    const task = this.task();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!task || !file || !this.canComment()) {
      return;
    }

    this.attachmentError.set(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.attachmentError.set('Only PNG, JPEG, and WebP images are supported.');
      return;
    }

    this.uploadingAttachment.set(true);
    try {
      await firstValueFrom(this.api.addTaskAttachment(task.id, file));
      await this.refreshTask(task.id);
    } catch {
      this.attachmentError.set('Unable to upload image attachment.');
    } finally {
      this.uploadingAttachment.set(false);
    }
  }

  async deleteAttachment(attachmentId: string) {
    const task = this.task();
    if (!task || !this.canComment()) {
      return;
    }

    this.attachmentError.set(null);
    this.uploadingAttachment.set(true);
    try {
      await firstValueFrom(this.api.deleteTaskAttachment(task.id, attachmentId));
      await this.refreshTask(task.id);
    } catch {
      this.attachmentError.set('Unable to delete image attachment.');
    } finally {
      this.uploadingAttachment.set(false);
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
      case TaskActivityType.EpicChanged:
        return 'Epic';
      case TaskActivityType.SprintChanged:
        return 'Sprint';
      case TaskActivityType.AcceptanceCriteriaChanged:
        return 'Criteria';
      case TaskActivityType.Comment:
        return 'Comment';
    }
  }

  private async updateAcceptanceCriteria(
    acceptanceCriteria: AcceptanceCriteriaItem[],
  ) {
    const task = this.task();
    if (!task) {
      return;
    }

    try {
      await firstValueFrom(
        this.api.updateTask(task.id, {
          acceptanceCriteria,
        }),
      );
      await this.refreshTask(task.id);
    } catch {
      this.error.set('Unable to update acceptance criteria.');
    }
  }

  private async refreshTask(taskId: string) {
    const refreshed = await firstValueFrom(this.api.getTaskDetail(taskId));
    this.task.set(refreshed ?? null);
  }

  attachmentUrl(attachmentId: string) {
    const task = this.task();
    return task ? this.api.taskAttachmentContentUrl(task.id, attachmentId) : '';
  }

  formatBytes(bytes: number) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
