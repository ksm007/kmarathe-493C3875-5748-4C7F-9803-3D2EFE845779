import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { newDb } from 'pg-mem';
import { DataSource, Repository } from 'typeorm';
import { Role, TaskCategory, TaskPriority, TaskStatus } from '@nx-temp/data';
import { AiService } from './ai/ai.service';
import { AuditService } from './audit/audit.service';
import { AuthService } from './auth/auth.service';
import { ChatRateLimiterService } from './chat/chat-rate-limiter.service';
import { ChatService } from './chat/chat.service';
import {
  AuditLogEntity,
  ChatMessageEntity,
  ChatPendingActionEntity,
  LlmInteractionEntity,
  OrganizationEntity,
  TaskActivityEntity,
  TaskEmbeddingEntity,
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
  let taskActivitiesRepository: Repository<TaskActivityEntity>;
  let taskEmbeddingsRepository: Repository<TaskEmbeddingEntity>;
  let llmInteractionsRepository: Repository<LlmInteractionEntity>;
  let chatMessagesRepository: Repository<ChatMessageEntity>;
  let chatPendingActionsRepository: Repository<ChatPendingActionEntity>;

  let usersService: UsersService;
  let organizationsService: OrganizationsService;
  let auditService: AuditService;
  let aiService: AiService;
  let authService: AuthService;
  let tasksService: TasksService;
  let chatService: ChatService;

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
      entities: [
        OrganizationEntity,
        UserEntity,
        TaskEntity,
        TaskActivityEntity,
        TaskEmbeddingEntity,
        AuditLogEntity,
        ChatMessageEntity,
        ChatPendingActionEntity,
        LlmInteractionEntity,
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    organizationsRepository = dataSource.getRepository(OrganizationEntity);
    usersRepository = dataSource.getRepository(UserEntity);
    tasksRepository = dataSource.getRepository(TaskEntity);
    auditRepository = dataSource.getRepository(AuditLogEntity);
    taskActivitiesRepository = dataSource.getRepository(TaskActivityEntity);
    taskEmbeddingsRepository = dataSource.getRepository(TaskEmbeddingEntity);
    llmInteractionsRepository = dataSource.getRepository(LlmInteractionEntity);
    chatMessagesRepository = dataSource.getRepository(ChatMessageEntity);
    chatPendingActionsRepository = dataSource.getRepository(ChatPendingActionEntity);

    organizationsService = new OrganizationsService(organizationsRepository);
    usersService = new UsersService(usersRepository, organizationsService);
    auditService = new AuditService(auditRepository);
    const configService = new ConfigService({
      CANARY_TOKEN: '__SYSTEM_BOUNDARY_42__',
      MAX_CHAT_REQUESTS_PER_MINUTE: 20,
    });
    aiService = new AiService(
      tasksRepository,
      taskActivitiesRepository,
      taskEmbeddingsRepository,
      llmInteractionsRepository,
      organizationsService,
      configService
    );
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
      usersRepository,
      taskActivitiesRepository,
      organizationsService,
      auditService,
      aiService
    );
    chatService = new ChatService(
      chatMessagesRepository,
      chatPendingActionsRepository,
      aiService,
      auditService,
      tasksService,
      new ChatRateLimiterService(configService)
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
    const task = await tasksService.createTask(toAuthUser(ownerUser), {
      title: 'Locked task',
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
      assigneeId: viewerUser?.id ?? null,
    });

    await expect(
      tasksService.updateTask(toAuthUser(viewerUser), task.id, {
        title: 'Edited title',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    const auditEntries = await auditService.list(20);
    expect(auditEntries.some((entry) => entry.reason === 'viewer_read_only')).toBe(true);
  });

  it('limits viewer reads to created or assigned tasks within the org', async () => {
    const { viewerUser, ownerUser } = await seedHierarchy();

    await createTask(ownerUser.id, ownerUser.organizationId, 'Invisible task');
    await tasksService.createTask(toAuthUser(ownerUser), {
      title: 'Assigned task',
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
      assigneeId: viewerUser?.id ?? null,
    });

    const visibleTasks = await tasksService.listTasks(toAuthUser(viewerUser), {});
    expect(visibleTasks.map((task) => task.title)).toEqual(['Assigned task']);
  });

  it('creates and confirms a pending chat task mutation', async () => {
    const { ownerUser } = await seedHierarchy();

    const askResult = await chatService.ask(
      toAuthUser(ownerUser),
      'Create task to review auth logs tomorrow #security'
    );

    expect(askResult.pendingAction?.status).toBe('pending');
    expect(askResult.message.pendingAction?.status).toBe('pending');

    const confirmation = await chatService.confirmPendingAction(
      toAuthUser(ownerUser),
      askResult.pendingAction!.id
    );

    expect(confirmation.pendingAction.status).toBe('confirmed');
    const tasks = await tasksService.listTasks(toAuthUser(ownerUser), {});
    expect(tasks.some((task) => task.title.includes('review auth logs'))).toBe(true);
  });

  it('respects requested in-progress status on chat-created tasks', async () => {
    const { ownerUser } = await seedHierarchy();

    const askResult = await chatService.ask(
      toAuthUser(ownerUser),
      'Create a task to write unit tests for the user module and add it to in progress'
    );

    await chatService.confirmPendingAction(toAuthUser(ownerUser), askResult.pendingAction!.id);

    const tasks = await tasksService.listTasks(toAuthUser(ownerUser), {});
    const createdTask = tasks.find((task) => task.title === 'write unit tests for the user module');
    expect(createdTask?.status).toBe(TaskStatus.InProgress);
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
