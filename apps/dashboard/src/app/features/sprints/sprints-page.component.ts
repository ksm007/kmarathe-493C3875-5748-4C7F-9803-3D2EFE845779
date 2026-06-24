import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Sprint, SprintState, Task, TaskStatus } from '@nx-temp/data';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-sprints-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex h-full flex-col gap-8">
      <div class="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 class="font-h1 text-h1 text-on-background">Sprint Planning</h1>
          <p class="mt-1 flex items-center gap-2 text-body-sm text-on-surface-variant">
            <span class="h-2 w-2 rounded-full bg-secondary"></span>
            {{ activeSprint() ? activeSprint()?.name : 'No active sprint' }} ·
            {{ plannedSprints().length }} planned
          </p>
        </div>
      </div>

      <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div class="space-y-6">
          <div
            *ngIf="activeSprint() as sprint; else noActiveSprint"
            class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div class="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="rounded bg-primary-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-primary-container">
                    Active
                  </span>
                  <span class="text-xs text-on-surface-variant">
                    {{ dateRange(sprint) }}
                  </span>
                </div>
                <h2 class="font-h2 text-h2 text-on-surface">{{ sprint.name }}</h2>
                <p class="mt-2 max-w-3xl text-body-sm text-on-surface-variant">
                  {{ sprint.goal || 'No sprint goal set.' }}
                </p>
              </div>
              <button
                class="rounded-xl bg-primary px-4 py-2.5 font-label-lg text-label-lg text-on-primary transition-all hover:-translate-y-px hover:bg-surface-tint disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
                type="button"
                [disabled]="saving()"
                (click)="completeSprint(sprint)"
              >
                Complete Sprint
              </button>
            </div>

            <div class="mt-6 grid gap-4 sm:grid-cols-3">
              <div class="rounded-lg bg-surface-container-low p-4">
                <p class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Issues
                </p>
                <p class="mt-2 font-display text-display text-on-surface">
                  {{ sprintIssueCount(sprint.id) }}
                </p>
              </div>
              <div class="rounded-lg bg-surface-container-low p-4">
                <p class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Open Points
                </p>
                <p class="mt-2 font-display text-display text-on-surface">
                  {{ sprintOpenPoints(sprint.id) }}
                </p>
              </div>
              <div class="rounded-lg bg-surface-container-low p-4">
                <p class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Capacity
                </p>
                <p class="mt-2 font-display text-display text-on-surface">
                  {{ sprint.capacityPoints ?? '—' }}
                </p>
              </div>
            </div>

            <label class="mt-6 flex max-w-md flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Move unfinished work to
              </span>
              <select class="taskcore-input" [value]="completeDestinationId()" (change)="setCompleteDestination($event)">
                <option value="">Backlog</option>
                <option *ngFor="let planned of plannedSprints()" [value]="planned.id">
                  {{ planned.name }}
                </option>
              </select>
            </label>
          </div>

          <ng-template #noActiveSprint>
            <div class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card">
              <h2 class="font-h2 text-h2 text-on-surface">No active sprint</h2>
              <p class="mt-2 text-body-sm text-on-surface-variant">
                Start a planned sprint when the team is ready to commit work.
              </p>
            </div>
          </ng-template>

          <div class="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card">
            <div class="border-b border-outline-variant bg-surface-container-low px-6 py-4">
              <h2 class="font-h3 text-h3 text-on-surface">Sprint Queue</h2>
            </div>
            <div class="divide-y divide-outline-variant/70">
              <article *ngFor="let sprint of sprints(); trackBy: trackBySprintId" class="p-6">
                <div class="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <div class="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        [class.bg-primary-container]="sprint.state === SprintState.Active"
                        [class.text-on-primary-container]="sprint.state === SprintState.Active"
                        [class.bg-surface-container-high]="sprint.state === SprintState.Planned"
                        [class.text-on-surface-variant]="sprint.state === SprintState.Planned"
                        [class.bg-surface-container]="sprint.state === SprintState.Completed"
                        [class.text-outline]="sprint.state === SprintState.Completed"
                      >
                        {{ sprint.state }}
                      </span>
                      <span class="text-xs text-on-surface-variant">{{ dateRange(sprint) }}</span>
                    </div>
                    <h3 class="font-label-lg text-label-lg text-on-surface">{{ sprint.name }}</h3>
                    <p class="mt-1 max-w-2xl text-body-sm text-on-surface-variant">
                      {{ sprint.goal || 'No sprint goal set.' }}
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded bg-surface-container px-2 py-1 text-xs text-on-surface-variant">
                      {{ sprintIssueCount(sprint.id) }} issues
                    </span>
                    <span class="rounded bg-surface-container px-2 py-1 text-xs text-on-surface-variant">
                      {{ sprintOpenPoints(sprint.id) }} open pts
                    </span>
                    <button
                      *ngIf="sprint.state === SprintState.Planned"
                      class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      [disabled]="saving() || !!activeSprint()"
                      (click)="startSprint(sprint)"
                    >
                      Start
                    </button>
                  </div>
                </div>
              </article>
              <div *ngIf="sprints().length === 0" class="px-6 py-10 text-center text-on-surface-variant">
                No sprints yet.
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card">
          <h2 class="mb-1 font-h3 text-h3 text-on-surface">Create Sprint</h2>
          <p class="mb-6 text-body-sm text-on-surface-variant">
            New sprints are planned until you start one.
          </p>

          <form class="flex flex-col gap-md" [formGroup]="form" (ngSubmit)="createSprint()">
            <label class="flex flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Name</span>
              <input class="taskcore-input" formControlName="name" type="text" />
            </label>

            <label class="flex flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Goal</span>
              <textarea class="taskcore-input min-h-24" formControlName="goal"></textarea>
            </label>

            <label class="flex flex-col gap-xs">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Capacity Points</span>
              <input class="taskcore-input" formControlName="capacityPoints" min="0" max="500" type="number" />
            </label>

            <div class="grid gap-md sm:grid-cols-2">
              <label class="flex flex-col gap-xs">
                <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Start</span>
                <input class="taskcore-input" formControlName="startDate" type="date" />
              </label>
              <label class="flex flex-col gap-xs">
                <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">End</span>
                <input class="taskcore-input" formControlName="endDate" type="date" />
              </label>
            </div>

            <p *ngIf="formError()" class="rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container">
              {{ formError() }}
            </p>

            <button
              class="mt-sm flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-label-lg text-label-lg text-on-primary transition-all hover:-translate-y-px hover:bg-surface-tint disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
              type="submit"
              [disabled]="form.invalid || saving()"
            >
              {{ saving() ? 'Saving...' : 'Create sprint' }}
              <span class="material-symbols-outlined text-[18px]">add</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  `,
})
export class SprintsPageComponent {
  protected readonly SprintState = SprintState;

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly sprints = signal<Sprint[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly completeDestinationId = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    goal: [''],
    capacityPoints: this.fb.control<number | null>(null),
    startDate: [''],
    endDate: [''],
  });

  readonly activeSprint = computed(
    () => this.sprints().find((sprint) => sprint.state === SprintState.Active) ?? null,
  );
  readonly plannedSprints = computed(() =>
    this.sprints().filter((sprint) => sprint.state === SprintState.Planned),
  );

  constructor() {
    this.loadPlanningData();
  }

  createSprint() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.api
      .createSprint({
        name: value.name,
        goal: value.goal || null,
        capacityPoints:
          value.capacityPoints === null || value.capacityPoints === undefined
            ? null
            : Number(value.capacityPoints),
        startDate: value.startDate || null,
        endDate: value.endDate || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Sprint created', 'The sprint was added to the queue.');
          this.form.reset({
            name: '',
            goal: '',
            capacityPoints: null,
            startDate: '',
            endDate: '',
          });
          this.loadPlanningData();
        },
        error: (err) => this.handleMutationError(err, 'Unable to create sprint.'),
      });
  }

  startSprint(sprint: Sprint) {
    this.saving.set(true);
    this.api
      .startSprint(sprint.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Sprint started', `${sprint.name} is now active.`);
          this.loadPlanningData();
        },
        error: (err) => this.handleMutationError(err, 'Unable to start sprint.'),
      });
  }

  completeSprint(sprint: Sprint) {
    this.saving.set(true);
    this.api
      .completeSprint(sprint.id, {
        destinationSprintId: this.completeDestinationId() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Sprint completed', 'Unfinished work was moved.');
          this.completeDestinationId.set('');
          this.loadPlanningData();
        },
        error: (err) => this.handleMutationError(err, 'Unable to complete sprint.'),
      });
  }

  setCompleteDestination(event: Event) {
    this.completeDestinationId.set((event.target as HTMLSelectElement).value);
  }

  sprintIssueCount(sprintId: string) {
    return this.tasks().filter((task) => task.sprintId === sprintId).length;
  }

  sprintOpenPoints(sprintId: string) {
    return this.tasks()
      .filter((task) => task.sprintId === sprintId && task.status !== TaskStatus.Done)
      .reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
  }

  dateRange(sprint: Sprint) {
    if (!sprint.startDate && !sprint.endDate) {
      return 'No dates';
    }
    return `${this.formatDate(sprint.startDate)} - ${this.formatDate(sprint.endDate)}`;
  }

  trackBySprintId(_: number, sprint: Sprint) {
    return sprint.id;
  }

  private loadPlanningData() {
    forkJoin({
      sprints: this.api.listSprints(),
      tasks: this.api.listTasks(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ sprints, tasks }) => {
          this.sprints.set(sprints);
          this.tasks.set(tasks);
          this.saving.set(false);
        },
        error: (err) => this.handleMutationError(err, 'Unable to load sprint planning.'),
      });
  }

  private formatDate(value: string | null) {
    return value ? new Date(value).toLocaleDateString() : 'Open';
  }

  private handleMutationError(err: unknown, fallback: string) {
    const message =
      typeof err === 'object' &&
      err !== null &&
      'error' in err &&
      typeof (err as { error?: { message?: unknown } }).error?.message === 'string'
        ? (err as { error: { message: string } }).error.message
        : fallback;
    this.formError.set(message);
    this.toast.error('Sprint action failed', message);
    this.saving.set(false);
  }
}
