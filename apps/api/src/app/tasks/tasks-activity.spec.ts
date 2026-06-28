import {
  IssueType,
  Role,
  TaskActivityType,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import { TasksService } from './tasks.service';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const TASK_ID = 'task-1';
const USER_ID = 'user-actor';
const ASSIGNEE_ID = 'user-assignee';
const NEW_ASSIGNEE_ID = 'user-new-assignee';

const ACTOR = {
  id: USER_ID,
  organizationId: ORG_ID,
  organizationName: 'Test Org',
  role: Role.Admin,
  email: 'actor@test.com',
  fullName: 'Actor User',
  memberships: [{ organizationId: ORG_ID, organizationName: 'Test Org', role: Role.Admin }],
};

function makeTask(overrides: Partial<{
  assigneeId: string | null;
  assigneeName: string | null;
  storyPoints: number | null;
}> = {}) {
  const { assigneeId = null, assigneeName = null, storyPoints = null } = overrides;
  return {
    id: TASK_ID,
    title: 'Test Task',
    description: null,
    status: TaskStatus.Todo,
    priority: TaskPriority.Medium,
    category: TaskCategory.Work,
    issueType: IssueType.Story,
    organizationId: ORG_ID,
    createdById: USER_ID,
    assigneeId,
    storyPoints,
    dueDate: null,
    tags: [],
    position: 0,
    parentEpicId: null,
    sprintId: null,
    acceptanceCriteria: [],
    organization: { id: ORG_ID, name: 'Test Org' },
    createdBy: { id: USER_ID, fullName: 'Actor User' },
    assignee: assigneeId ? { fullName: assigneeName ?? 'Assignee User' } : null,
    sprint: null,
    parentEpic: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeService(task: ReturnType<typeof makeTask>, options: {
  newAssigneeName?: string;
} = {}) {
  const savedActivities: Array<{ type: TaskActivityType; metadata: Record<string, unknown> | null; message: string }> = [];

  const taskAfterSave = { ...task };

  // loadTaskWithRelations returns the hydrated task; for the assignee-change path it may
  // be called a second time after save with the new assignee already on the entity.
  let loadCallCount = 0;
  const findOne = jest.fn().mockImplementation(() => {
    loadCallCount++;
    if (loadCallCount === 1) {
      // First call: getTaskForMutation - return the pre-mutation task
      return Promise.resolve({ ...task });
    }
    // Subsequent calls: post-save, return task with new assignee if set
    const newAssigneeName = options.newAssigneeName;
    return Promise.resolve({
      ...taskAfterSave,
      assignee: taskAfterSave.assigneeId
        ? { fullName: newAssigneeName ?? 'New Assignee' }
        : null,
    });
  });

  const activityCreate = jest.fn().mockImplementation((v: unknown) => v);
  const activitySave = jest.fn().mockImplementation((v: unknown) => {
    savedActivities.push(v as { type: TaskActivityType; metadata: Record<string, unknown> | null; message: string });
    return Promise.resolve(v);
  });

  const service = new TasksService(
    // tasksRepository
    {
      findOne,
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation((v: unknown) => {
        Object.assign(taskAfterSave, v);
        return Promise.resolve({ ...taskAfterSave });
      }),
      // resolveAssigneeId verifies membership via manager.exists
      manager: {
        exists: jest.fn().mockResolvedValue(true),
      },
    } as never,
    // organizationsRepository
    {} as never,
    // sprintsRepository
    { findOne: jest.fn().mockResolvedValue(null) } as never,
    // usersRepository
    {
      findOne: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        if (where?.id === ASSIGNEE_ID) {
          return Promise.resolve({ id: ASSIGNEE_ID, organizationId: ORG_ID, fullName: 'Old Assignee' });
        }
        if (where?.id === NEW_ASSIGNEE_ID) {
          return Promise.resolve({ id: NEW_ASSIGNEE_ID, organizationId: ORG_ID, fullName: 'New Assignee' });
        }
        return Promise.resolve(null);
      }),
    } as never,
    // taskActivitiesRepository
    { create: activityCreate, save: activitySave } as never,
    // taskAttachmentsRepository
    {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ bytes: '0' }),
      }),
    } as never,
    // taskEmbeddingsRepository
    { find: jest.fn().mockResolvedValue([]) } as never,
    // organizationsService
    { getAccessibleOrganizationIds: jest.fn().mockResolvedValue([ORG_ID]) } as never,
    // auditService
    { log: jest.fn() } as never,
    // aiService
    { syncTaskEmbedding: jest.fn() } as never,
    // attachmentStorage
    { save: jest.fn(), remove: jest.fn(), createReadStream: jest.fn() } as never,
  );

  return { service, savedActivities };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TasksService activity emission - assignee_changed', () => {
  it('emits assignee_changed with old/new ids and names when assignee changes', async () => {
    const task = makeTask({ assigneeId: ASSIGNEE_ID, assigneeName: 'Old Assignee' });
    const { service, savedActivities } = makeService(task, { newAssigneeName: 'New Assignee' });

    await service.updateTask(ACTOR, TASK_ID, { assigneeId: NEW_ASSIGNEE_ID });

    const assigneeActivity = savedActivities.find(
      (a) => a.type === TaskActivityType.AssigneeChanged,
    );
    expect(assigneeActivity).toBeDefined();
    expect(assigneeActivity?.metadata).toMatchObject({
      from: ASSIGNEE_ID,
      to: NEW_ASSIGNEE_ID,
    });
  });

  it('emits assignee_changed when assignee is removed (set to null)', async () => {
    const task = makeTask({ assigneeId: ASSIGNEE_ID, assigneeName: 'Old Assignee' });
    const { service, savedActivities } = makeService(task);

    await service.updateTask(ACTOR, TASK_ID, { assigneeId: null });

    const assigneeActivity = savedActivities.find(
      (a) => a.type === TaskActivityType.AssigneeChanged,
    );
    expect(assigneeActivity).toBeDefined();
    expect(assigneeActivity?.metadata).toMatchObject({
      from: ASSIGNEE_ID,
      to: null,
    });
    expect(assigneeActivity?.message).toContain('removed');
  });

  it('does not emit assignee_changed when assignee id is unchanged', async () => {
    const task = makeTask({ assigneeId: ASSIGNEE_ID, assigneeName: 'Old Assignee' });
    const { service, savedActivities } = makeService(task);

    // resolveAssigneeId will return ASSIGNEE_ID (same); mock usersRepository returns it
    await service.updateTask(ACTOR, TASK_ID, { assigneeId: ASSIGNEE_ID });

    const assigneeActivities = savedActivities.filter(
      (a) => a.type === TaskActivityType.AssigneeChanged,
    );
    expect(assigneeActivities).toHaveLength(0);
  });

  it('does not emit assignee_changed when assigneeId is not in the payload', async () => {
    const task = makeTask({ assigneeId: ASSIGNEE_ID });
    const { service, savedActivities } = makeService(task);

    await service.updateTask(ACTOR, TASK_ID, { title: 'New title' });

    const assigneeActivities = savedActivities.filter(
      (a) => a.type === TaskActivityType.AssigneeChanged,
    );
    expect(assigneeActivities).toHaveLength(0);
  });
});

describe('TasksService activity emission - story_point_changed', () => {
  it('emits story_point_changed with old/new values when story points change', async () => {
    const task = makeTask({ storyPoints: 3 });
    const { service, savedActivities } = makeService(task);

    await service.updateTask(ACTOR, TASK_ID, { storyPoints: 8 });

    const spActivity = savedActivities.find(
      (a) => a.type === TaskActivityType.StoryPointChanged,
    );
    expect(spActivity).toBeDefined();
    expect(spActivity?.metadata).toMatchObject({ from: 3, to: 8 });
    expect(spActivity?.message).toContain('3');
    expect(spActivity?.message).toContain('8');
  });

  it('emits story_point_changed when story points are cleared', async () => {
    const task = makeTask({ storyPoints: 5 });
    const { service, savedActivities } = makeService(task);

    await service.updateTask(ACTOR, TASK_ID, { storyPoints: null });

    const spActivity = savedActivities.find(
      (a) => a.type === TaskActivityType.StoryPointChanged,
    );
    expect(spActivity).toBeDefined();
    expect(spActivity?.metadata).toMatchObject({ from: 5, to: null });
    expect(spActivity?.message).toContain('cleared');
  });

  it('emits story_point_changed when story points are set from null', async () => {
    const task = makeTask({ storyPoints: null });
    const { service, savedActivities } = makeService(task);

    await service.updateTask(ACTOR, TASK_ID, { storyPoints: 2 });

    const spActivity = savedActivities.find(
      (a) => a.type === TaskActivityType.StoryPointChanged,
    );
    expect(spActivity).toBeDefined();
    expect(spActivity?.metadata).toMatchObject({ from: null, to: 2 });
  });

  it('does not emit story_point_changed when value is unchanged', async () => {
    const task = makeTask({ storyPoints: 5 });
    const { service, savedActivities } = makeService(task);

    await service.updateTask(ACTOR, TASK_ID, { storyPoints: 5 });

    const spActivities = savedActivities.filter(
      (a) => a.type === TaskActivityType.StoryPointChanged,
    );
    expect(spActivities).toHaveLength(0);
  });

  it('does not emit story_point_changed when storyPoints is not in the payload', async () => {
    const task = makeTask({ storyPoints: 5 });
    const { service, savedActivities } = makeService(task);

    await service.updateTask(ACTOR, TASK_ID, { title: 'New title' });

    const spActivities = savedActivities.filter(
      (a) => a.type === TaskActivityType.StoryPointChanged,
    );
    expect(spActivities).toHaveLength(0);
  });
});

describe('TasksService activity emission - existing types unaffected', () => {
  it('still emits task_updated on every update', async () => {
    const task = makeTask();
    const { service, savedActivities } = makeService(task);

    await service.updateTask(ACTOR, TASK_ID, { title: 'Updated title' });

    expect(
      savedActivities.some((a) => a.type === TaskActivityType.TaskUpdated),
    ).toBe(true);
  });

  it('still emits status_changed when status changes', async () => {
    const task = makeTask();
    const { service, savedActivities } = makeService(task);

    await service.updateTask(ACTOR, TASK_ID, { status: TaskStatus.InProgress });

    expect(
      savedActivities.some((a) => a.type === TaskActivityType.StatusChanged),
    ).toBe(true);
  });
});
