import { cosineSimilarity, embedText } from '@nx-temp/ai';
import { Role, TaskCategory, TaskPriority, TaskStatus } from '@nx-temp/data';
import { TasksService } from './tasks.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDocument(title: string, description: string): string {
  return [
    `[Task ID]: test-id`,
    `[Title]: ${title}`,
    `[Description]: ${description || 'None'}`,
    `[Category]: work`,
    `[Status]: todo`,
    `[Priority]: high`,
    `[Organization]: Test Org`,
    `[Creator]: Test User`,
    `[Assignee]: Unassigned`,
    `[Due Date]: None`,
    `[Tags]: None`,
    `[Activity]: Task created: ${title}`,
  ].join('\n');
}

const USER = {
  id: 'user-1',
  organizationId: 'org-1',
  organizationName: 'Test Org',
  role: Role.Admin,
  email: 'test@test.com',
  fullName: 'Test User',
  memberships: [{ organizationId: 'org-1', organizationName: 'Test Org', role: Role.Admin }],
};

const BASE_PAYLOAD = {
  title: '',
  description: '',
  category: TaskCategory.Work,
  priority: TaskPriority.High,
  status: TaskStatus.Todo,
  tags: [] as string[],
};

function makeService(storedTasks: Array<{ id: string; title: string; description: string }>) {
  const embeddings = storedTasks.map((t) => ({
    taskId: t.id,
    organizationId: 'org-1',
    document: buildDocument(t.title, t.description),
    embedding: [],
  }));

  const taskRows = storedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
  }));

  const savedTask = {
    id: 'new-id',
    title: 'placeholder',
    description: null,
    status: TaskStatus.Todo,
    priority: TaskPriority.Medium,
    category: TaskCategory.Work,
    organizationId: 'org-1',
    createdById: 'user-1',
    assigneeId: null,
    dueDate: null,
    tags: [],
    position: 0,
    organization: { id: 'org-1', name: 'Test Org' },
    createdBy: { id: 'user-1', fullName: 'Test User' },
    assignee: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return new TasksService(
    // tasksRepository
    {
      findOne: jest.fn().mockResolvedValue(savedTask),
      find: jest.fn().mockResolvedValue(taskRows),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation((v: unknown) => Promise.resolve({ ...(v as object), id: 'new-id' })),
    } as never,
    // organizationsRepository
    {} as never,
    // usersRepository
    { findOne: jest.fn().mockResolvedValue(null) } as never,
    // taskActivitiesRepository
    {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation((v: unknown) => Promise.resolve(v)),
    } as never,
    // taskEmbeddingsRepository
    { find: jest.fn().mockResolvedValue(embeddings) } as never,
    // organizationsService
    { getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-1']) } as never,
    // auditService
    { log: jest.fn() } as never,
    // aiService
    { syncTaskEmbedding: jest.fn() } as never,
  );
}

// ---------------------------------------------------------------------------
// Similarity unit tests — validate the math before testing the service
// ---------------------------------------------------------------------------

describe('embedText / cosineSimilarity', () => {
  it('identical strings → 1.0', () => {
    const text = 'Fix login authentication timeout bug';
    expect(cosineSimilarity(embedText(text), embedText(text))).toBe(1);
  });

  it('same words in different order → > 0.85', () => {
    const a = 'Fix login authentication timeout bug';
    const b = 'Authentication login bug timeout fix';
    const score = cosineSimilarity(embedText(a), embedText(b));
    console.log(`  same-words-diff-order: ${score.toFixed(4)}`);
    expect(score).toBeGreaterThan(0.85);
  });

  it('near-identical title+description pair → > 0.80', () => {
    const a = 'Fix login authentication timeout bug Users are getting logged out after 30 minutes because the token refresh is broken';
    const b = 'Authentication login timeout fix Users are being logged out after 30 minutes due to token refresh failing';
    const score = cosineSimilarity(embedText(a), embedText(b));
    console.log(`  near-identical full text: ${score.toFixed(4)}`);
    expect(score).toBeGreaterThan(0.80);
  });

  it('clearly different tasks → < 0.5', () => {
    const a = 'Fix login authentication timeout bug';
    const b = 'Deploy new payment gateway to production environment';
    const score = cosineSimilarity(embedText(a), embedText(b));
    console.log(`  clearly different: ${score.toFixed(4)}`);
    expect(score).toBeLessThan(0.5);
  });

  it('extractTitleDescription produces same text as raw title+description', () => {
    const title = 'Fix login bug';
    const desc = 'Users get 401 errors on login';
    const doc = buildDocument(title, desc);
    const titleMatch = doc.match(/\[Title\]:\s*(.+)/)?.[1]?.trim() ?? '';
    const rawDesc = doc.match(/\[Description\]:\s*(.+)/)?.[1]?.trim() ?? '';
    const extracted = `${titleMatch} ${rawDesc !== 'None' ? rawDesc : ''}`.trim();
    const score = cosineSimilarity(embedText(extracted), embedText(`${title} ${desc}`));
    console.log(`  extractTitleDescription match: ${score.toFixed(4)}`);
    expect(score).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TasksService — duplicate detection integration
// ---------------------------------------------------------------------------

describe('TasksService duplicate detection', () => {
  it('blocks creation when a near-identical task already exists', async () => {
    const service = makeService([
      {
        id: 'task-1',
        title: 'Fix login authentication timeout bug',
        description: 'Users are getting logged out after 30 minutes because the token refresh is broken',
      },
    ]);

    await expect(
      service.createTask(USER, {
        ...BASE_PAYLOAD,
        title: 'Authentication login timeout fix',
        description: 'Users are being logged out after 30 minutes due to token refresh failing',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Potential duplicate tasks detected',
        duplicates: expect.arrayContaining([
          expect.objectContaining({ id: 'task-1' }),
        ]),
      }),
    });
  });

  it('allows creation when task is clearly different', async () => {
    const service = makeService([
      {
        id: 'task-1',
        title: 'Fix login authentication timeout bug',
        description: 'Users are getting logged out after 30 minutes',
      },
    ]);

    await expect(
      service.createTask(USER, {
        ...BASE_PAYLOAD,
        title: 'Deploy new payment gateway',
        description: 'Integrate Stripe for subscription billing',
      }),
    ).resolves.toBeDefined();
  });

  it('allows creation when no embeddings exist yet', async () => {
    const service = makeService([]);

    await expect(
      service.createTask(USER, { ...BASE_PAYLOAD, title: 'First task ever' }),
    ).resolves.toBeDefined();
  });
});
