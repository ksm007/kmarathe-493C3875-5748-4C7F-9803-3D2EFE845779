import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import {
  IssueType,
  Role,
  SprintState,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import { apiDataSource } from '../app/database/data-source';
import {
  MembershipEntity,
  OrganizationEntity,
  SprintEntity,
  TaskEntity,
  UserEntity,
} from '../app/database/entities';

async function seed() {
  await apiDataSource.initialize();

  const orgsRepo = apiDataSource.getRepository(OrganizationEntity);
  const usersRepo = apiDataSource.getRepository(UserEntity);
  const membershipsRepo = apiDataSource.getRepository(MembershipEntity);
  const sprintsRepo = apiDataSource.getRepository(SprintEntity);
  const tasksRepo = apiDataSource.getRepository(TaskEntity);

  await apiDataSource.query(`
    TRUNCATE TABLE
      "llm_interactions",
      "chat_messages",
      "chat_pending_actions",
      "audit_logs",
      "task_embeddings",
      "task_activities",
      "invitations",
      "password_reset_tokens",
      "memberships",
      "tasks",
      "sprints",
      "users",
      "organizations"
    RESTART IDENTITY CASCADE
  `);

  const parentOrg = await orgsRepo.save(
    orgsRepo.create({ name: 'Acme HQ', slug: 'acme-hq', parentOrganizationId: null, level: 1 })
  );
  const childOrg = await orgsRepo.save(
    orgsRepo.create({ name: 'Acme Field Ops', slug: 'acme-field-ops', parentOrganizationId: parentOrg.id, level: 2 })
  );

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const [owner, admin, viewer, fieldAdmin] = await usersRepo.save([
    usersRepo.create({ email: 'owner@acme.test', fullName: 'Olivia Owner', passwordHash, googleId: null }),
    usersRepo.create({ email: 'admin@acme.test', fullName: 'Andy Admin', passwordHash, googleId: null }),
    usersRepo.create({ email: 'viewer@acme.test', fullName: 'Vera Viewer', passwordHash, googleId: null }),
    usersRepo.create({ email: 'field-admin@acme.test', fullName: 'Casey Field Admin', passwordHash, googleId: null }),
  ]);

  await membershipsRepo.save([
    membershipsRepo.create({ userId: owner.id, organizationId: parentOrg.id, role: Role.Owner }),
    membershipsRepo.create({ userId: admin.id, organizationId: parentOrg.id, role: Role.Admin }),
    membershipsRepo.create({ userId: viewer.id, organizationId: parentOrg.id, role: Role.Viewer }),
    membershipsRepo.create({ userId: fieldAdmin.id, organizationId: childOrg.id, role: Role.Admin }),
  ]);

  const operationsEpic = await tasksRepo.save(
    tasksRepo.create({
      title: 'Improve operations readiness',
      description: 'Group work that prepares the team for safer, clearer operating rhythms.',
      status: TaskStatus.Backlog,
      issueType: IssueType.Epic,
      category: TaskCategory.Ops,
      priority: TaskPriority.Medium,
      storyPoints: null,
      acceptanceCriteria: [],
      assigneeId: owner.id,
      dueDate: null,
      tags: ['ops', 'planning'],
      position: 0,
      organizationId: parentOrg.id,
      createdById: owner.id,
    }),
  );

  const activeSprint = await sprintsRepo.save(
    sprintsRepo.create({
      name: 'Current Operations Sprint',
      goal: 'Tighten security and executive reporting workflows.',
      state: SprintState.Active,
      capacityPoints: 12,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: null,
      organizationId: parentOrg.id,
    }),
  );

  await tasksRepo.save([
    tasksRepo.create({
      title: 'Review quarterly security checklist',
      description: 'Validate RBAC, secrets rotation, and vendor access.',
      status: TaskStatus.Todo,
      issueType: IssueType.Task,
      category: TaskCategory.Ops,
      priority: TaskPriority.High,
      storyPoints: 3,
      acceptanceCriteria: [
        {
          id: 'seed-ac-security-1',
          text: 'RBAC permissions reviewed for owner, admin, and viewer roles',
          completed: false,
        },
        {
          id: 'seed-ac-security-2',
          text: 'Secrets rotation checklist is current',
          completed: false,
        },
      ],
      sprintId: activeSprint.id,
      parentEpicId: operationsEpic.id,
      assigneeId: admin.id,
      dueDate: new Date().toISOString().slice(0, 10),
      tags: ['security', 'compliance'],
      position: 0,
      organizationId: parentOrg.id,
      createdById: owner.id,
    }),
    tasksRepo.create({
      title: 'Prepare executive task summary',
      description: 'Summarize key workstream status for leadership.',
      status: TaskStatus.InProgress,
      issueType: IssueType.Story,
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
      storyPoints: 5,
      acceptanceCriteria: [
        {
          id: 'seed-ac-summary-1',
          text: 'Summary includes active work, blockers, and ownership',
          completed: true,
        },
      ],
      sprintId: activeSprint.id,
      parentEpicId: operationsEpic.id,
      assigneeId: owner.id,
      dueDate: null,
      tags: ['reporting', 'leadership'],
      position: 0,
      organizationId: parentOrg.id,
      createdById: admin.id,
    }),
    tasksRepo.create({
      title: 'Finish route readiness checklist',
      description: 'Confirm the field team has completed truck prep.',
      status: TaskStatus.InReview,
      issueType: IssueType.Bug,
      category: TaskCategory.Work,
      priority: TaskPriority.High,
      storyPoints: 2,
      acceptanceCriteria: [
        {
          id: 'seed-ac-route-1',
          text: 'Truck prep checklist is confirmed by field admin',
          completed: false,
        },
      ],
      assigneeId: fieldAdmin.id,
      dueDate: null,
      tags: ['ops', 'field'],
      position: 0,
      organizationId: childOrg.id,
      createdById: fieldAdmin.id,
    }),
    tasksRepo.create({
      title: 'Update personal development plan',
      description: 'Review training goals for the next quarter.',
      status: TaskStatus.Done,
      issueType: IssueType.Task,
      category: TaskCategory.Personal,
      priority: TaskPriority.Low,
      storyPoints: null,
      acceptanceCriteria: [],
      assigneeId: viewer.id,
      dueDate: null,
      tags: ['growth'],
      position: 0,
      organizationId: parentOrg.id,
      createdById: viewer.id,
    }),
  ]);

  await apiDataSource.destroy();
}

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
