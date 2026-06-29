// The pure utility functions exported from board.tsx (groupTasksByStatus,
// mergeReorderedTasks, mergeTasks) have no dependency on UI libraries at runtime;
// the real packages load cleanly in jsdom without any mocking needed.

import type { Task, ReorderTasksRequest } from '@nx-temp/data';
import { TaskStatus, TaskPriority, IssueType, TaskCategory } from '@nx-temp/data';
import {
  groupTasksByStatus,
  mergeReorderedTasks,
  mergeTasks,
} from '../board';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: 'Task',
    description: null,
    status: TaskStatus.Todo,
    issueType: IssueType.Task,
    category: TaskCategory.Work,
    priority: TaskPriority.Medium,
    storyPoints: null,
    sprintId: null,
    sprintName: null,
    parentEpicId: null,
    parentEpicTitle: null,
    acceptanceCriteria: [],
    position: 0,
    organizationId: 'org-1',
    organizationName: 'Org',
    createdById: 'user-1',
    createdByName: 'Test User',
    assigneeId: null,
    assigneeName: null,
    dueDate: null,
    tags: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// groupTasksByStatus
// ---------------------------------------------------------------------------

describe('groupTasksByStatus', () => {
  it('returns an entry for every status even when there are no tasks', () => {
    const grouped = groupTasksByStatus([]);
    expect(Object.keys(grouped).sort()).toEqual(
      Object.values(TaskStatus).sort(),
    );
    for (const tasks of Object.values(grouped)) {
      expect(tasks).toEqual([]);
    }
  });

  it('places each task under its own status bucket', () => {
    const todo = makeTask({ id: 'a', status: TaskStatus.Todo });
    const done = makeTask({ id: 'b', status: TaskStatus.Done });
    const inProgress = makeTask({ id: 'c', status: TaskStatus.InProgress });

    const grouped = groupTasksByStatus([todo, done, inProgress]);

    expect(grouped[TaskStatus.Todo]).toEqual([todo]);
    expect(grouped[TaskStatus.Done]).toEqual([done]);
    expect(grouped[TaskStatus.InProgress]).toEqual([inProgress]);
    expect(grouped[TaskStatus.Backlog]).toEqual([]);
    expect(grouped[TaskStatus.InReview]).toEqual([]);
  });

  it('preserves insertion order within a bucket', () => {
    const t1 = makeTask({ id: '1', status: TaskStatus.Todo, position: 0 });
    const t2 = makeTask({ id: '2', status: TaskStatus.Todo, position: 1 });
    const t3 = makeTask({ id: '3', status: TaskStatus.Todo, position: 2 });

    const grouped = groupTasksByStatus([t1, t2, t3]);
    expect(grouped[TaskStatus.Todo].map((t) => t.id)).toEqual(['1', '2', '3']);
  });
});

// ---------------------------------------------------------------------------
// mergeReorderedTasks  (the heart of the onMutate optimistic update)
// ---------------------------------------------------------------------------

describe('mergeReorderedTasks', () => {
  it('applies status and position overrides from the payload', () => {
    const tasks = [
      makeTask({ id: 'a', status: TaskStatus.Todo, position: 0 }),
      makeTask({ id: 'b', status: TaskStatus.Todo, position: 1 }),
    ];
    const payload: ReorderTasksRequest = {
      tasks: [{ id: 'a', status: TaskStatus.InProgress, position: 0 }],
    };

    const merged = mergeReorderedTasks(tasks, payload);

    const taskA = merged.find((t) => t.id === 'a')!;
    expect(taskA.status).toBe(TaskStatus.InProgress);
    expect(taskA.position).toBe(0);
  });

  it('leaves tasks not in the payload unchanged', () => {
    const tasks = [
      makeTask({ id: 'a', status: TaskStatus.Todo, position: 0 }),
      makeTask({ id: 'b', status: TaskStatus.Backlog, position: 0 }),
    ];
    const payload: ReorderTasksRequest = {
      tasks: [{ id: 'a', status: TaskStatus.InProgress, position: 0 }],
    };

    const merged = mergeReorderedTasks(tasks, payload);
    const taskB = merged.find((t) => t.id === 'b')!;
    expect(taskB.status).toBe(TaskStatus.Backlog);
    expect(taskB.position).toBe(0);
  });

  it('sorts the result by status column order then by position (board order)', () => {
    const tasks = [
      makeTask({ id: 'done-0', status: TaskStatus.Done, position: 0 }),
      makeTask({ id: 'todo-0', status: TaskStatus.Todo, position: 0 }),
      makeTask({ id: 'backlog-0', status: TaskStatus.Backlog, position: 0 }),
    ];
    // No updates - just verify the sort
    const merged = mergeReorderedTasks(tasks, { tasks: [] });
    const ids = merged.map((t) => t.id);
    expect(ids.indexOf('backlog-0')).toBeLessThan(ids.indexOf('todo-0'));
    expect(ids.indexOf('todo-0')).toBeLessThan(ids.indexOf('done-0'));
  });

  it('simulates onMutate correctly: moved task appears in its new column', () => {
    // Board: three tasks in Todo; move the first one to InProgress.
    const tasks = [
      makeTask({ id: 't1', status: TaskStatus.Todo, position: 0 }),
      makeTask({ id: 't2', status: TaskStatus.Todo, position: 1 }),
      makeTask({ id: 't3', status: TaskStatus.Todo, position: 2 }),
    ];
    const payload: ReorderTasksRequest = {
      tasks: [{ id: 't1', status: TaskStatus.InProgress, position: 0 }],
    };
    const optimistic = mergeReorderedTasks(tasks, payload);

    const moved = optimistic.find((t) => t.id === 't1')!;
    expect(moved.status).toBe(TaskStatus.InProgress);

    // The two remaining Todo tasks are still in Todo
    const remaining = optimistic.filter((t) => t.status === TaskStatus.Todo);
    expect(remaining.map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('simulates onError rollback: original previousTasks are restored', () => {
    const previousTasks = [
      makeTask({ id: 'a', status: TaskStatus.Todo, position: 0 }),
      makeTask({ id: 'b', status: TaskStatus.Todo, position: 1 }),
    ];

    // "Optimistic" update that we will discard
    const optimisticPayload: ReorderTasksRequest = {
      tasks: [{ id: 'a', status: TaskStatus.InProgress, position: 0 }],
    };
    mergeReorderedTasks(previousTasks, optimisticPayload);

    // onError handler restores by calling setQueryData(key, context.previousTasks).
    // We verify here that `previousTasks` (the snapshot) is untouched by mergeReorderedTasks.
    expect(previousTasks[0].status).toBe(TaskStatus.Todo);
    expect(previousTasks[1].status).toBe(TaskStatus.Todo);
  });
});

// ---------------------------------------------------------------------------
// mergeTasks  (applied in onSuccess to replace optimistic state with server data)
// ---------------------------------------------------------------------------

describe('mergeTasks', () => {
  it('replaces tasks found in updatedTasks with the server version', () => {
    const serverVersion = makeTask({
      id: 'a',
      status: TaskStatus.InProgress,
      position: 0,
    });
    const current = [
      makeTask({ id: 'a', status: TaskStatus.Todo, position: 0 }),
      makeTask({ id: 'b', status: TaskStatus.Backlog, position: 0 }),
    ];

    const merged = mergeTasks(current, [serverVersion]);

    expect(merged.find((t) => t.id === 'a')).toEqual(serverVersion);
    expect(merged.find((t) => t.id === 'b')!.status).toBe(TaskStatus.Backlog);
  });

  it('returns tasks sorted in board order after merging', () => {
    const current = [
      makeTask({ id: 'x', status: TaskStatus.Done, position: 0 }),
      makeTask({ id: 'y', status: TaskStatus.Backlog, position: 0 }),
    ];

    const merged = mergeTasks(current, []);
    const ids = merged.map((t) => t.id);
    expect(ids.indexOf('y')).toBeLessThan(ids.indexOf('x'));
  });
});
