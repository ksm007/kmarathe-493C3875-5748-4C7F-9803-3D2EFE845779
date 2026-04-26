import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { newDb } from 'pg-mem';
import { DataSource, Repository } from 'typeorm';
import { Role, TaskCategory, TaskPriority, TaskStatus } from '@nx-temp/data';
import { AuditService } from './audit/audit.service';
import { AuthService } from './auth/auth.service';
import {
  AuditLogEntity,
  OrganizationEntity,
  TaskEntity,
  UserEntity,
} from './database/entities';
import { OrganizationsService } from './organizations/organizations.service';
import { TasksService } from './tasks/tasks.service';
import { UsersService } from './users/users.service';

describe('API integration', () => {
  let dataSource: DataSource;
  let organizationsRepository: Repository<OrganizationEntity>;
  let usersRepository: Repository<UserEntity>;
  let tasksRepository: Repository<TaskEntity>;
  let auditRepository: Repository<AuditLogEntity>;

  let usersService: UsersService;
  let organizationsService: OrganizationsService;
  let auditService: AuditService;
  let authService: AuthService;
  let tasksService: TasksService;

  beforeEach(async () => {
    const db = newDb({ autoCreateForeignKeyIndices: true });
    db.public.registerFunction({
      implementation: () => 'pg-mem',
      name: 'current_database',
    });
    db.public.registerFunction({
      implementation: () => 'PostgreSQL 16.0',
      name: 'version',
    });

    dataSource = await db.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [OrganizationEntity, UserEntity, TaskEntity, AuditLogEntity],
      synchronize: true,
    });
    await dataSource.initialize();

    organizationsRepository = dataSource.getRepository(OrganizationEntity);
    usersRepository = dataSource.getRepository(UserEntity);
    tasksRepository = dataSource.getRepository(TaskEntity);
    auditRepository = dataSource.getRepository(AuditLogEntity);

    usersService = new UsersService(usersRepository);
    organizationsService = new OrganizationsService(organizationsRepository);
    auditService = new AuditService(auditRepository);
    authService = new AuthService(
      usersService,
      new JwtService({
        secret: 'test-secret',
        signOptions: { expiresIn: '1h' as never },
      }),
      new ConfigService({
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '1h',
      })
    );
    tasksService = new TasksService(
      tasksRepository,
      organizationsRepository,
      organizationsService,
      auditService
    );
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('authenticates seeded credentials and rejects invalid passwords', async () => {
    const { owner } = await seedHierarchy();

    const success = await authService.login(owner.email, 'Password123!');
    expect(success.user.role).toBe(Role.Owner);
    expect(success.accessToken).toEqual(expect.any(String));

    await expect(authService.login(owner.email, 'wrong-pass')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('lets an owner see parent and child organization tasks', async () => {
    const { ownerUser, childOrganization } = await seedHierarchy();

    await createTask(ownerUser.id, ownerUser.organizationId, 'Parent task');
    await createTask(ownerUser.id, childOrganization.id, 'Child task');

    const tasks = await tasksService.listTasks(toAuthUser(ownerUser), {});
    expect(tasks.map((task) => task.title).sort()).toEqual(['Child task', 'Parent task']);
  });

  it('blocks an admin from creating a task in a child organization outside scope', async () => {
    const { adminUser, childOrganization } = await seedHierarchy();

    await expect(
      tasksService.createTask(toAuthUser(adminUser), {
        title: 'Forbidden task',
        category: TaskCategory.Work,
        priority: TaskPriority.High,
        organizationId: childOrganization.id,
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a viewer from updating tasks and records the denial', async () => {
    const { viewerUser, ownerUser } = await seedHierarchy();
    const task = await createTask(ownerUser.id, ownerUser.organizationId, 'Locked task');

    await expect(
      tasksService.updateTask(toAuthUser(viewerUser), task.id, {
        title: 'Edited title',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    const auditEntries = await auditService.list(20);
    expect(auditEntries.some((entry) => entry.reason === 'viewer_read_only')).toBe(true);
  });

  async function seedHierarchy() {
    const parentOrganization = await organizationsRepository.save(
      organizationsRepository.create({
        level: 1,
        name: 'Acme HQ',
        parentOrganizationId: null,
        slug: 'acme-hq',
      })
    );

    const childOrganization = await organizationsRepository.save(
      organizationsRepository.create({
        level: 2,
        name: 'Acme Field Ops',
        parentOrganizationId: parentOrganization.id,
        slug: 'acme-field-ops',
      })
    );

    const passwordHash = await bcrypt.hash('Password123!', 10);
    const [ownerUser, adminUser, viewerUser] = await usersRepository.save([
      usersRepository.create({
        email: 'owner@acme.test',
        fullName: 'Olivia Owner',
        organizationId: parentOrganization.id,
        passwordHash,
        role: Role.Owner,
      }),
      usersRepository.create({
        email: 'admin@acme.test',
        fullName: 'Andy Admin',
        organizationId: parentOrganization.id,
        passwordHash,
        role: Role.Admin,
      }),
      usersRepository.create({
        email: 'viewer@acme.test',
        fullName: 'Vera Viewer',
        organizationId: parentOrganization.id,
        passwordHash,
        role: Role.Viewer,
      }),
    ]);

    return {
      owner: ownerUser,
      ownerUser: await usersService.findById(ownerUser.id),
      adminUser: await usersService.findById(adminUser.id),
      viewerUser: await usersService.findById(viewerUser.id),
      childOrganization,
    } as const;
  }

  async function createTask(createdById: string, organizationId: string, title: string) {
    return tasksRepository.save(
      tasksRepository.create({
        category: TaskCategory.Work,
        createdById,
        description: `${title} description`,
        organizationId,
        position: 0,
        priority: TaskPriority.Medium,
        status: TaskStatus.Todo,
        title,
      })
    );
  }

  function toAuthUser(user: UserEntity | null) {
    if (!user) {
      throw new Error('Expected user to be loaded');
    }

    return {
      email: user.email,
      fullName: user.fullName,
      id: user.id,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      role: user.role,
    };
  }
});
