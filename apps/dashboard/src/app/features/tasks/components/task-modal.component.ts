import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AcceptanceCriteriaItem,
  IssueType,
  Task,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  UserSummary,
} from '@nx-temp/data';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      *ngIf="open"
      class="fixed inset-0 z-50 grid place-items-center bg-background/70 px-4 backdrop-blur-sm"
    >
      <div
        class="relative w-full max-w-xl overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-[0_24px_60px_rgba(11,28,48,0.2)]"
      >
        <div
          class="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-tertiary"
        ></div>

        <div
          class="flex items-center justify-between border-b border-outline-variant/50 pb-md pt-sm"
        >
          <div>
            <p class="font-label-lg text-label-lg text-on-surface-variant">
              {{ task ? 'Edit task' : 'New task' }}
            </p>
            <h2 class="mt-2 font-h2 text-h2 text-on-surface">
              {{ task ? task.title : 'Create a new task' }}
            </h2>
          </div>
          <button
            class="rounded-full border border-outline-variant p-2 text-on-surface-variant transition hover:bg-surface-container-low"
            type="button"
            (click)="closed.emit()"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form
          class="mt-lg grid gap-md"
          [formGroup]="form"
          (ngSubmit)="submit()"
        >
          <label class="flex flex-col gap-xs">
            <span
              class="font-label-caps text-label-caps uppercase text-on-surface-variant"
              >Title</span
            >
            <input class="taskcore-input" formControlName="title" />
          </label>

          <label class="flex flex-col gap-xs">
            <span
              class="font-label-caps text-label-caps uppercase text-on-surface-variant"
              >Description</span
            >
            <textarea
              class="taskcore-input min-h-28"
              formControlName="description"
            ></textarea>
          </label>

          <div class="grid gap-md md:grid-cols-4">
            <label class="flex flex-col gap-xs">
              <span
                class="font-label-caps text-label-caps uppercase text-on-surface-variant"
                >Issue Type</span
              >
              <select class="taskcore-input" formControlName="issueType">
                <option *ngFor="let option of issueTypeOptions" [value]="option">
                  {{ option }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-xs">
              <span
                class="font-label-caps text-label-caps uppercase text-on-surface-variant"
                >Category</span
              >
              <select class="taskcore-input" formControlName="category">
                <option *ngFor="let option of categoryOptions" [value]="option">
                  {{ option }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-xs">
              <span
                class="font-label-caps text-label-caps uppercase text-on-surface-variant"
                >Priority</span
              >
              <select class="taskcore-input" formControlName="priority">
                <option *ngFor="let option of priorityOptions" [value]="option">
                  {{ option }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-xs">
              <span
                class="font-label-caps text-label-caps uppercase text-on-surface-variant"
                >Status</span
              >
              <select class="taskcore-input" formControlName="status">
                <option *ngFor="let option of statusOptions" [value]="option">
                  {{ option }}
                </option>
              </select>
            </label>
          </div>

          <div class="grid gap-md md:grid-cols-2">
            <label class="flex flex-col gap-xs">
              <span
                class="font-label-caps text-label-caps uppercase text-on-surface-variant"
                >Story Points</span
              >
              <input
                class="taskcore-input"
                formControlName="storyPoints"
                min="0"
                max="40"
                type="number"
              />
            </label>

            <label class="flex flex-col gap-xs">
              <span
                class="font-label-caps text-label-caps uppercase text-on-surface-variant"
                >Epic</span
              >
              <select
                class="taskcore-input"
                formControlName="parentEpicId"
                [disabled]="form.controls.issueType.value === IssueType.Epic"
              >
                <option value="">No epic</option>
                <option *ngFor="let epic of epicOptions" [value]="epic.id">
                  {{ epic.title }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-xs">
              <span
                class="font-label-caps text-label-caps uppercase text-on-surface-variant"
                >Assignee</span
              >
              <select class="taskcore-input" formControlName="assigneeId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users" [value]="user.id">
                  {{ user.fullName }} • {{ user.organizationName }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-xs">
              <span
                class="font-label-caps text-label-caps uppercase text-on-surface-variant"
                >Due Date</span
              >
              <input
                class="taskcore-input"
                formControlName="dueDate"
                type="date"
              />
            </label>
          </div>

          <label class="flex flex-col gap-xs">
            <span
              class="font-label-caps text-label-caps uppercase text-on-surface-variant"
              >Tags</span
            >
            <input
              class="taskcore-input"
              formControlName="tagsText"
              placeholder="security, auth, sprint-12"
            />
          </label>

          <label class="flex flex-col gap-xs">
            <span
              class="font-label-caps text-label-caps uppercase text-on-surface-variant"
              >Acceptance Criteria</span
            >
            <textarea
              class="taskcore-input min-h-24"
              formControlName="acceptanceCriteriaText"
            ></textarea>
          </label>

          <div class="mt-sm flex justify-end gap-3">
            <button
              class="rounded-lg border border-outline-variant px-md py-sm text-body-sm text-on-surface transition hover:bg-surface-container-low"
              type="button"
              (click)="closed.emit()"
            >
              Cancel
            </button>
            <button
              class="rounded-xl bg-primary px-md py-sm font-label-lg text-label-lg text-on-primary transition-colors hover:bg-surface-tint"
              type="submit"
            >
              {{ task ? 'Save changes' : 'Create task' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class TaskModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() open = false;
  @Input() task: Task | null = null;
  @Input() users: UserSummary[] = [];
  @Input() epicOptions: Task[] = [];
  @Input() duplicates: Array<{
    id: string;
    title: string;
    description: string | null;
    similarity: number;
  }> = [];
  @Output() saved = new EventEmitter<{
    title: string;
    description: string | null;
    issueType: IssueType;
    category: TaskCategory;
    priority: TaskPriority;
    storyPoints: number | null;
    parentEpicId: string | null;
    acceptanceCriteria: AcceptanceCriteriaItem[];
    status: TaskStatus;
    assigneeId: string | null;
    dueDate: string | null;
    tags: string[];
  }>();
  @Output() closed = new EventEmitter<void>();
  @Output() forceSave = new EventEmitter<{
    title: string;
    description: string | null;
    issueType: IssueType;
    category: TaskCategory;
    priority: TaskPriority;
    storyPoints: number | null;
    parentEpicId: string | null;
    acceptanceCriteria: AcceptanceCriteriaItem[];
    status: TaskStatus;
    assigneeId: string | null;
    dueDate: string | null;
    tags: string[];
  }>();

  readonly showDuplicateWarning = signal(false);

  protected readonly IssueType = IssueType;
  readonly issueTypeOptions = Object.values(IssueType);
  readonly categoryOptions = Object.values(TaskCategory);
  readonly priorityOptions = Object.values(TaskPriority);
  readonly statusOptions = Object.values(TaskStatus);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: [''],
    issueType: [IssueType.Task],
    category: [TaskCategory.Work],
    priority: [TaskPriority.Medium],
    storyPoints: this.fb.control<number | null>(null),
    parentEpicId: [''],
    status: [TaskStatus.Todo],
    assigneeId: [''],
    dueDate: [''],
    tagsText: [''],
    acceptanceCriteriaText: [''],
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['task'] || (changes['open'] && this.open)) {
      this.syncFormToTask();
    }
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { acceptanceCriteriaText, tagsText, ...rest } =
      this.form.getRawValue();
    this.saved.emit({
      ...rest,
      description: rest.description || null,
      assigneeId: rest.assigneeId || null,
      dueDate: rest.dueDate || null,
      parentEpicId:
        rest.issueType === IssueType.Epic ? null : rest.parentEpicId || null,
      storyPoints:
        rest.storyPoints === null || rest.storyPoints === undefined
          ? null
          : Number(rest.storyPoints),
      tags: tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      acceptanceCriteria: this.parseAcceptanceCriteria(acceptanceCriteriaText),
    });
  }

  private syncFormToTask() {
    if (this.task) {
      this.form.reset({
        title: this.task.title,
        description: this.task.description ?? '',
        issueType: this.task.issueType,
        category: this.task.category,
        priority: this.task.priority,
        storyPoints: this.task.storyPoints,
        parentEpicId: this.task.parentEpicId ?? '',
        status: this.task.status,
        assigneeId: this.task.assigneeId ?? '',
        dueDate: this.task.dueDate ?? '',
        tagsText: this.task.tags.join(', '),
        acceptanceCriteriaText: this.task.acceptanceCriteria
          .map((item) => item.text)
          .join('\n'),
      });
      return;
    }

    this.form.reset({
      title: '',
      description: '',
      issueType: IssueType.Task,
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
      storyPoints: null,
      parentEpicId: '',
      status: TaskStatus.Todo,
      assigneeId: '',
      dueDate: '',
      tagsText: '',
      acceptanceCriteriaText: '',
    });
  }

  private parseAcceptanceCriteria(value: string): AcceptanceCriteriaItem[] {
    const existingByText = new Map(
      (this.task?.acceptanceCriteria ?? []).map((item) => [item.text, item]),
    );

    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((text) => {
        const existing = existingByText.get(text);
        return {
          id: existing?.id ?? '',
          text,
          completed: existing?.completed ?? false,
        };
      });
  }
}
