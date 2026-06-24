import { CommonModule } from '@angular/common';
import {
  CdkDrag,
  CdkDropList,
  CdkDragDrop,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AcceptanceCriteriaItem,
  IssueType,
  Role,
  Task,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  UserSummary,
} from '@nx-temp/data';
import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { selectUser } from '../../core/store/auth/auth.reducer';
import { TasksActions } from '../../core/store/tasks/tasks.actions';
import {
  selectItems,
  selectTaskQuery,
  selectTasksError,
  selectTasksLoading,
} from '../../core/store/tasks/tasks.reducer';
import { TaskModalComponent } from './components/task-modal.component';

type TaskViewMode = 'board' | 'list' | 'analytics';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    TaskModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-task-modal
      [open]="modalOpen()"
      [task]="activeTask()"
      [users]="assignableUsers()"
      (closed)="closeModal()"
      (saved)="saveTask($event)"
    />

    <!-- Loading bar -->
    <div
      *ngIf="loading()"
      class="fixed left-0 top-0 z-50 h-0.5 w-full overflow-hidden bg-primary/20"
    >
      <div
        class="h-full w-1/3 animate-[loading-bar_1.4s_ease-in-out_infinite] bg-primary"
      ></div>
    </div>

    <section class="flex h-full flex-col gap-8">
      <div class="flex flex-col gap-6">
        <div
          class="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center"
        >
          <div>
            <h1 class="font-h1 text-h1 text-on-background">Task Workspace</h1>
            <p
              class="mt-1 flex items-center gap-2 text-body-sm text-on-surface-variant"
            >
              <span class="h-2 w-2 rounded-full bg-primary"></span>
              Active workspace for {{ user()?.organizationName }} •
              {{ tasks().length }} tracked tasks
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <div class="flex rounded-lg bg-surface-container p-1">
              <button
                class="taskcore-segment"
                [class.taskcore-segment-active]="viewMode() === 'board'"
                type="button"
                (click)="setViewMode('board')"
              >
                Board
              </button>
              <button
                class="taskcore-segment"
                [class.taskcore-segment-active]="viewMode() === 'list'"
                type="button"
                (click)="setViewMode('list')"
              >
                List
              </button>
              <button
                class="taskcore-segment"
                [class.taskcore-segment-active]="viewMode() === 'analytics'"
                type="button"
                (click)="setViewMode('analytics')"
              >
                Analytics
              </button>
            </div>

            <button
              *ngIf="canManage()"
              class="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:-translate-y-px hover:bg-surface-tint disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              [disabled]="loading()"
              (click)="openCreateModal()"
            >
              <span
                *ngIf="loading(); else addIcon"
                class="material-symbols-outlined animate-spin text-[18px]"
                >progress_activity</span
              >
              <ng-template #addIcon>
                <span class="material-symbols-outlined text-[18px]">add</span>
              </ng-template>
              Create Task
            </button>
          </div>
        </div>

        <div class="taskcore-raised p-6">
          <form
            class="flex flex-wrap items-end gap-4"
            [formGroup]="filtersForm"
          >
            <label class="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <span
                class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
                >Search</span
              >
              <div class="relative">
                <span
                  class="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]"
                  >search</span
                >
                <input
                  #searchInput
                  class="taskcore-input pl-10"
                  formControlName="search"
                  placeholder="Search tasks, projects, or people..."
                />
              </div>
            </label>

            <label class="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span
                class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
                >Category</span
              >
              <div class="relative">
                <span
                  class="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]"
                  >filter_alt</span
                >
                <select
                  class="taskcore-input appearance-none pl-10"
                  formControlName="category"
                >
                  <option value="">All</option>
                  <option
                    *ngFor="let category of categories"
                    [value]="category"
                  >
                    {{ category }}
                  </option>
                </select>
                <span
                  class="material-symbols-outlined pointer-events-none absolute right-3 top-2.5 text-on-surface-variant text-[20px]"
                  >arrow_drop_down</span
                >
              </div>
            </label>

            <label class="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span
                class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
                >Sort</span
              >
              <div class="relative">
                <span
                  class="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]"
                  >swap_vert</span
                >
                <select
                  class="taskcore-input appearance-none pl-10"
                  formControlName="sortBy"
                >
                  <option value="position">Board order</option>
                  <option value="updatedAt">Recently updated</option>
                  <option value="title">Title</option>
                  <option value="priority">Priority</option>
                </select>
                <span
                  class="material-symbols-outlined pointer-events-none absolute right-3 top-2.5 text-on-surface-variant text-[20px]"
                  >arrow_drop_down</span
                >
              </div>
            </label>

            <button
              class="px-4 py-2 font-label-lg text-label-lg text-primary transition-colors hover:rounded-lg hover:bg-primary-fixed"
              type="button"
              (click)="clearFilters()"
            >
              Clear All
            </button>
          </form>

          <div class="mt-5 rounded-lg bg-surface-container-low p-3">
            <div
              class="flex h-3 overflow-hidden rounded-full bg-surface-container-highest"
            >
              <div
                *ngFor="let column of columns"
                [style.backgroundColor]="column.color"
                [style.width.%]="statusWidth(column.status)"
              ></div>
            </div>
          </div>

          <p
            *ngIf="error()"
            class="mt-md rounded-lg border border-error/40 bg-error-container px-md py-sm text-body-sm text-on-error-container"
          >
            {{ error() }}
          </p>

          <p
            *ngIf="viewMode() === 'board' && !canReorder()"
            class="mt-sm text-body-sm text-on-surface-variant"
          >
            Switch sort to Board order to drag tasks between columns.
          </p>

          <div
            class="mt-4 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant"
          >
            <span
              class="rounded bg-surface-container px-2 py-1 font-semibold text-on-surface"
              >C</span
            >
            <span>Create task</span>
            <span
              class="rounded bg-surface-container px-2 py-1 font-semibold text-on-surface"
              >/</span
            >
            <span>Focus search</span>
            <span
              class="rounded bg-surface-container px-2 py-1 font-semibold text-on-surface"
              >Esc</span
            >
            <span>Close modal</span>
          </div>
        </div>
      </div>

      <div
        *ngIf="viewMode() === 'analytics'"
        class="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div class="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
          <div
            class="rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-label-lg text-label-lg text-on-surface-variant">
                Total Tasks
              </h2>
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high text-primary"
              >
                <span class="material-symbols-outlined">assignment</span>
              </div>
            </div>
            <span class="font-display text-display text-on-background">{{
              tasks().length
            }}</span>
            <p class="mt-2 font-body-sm text-body-sm text-outline">
              Live board count
            </p>
          </div>

          <div
            class="rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-label-lg text-label-lg text-on-surface-variant">
                Backlog
              </h2>
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ffedd5] text-[#9a3412]"
              >
                <span class="material-symbols-outlined">pending_actions</span>
              </div>
            </div>
            <span class="font-display text-display text-on-background">{{
              groupedTasks()[TaskStatus.Backlog].length
            }}</span>
            <p class="mt-2 font-body-sm text-body-sm text-outline">
              Ready for planning
            </p>
          </div>

          <div
            class="rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-label-lg text-label-lg text-on-surface-variant">
                In Progress
              </h2>
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-fixed text-secondary"
              >
                <span class="material-symbols-outlined">cycle</span>
              </div>
            </div>
            <span class="font-display text-display text-on-background">{{
              groupedTasks()[TaskStatus.InProgress].length
            }}</span>
            <p class="mt-2 font-body-sm text-body-sm text-outline">
              Currently being worked
            </p>
          </div>

          <div
            class="rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-label-lg text-label-lg text-on-surface-variant">
                In Review
              </h2>
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"
              >
                <span class="material-symbols-outlined">check_circle</span>
              </div>
            </div>
            <span class="font-display text-display text-on-background">{{
              groupedTasks()[TaskStatus.InReview].length
            }}</span>
            <p class="mt-2 font-body-sm text-body-sm text-outline">
              Waiting on review
            </p>
          </div>
        </div>

        <div
          class="rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-card"
        >
          <div class="mb-6 flex items-center justify-between">
            <div>
              <h2 class="font-h3 text-h3 text-on-surface">
                Task Completion Visualization
              </h2>
              <p class="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                A live view of the current board distribution.
              </p>
            </div>
            <div
              class="rounded-full bg-surface-container px-3 py-1 font-label-sm text-label-sm text-on-surface-variant"
            >
              {{ tasks().length }} active
            </div>
          </div>

          <div class="grid gap-lg">
            <div
              class="flex min-h-[220px] items-end gap-4 border-b border-outline-variant/50 pb-6"
            >
              <div
                *ngFor="let bar of chartBars()"
                class="flex flex-1 flex-col items-center gap-3"
              >
                <div
                  class="font-label-lg text-label-lg text-on-surface-variant"
                >
                  {{ bar.count }}
                </div>
                <div
                  class="flex h-[160px] w-full items-end rounded bg-surface-container-low px-3 py-2"
                >
                  <div
                    class="w-full rounded-t transition-[height] duration-300"
                    [style.height.%]="bar.height"
                    [style.backgroundColor]="bar.color"
                  ></div>
                </div>
                <div class="font-body-sm text-body-sm text-on-surface">
                  {{ bar.label }}
                </div>
              </div>
            </div>

            <div
              *ngFor="let bar of chartBars()"
              class="rounded border border-outline-variant/50 bg-surface px-4 py-3"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    [style.backgroundColor]="bar.color"
                  ></span>
                  <span class="text-sm font-medium text-on-surface">{{
                    bar.label
                  }}</span>
                </div>
                <span class="text-sm font-semibold text-on-surface"
                  >{{ bar.percent }}%</span
                >
              </div>
              <p class="mt-2 text-xs text-on-surface-variant">
                {{ bar.count }}
                {{ bar.count === 1 ? 'task' : 'tasks' }} currently in
                {{ bar.label.toLowerCase() }}.
              </p>
            </div>
          </div>
        </div>

        <div
          class="rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-card xl:col-span-2"
        >
          <div class="mb-6 flex items-center justify-between">
            <div>
              <h2 class="font-h3 text-h3 text-on-surface">Status Breakdown</h2>
              <p class="mt-1 text-body-sm text-on-surface-variant">
                Share of tasks in each workflow state.
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <div *ngFor="let bar of chartBars()">
              <div class="mb-2 flex items-center justify-between">
                <span class="font-label-lg text-label-lg text-on-surface">{{
                  bar.label
                }}</span>
                <span class="text-sm font-semibold text-on-surface"
                  >{{ bar.percent }}%</span
                >
              </div>
              <div
                class="h-3 overflow-hidden rounded-full bg-surface-container-highest"
              >
                <div
                  class="h-3 rounded-full"
                  [style.width.%]="bar.percent"
                  [style.backgroundColor]="bar.color"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        *ngIf="viewMode() === 'list'"
        class="relative rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card"
      >
        <div
          *ngIf="loading()"
          class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface/60 backdrop-blur-[2px]"
        >
          <span class="material-symbols-outlined animate-spin text-[40px] text-primary"
            >progress_activity</span
          >
        </div>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr
                class="border-b border-outline-variant bg-surface-container-low font-label-lg text-label-lg text-on-surface-variant"
              >
                <th class="px-6 py-4 font-semibold">Task</th>
                <th class="px-6 py-4 font-semibold">Type</th>
                <th class="px-6 py-4 font-semibold">Status</th>
                <th class="px-6 py-4 font-semibold">Priority</th>
                <th class="px-6 py-4 font-semibold">Points</th>
                <th class="px-6 py-4 font-semibold">Category</th>
                <th class="px-6 py-4 font-semibold">Updated</th>
                <th class="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody
              class="divide-y divide-slate-100 text-body-sm text-on-surface"
            >
              <tr
                *ngFor="let task of tasks(); trackBy: trackByTaskId"
                class="taskcore-table-row"
              >
                <td class="px-6 py-4">
                  <div class="min-w-[220px]">
                    <p class="font-medium text-on-surface">{{ task.title }}</p>
                    <p
                      class="mt-1 line-clamp-2 text-xs text-on-surface-variant"
                    >
                      {{ task.description || 'No description provided.' }}
                    </p>
                  </div>
                </td>
                <td class="px-6 py-4 text-on-surface-variant">
                  {{ task.issueType }}
                </td>
                <td class="px-6 py-4">
                  <span
                    class="rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant"
                  >
                    {{ statusLabel(task.status) }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span
                    class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    [class.bg-error-container]="task.priority === 'high'"
                    [class.text-on-error-container]="task.priority === 'high'"
                    [class.bg-primary-container]="task.priority === 'medium'"
                    [class.text-on-primary-container]="
                      task.priority === 'medium'
                    "
                    [class.bg-surface-container-high]="task.priority === 'low'"
                    [class.text-primary]="task.priority === 'low'"
                  >
                    {{ task.priority }}
                  </span>
                </td>
                <td class="px-6 py-4 text-on-surface-variant">
                  {{ task.storyPoints ?? '—' }}
                </td>
                <td class="px-6 py-4 text-on-surface-variant">
                  {{ task.category }}
                </td>
                <td class="px-6 py-4 text-on-surface-variant">
                  {{ relativeTimestamp(task.updatedAt) }}
                </td>
                <td class="px-6 py-4">
                  <div class="flex justify-end gap-2">
                    <button
                      class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-low"
                      type="button"
                      (click)="openTaskDetail(task.id)"
                    >
                      Details
                    </button>
                    <button
                      class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-low"
                      type="button"
                      (click)="openEditModal(task)"
                    >
                      Edit
                    </button>
                    <button
                      *ngIf="canManage()"
                      class="taskcore-danger-button"
                      type="button"
                      (click)="deleteTask(task.id)"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        *ngIf="viewMode() === 'board'"
        cdkDropListGroup
        class="flex-1 overflow-x-auto pb-4 transition-opacity duration-200"
        [class.pointer-events-none]="loading()"
        [class.opacity-60]="loading()"
      >
        <div class="flex min-w-full items-start gap-gutter">
          <article
            *ngFor="let column of columns; trackBy: trackByStatus"
            class="flex h-full flex-1 min-w-[320px] flex-col rounded-xl bg-surface-container-low p-3"
            [class.opacity-80]="column.status === TaskStatus.Done"
          >
            <div class="mb-4 flex items-center justify-between px-1">
              <h3
                class="flex items-center gap-2 font-label-lg text-label-lg text-on-surface"
              >
                {{ column.label }}
                <span
                  class="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant"
                >
                  {{ groupedTasks()[column.status].length }}
                </span>
              </h3>
              <button
                *ngIf="canManage()"
                class="text-on-surface-variant transition-colors hover:text-primary disabled:opacity-40"
                type="button"
                [disabled]="loading()"
                (click)="openCreateModal()"
              >
                <span class="material-symbols-outlined">add</span>
              </button>
            </div>

            <div
              cdkDropList
              class="flex min-h-[420px] flex-1 flex-col gap-3 overflow-y-auto pr-1 pb-2"
              [cdkDropListConnectedTo]="connectedDropListIds(column.status)"
              [cdkDropListData]="groupedTasks()[column.status]"
              [cdkDropListDisabled]="!canReorder()"
              [id]="column.status"
              (cdkDropListDropped)="drop($event, column.status)"
            >
              <div
                *ngFor="
                  let task of groupedTasks()[column.status];
                  trackBy: trackByTaskId
                "
                cdkDrag
                [cdkDragDisabled]="!canReorder()"
                class="group cursor-grab rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div class="mb-2 flex items-start justify-between gap-2">
                  <div class="flex flex-wrap gap-2">
                    <span
                      class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      [class.bg-error-container]="task.priority === 'high'"
                      [class.text-on-error-container]="task.priority === 'high'"
                      [class.bg-primary-container]="task.priority === 'medium'"
                      [class.text-on-primary-container]="
                        task.priority === 'medium'
                      "
                      [class.bg-surface-container-high]="
                        task.priority === 'low'
                      "
                      [class.text-primary]="task.priority === 'low'"
                    >
                      {{ task.priority }}
                    </span>
                    <span
                      class="rounded bg-surface-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant"
                    >
                      {{ task.issueType }}
                    </span>
                    <span
                      *ngIf="task.storyPoints !== null"
                      class="rounded bg-surface-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant"
                    >
                      {{ task.storyPoints }} pt
                    </span>
                    <span
                      class="rounded bg-surface-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant"
                    >
                      {{ task.category }}
                    </span>
                  </div>
                  <span
                    class="material-symbols-outlined text-sm text-outline-variant transition-colors group-hover:text-on-surface-variant"
                    >more_horiz</span
                  >
                </div>

                <p class="mb-2 font-label-md text-label-md text-on-surface">
                  {{ task.title }}
                </p>
                <p
                  class="mb-4 line-clamp-2 text-[13px] leading-5 text-on-surface-variant"
                >
                  {{ task.description || 'No description provided.' }}
                </p>

                <div
                  *ngIf="task.tags.length > 0"
                  class="mb-3 flex flex-wrap gap-1"
                >
                  <span
                    *ngFor="let tag of task.tags.slice(0, 3)"
                    class="rounded-full bg-surface-container px-2 py-0.5 text-[10px] text-on-surface-variant"
                    >#{{ tag }}</span
                  >
                </div>

                <div
                  *ngIf="column.status === TaskStatus.InProgress"
                  class="mb-4 h-1.5 w-full rounded-full bg-surface-container-highest"
                >
                  <div
                    class="h-1.5 rounded-full bg-primary"
                    [style.width.%]="50 + (task.position % 4) * 10"
                  ></div>
                </div>

                <div class="mt-auto flex items-center justify-between">
                  <div class="space-y-1 text-xs text-outline-variant">
                    <div class="flex items-center gap-1">
                      <span class="material-symbols-outlined text-[16px]"
                        >apartment</span
                      >
                      <span>{{ task.organizationName }}</span>
                    </div>
                    <div
                      class="flex items-center gap-1"
                      *ngIf="task.assigneeName"
                    >
                      <span class="material-symbols-outlined text-[16px]"
                        >person</span
                      >
                      <span>{{ task.assigneeName }}</span>
                    </div>
                  </div>
                  <div
                    class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-container-low bg-surface-container-high text-[10px] font-semibold text-on-surface"
                  >
                    {{ task.createdByName.charAt(0) }}
                  </div>
                </div>

                <div
                  class="mt-4 flex gap-2 border-t border-outline-variant/50 pt-3"
                >
                  <button
                    class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-low"
                    type="button"
                    (click)="openTaskDetail(task.id)"
                  >
                    Details
                  </button>
                  <button
                    *ngIf="canManage()"
                    class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-low"
                    type="button"
                    (click)="openEditModal(task)"
                  >
                    Edit
                  </button>
                  <button
                    *ngIf="canManage()"
                    class="taskcore-danger-button"
                    type="button"
                    (click)="deleteTask(task.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  `,
})
export class TasksPageComponent {
  protected readonly TaskStatus = TaskStatus;

  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly tasks = this.store.selectSignal(selectItems);
  readonly user = this.store.selectSignal(selectUser);
  readonly error = this.store.selectSignal(selectTasksError);
  readonly loading = this.store.selectSignal(selectTasksLoading);
  readonly currentQuery = this.store.selectSignal(selectTaskQuery);

  readonly categories = Object.values(TaskCategory);
  readonly modalOpen = signal(false);
  readonly activeTask = signal<Task | null>(null);
  readonly viewMode = signal<TaskViewMode>('board');
  readonly assignableUsers = signal<UserSummary[]>([]);

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    category: [''],
    sortBy: ['position'],
  });

  readonly columns = [
    { status: TaskStatus.Backlog, label: 'Backlog', color: '#7c5f46' },
    { status: TaskStatus.Todo, label: 'To Do', color: '#b0895c' },
    { status: TaskStatus.InProgress, label: 'In Progress', color: '#004ac6' },
    { status: TaskStatus.InReview, label: 'In Review', color: '#7c3aed' },
    { status: TaskStatus.Done, label: 'Done', color: '#059669' },
  ] as const;
  readonly columnIds = this.columns.map(({ status }) => status);

  readonly groupedTasks = computed(() => {
    const groups = Object.fromEntries(
      this.columns.map((column) => [column.status, [] as Task[]]),
    ) as Record<TaskStatus, Task[]>;

    for (const task of this.tasks()) {
      groups[task.status].push(task);
    }

    return groups;
  });

  constructor() {
    this.store.dispatch(
      TasksActions.queryChanged({ query: this.currentQuery() }),
    );
    this.api
      .listUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((users) => {
        this.assignableUsers.set(users);
      });

    this.filtersForm.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.store.dispatch(
          TasksActions.queryChanged({
            query: {
              ...this.currentQuery(),
              search: value.search || undefined,
              category: (value.category || undefined) as
                | TaskCategory
                | undefined,
              sortBy: (value.sortBy || 'position') as
                | 'position'
                | 'updatedAt'
                | 'title'
                | 'priority',
              order: 'asc',
            },
          }),
        );
      });
  }

  setViewMode(mode: TaskViewMode) {
    this.viewMode.set(mode);
  }

  clearFilters() {
    this.filtersForm.setValue({
      search: '',
      category: '',
      sortBy: 'position',
    });
  }

  canManage() {
    return this.user()?.role !== Role.Viewer;
  }

  canReorder() {
    return this.canManage() && this.currentQuery().sortBy === 'position';
  }

  connectedDropListIds(status: TaskStatus) {
    return this.columnIds.filter((id) => id !== status);
  }

  openCreateModal() {
    this.activeTask.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(task: Task) {
    this.activeTask.set(task);
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.activeTask.set(null);
  }

  saveTask(payload: {
    title: string;
    description: string | null;
    issueType: IssueType;
    category: TaskCategory;
    priority: TaskPriority;
    storyPoints: number | null;
    acceptanceCriteria: AcceptanceCriteriaItem[];
    status: TaskStatus;
    assigneeId: string | null;
    dueDate: string | null;
    tags: string[];
  }) {
    const task = this.activeTask();
    if (task) {
      this.store.dispatch(
        TasksActions.updateRequested({ id: task.id, payload }),
      );
    } else {
      this.store.dispatch(TasksActions.createRequested({ payload }));
    }

    this.closeModal();
  }

  deleteTask(id: string) {
    this.store.dispatch(TasksActions.deleteRequested({ id }));
  }

  openTaskDetail(id: string) {
    void this.router.navigate(['/tasks', id]);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const isTypingTarget =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    if (event.key === 'Escape' && this.modalOpen()) {
      event.preventDefault();
      this.closeModal();
      return;
    }

    if (event.key === '/') {
      if (!isTypingTarget) {
        event.preventDefault();
        this.searchInput?.nativeElement.focus();
        this.searchInput?.nativeElement.select();
      }
      return;
    }

    if (isTypingTarget) {
      return;
    }

    if (event.key === '1') {
      event.preventDefault();
      this.setViewMode('board');
      return;
    }

    if (event.key === '2') {
      event.preventDefault();
      this.setViewMode('list');
      return;
    }

    if (event.key === '3') {
      event.preventDefault();
      this.setViewMode('analytics');
      return;
    }

    if ((event.key === 'c' || event.key === 'C') && this.canManage()) {
      event.preventDefault();
      this.openCreateModal();
    }
  }

  drop(event: CdkDragDrop<Task[]>, targetStatus: TaskStatus) {
    if (!this.canReorder()) {
      return;
    }

    const previousStatus = event.previousContainer.id as TaskStatus;
    const board = this.groupedTasks();
    const currentItems = event.container.data;
    const previousItems = event.previousContainer.data;

    if (
      event.previousContainer === event.container &&
      event.previousIndex === event.currentIndex
    ) {
      return;
    }

    if (event.previousContainer === event.container) {
      moveItemInArray(currentItems, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        previousItems,
        currentItems,
        event.previousIndex,
        event.currentIndex,
      );
    }

    const touchedStatuses = [previousStatus, targetStatus].filter(
      (status, index, array) => array.indexOf(status) === index,
    );
    const tasks = touchedStatuses.flatMap((status) =>
      board[status].map((task, position) => ({
        id: task.id,
        status,
        position,
      })),
    );

    this.store.dispatch(TasksActions.reorderRequested({ payload: { tasks } }));
  }

  statusWidth(status: TaskStatus) {
    const total = this.tasks().length || 1;
    return (this.groupedTasks()[status].length / total) * 100;
  }

  statusLabel(status: TaskStatus) {
    return (
      this.columns.find((column) => column.status === status)?.label ?? status
    );
  }

  relativeTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  chartBars() {
    const total = this.tasks().length || 1;

    return this.columns.map((column) => {
      const count = this.groupedTasks()[column.status].length;
      return {
        status: column.status,
        label: column.label,
        count,
        percent: Math.round((count / total) * 100),
        height: this.statusWidth(column.status),
        color: column.color,
      };
    });
  }

  trackByStatus(_index: number, column: { status: TaskStatus }) {
    return column.status;
  }

  trackByTaskId(_index: number, task: Task) {
    return task.id;
  }
}
