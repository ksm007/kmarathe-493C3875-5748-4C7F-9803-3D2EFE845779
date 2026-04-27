import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { TaskCategory, TaskPriority, TaskStatus, Role } from '@nx-temp/data';
import { apiDataSource } from '../app/database/data-source';
import {
  ChatMessageEntity,
  ChatPendingActionEntity,
  LlmInteractionEntity,
  OrganizationEntity,
  TaskActivityEntity,
  TaskEmbeddingEntity,
  TaskEntity,
  UserEntity,
} from '../app/database/entities';

async function seed() {
  await apiDataSource.initialize();

  const organizationsRepository = apiDataSource.getRepository(OrganizationEntity);
  const usersRepository = apiDataSource.getRepository(UserEntity);
  const tasksRepository = apiDataSource.getRepository(TaskEntity);

  await apiDataSource.query(`
    TRUNCATE TABLE
      "llm_interactions",
      "chat_messages",
      "chat_pending_actions",
      "audit_logs",
      "task_embeddings",
      "task_activities",
      "tasks",
      "users",
      "organizations"
    RESTART IDENTITY CASCADE
  `);

  const parentOrganization = organizationsRepository.create({
    name: 'Acme HQ',
    slug: 'acme-hq',
    parentOrganizationId: null,
    level: 1,
  });
  const savedParent = await organizationsRepository.save(parentOrganization);

  const childOrganization = organizationsRepository.create({
    name: 'Acme Field Ops',
    slug: 'acme-field-ops',
    parentOrganizationId: savedParent.id,
    level: 2,
  });
  const savedChild = await organizationsRepository.save(childOrganization);

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const users = await usersRepository.save([
    usersRepository.create({
      email: 'owner@acme.test',
      fullName: 'Olivia Owner',
      role: Role.Owner,
      passwordHash,
      organizationId: savedParent.id,
    }),
    usersRepository.create({
      email: 'admin@acme.test',
      fullName: 'Andy Admin',
      role: Role.Admin,
      passwordHash,
      organizationId: savedParent.id,
    }),
    usersRepository.create({
      email: 'viewer@acme.test',
      fullName: 'Vera Viewer',
      role: Role.Viewer,
      passwordHash,
      organizationId: savedParent.id,
    }),
    usersRepository.create({
      email: 'field-admin@acme.test',
      fullName: 'Casey Field Admin',
      role: Role.Admin,
      passwordHash,
      organizationId: savedChild.id,
    }),
  ]);

  const [owner, admin, viewer, fieldAdmin] = users;

  await tasksRepository.save([
    tasksRepository.create({
      title: 'Review quarterly security checklist',
      description: 'Validate RBAC, secrets rotation, and vendor access.',
      status: TaskStatus.Todo,
      category: TaskCategory.Ops,
      priority: TaskPriority.High,
      assigneeId: admin.id,
      dueDate: new Date().toISOString().slice(0, 10),
      tags: ['security', 'compliance'],
      position: 0,
      organizationId: savedParent.id,
      createdById: owner.id,
    }),
    tasksRepository.create({
      title: 'Prepare executive task summary',
      description: 'Summarize key workstream status for leadership.',
      status: TaskStatus.InProgress,
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
      assigneeId: owner.id,
      dueDate: null,
      tags: ['reporting', 'leadership'],
      position: 0,
      organizationId: savedParent.id,
      createdById: admin.id,
    }),
    tasksRepository.create({
      title: 'Finish route readiness checklist',
      description: 'Confirm the field team has completed truck prep.',
      status: TaskStatus.Todo,
      category: TaskCategory.Work,
      priority: TaskPriority.High,
      assigneeId: fieldAdmin.id,
      dueDate: null,
      tags: ['ops', 'field'],
      position: 0,
      organizationId: savedChild.id,
      createdById: fieldAdmin.id,
    }),
    tasksRepository.create({
      title: 'Update personal development plan',
      description: 'Review training goals for the next quarter.',
      status: TaskStatus.Done,
      category: TaskCategory.Personal,
      priority: TaskPriority.Low,
      assigneeId: viewer.id,
      dueDate: null,
      tags: ['growth'],
      position: 0,
      organizationId: savedParent.id,
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
