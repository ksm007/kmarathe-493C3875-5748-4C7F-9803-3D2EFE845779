import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { TaskCategory, TaskPriority, TaskStatus, Role } from '@nx-temp/data';
import { apiDataSource } from '../app/database/data-source';
import {
  MembershipEntity,
  OrganizationEntity,
  TaskEntity,
  UserEntity,
} from '../app/database/entities';

async function seed() {
  await apiDataSource.initialize();

  const orgsRepo = apiDataSource.getRepository(OrganizationEntity);
  const usersRepo = apiDataSource.getRepository(UserEntity);
  const membershipsRepo = apiDataSource.getRepository(MembershipEntity);
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

  await tasksRepo.save([
    tasksRepo.create({
      title: 'Review quarterly security checklist',
      description: 'Validate RBAC, secrets rotation, and vendor access.',
      status: TaskStatus.Todo,
      category: TaskCategory.Ops,
      priority: TaskPriority.High,
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
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
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
      status: TaskStatus.Todo,
      category: TaskCategory.Work,
      priority: TaskPriority.High,
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
      category: TaskCategory.Personal,
      priority: TaskPriority.Low,
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
