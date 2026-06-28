import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { newDb } from 'pg-mem';
import { DataSource, Repository } from 'typeorm';
import {
  Role,
  SprintState,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import { AiService } from './ai/ai.service';
import { AuditService } from './audit/audit.service';
import { AuthService } from './auth/auth.service';
import { GoogleVerifierService } from './auth/google-verifier.service';
import { LoginAttemptService } from './auth/login-attempt.service';
import { ChatRateLimiterService } from './chat/chat-rate-limiter.service';
import { ChatService } from './chat/chat.service';
import {
  AuditLogEntity,
  ChatMessageEntity,
  ChatPendingActionEntity,
  InvitationEntity,
  LlmInteractionEntity,
  MembershipEntity,
  OrganizationEntity,
  PasswordResetTokenEntity,
  SprintEntity,
  TaskActivityEntity,
  TaskAttachmentEntity,
  TaskEmbeddingEntity,
  TaskEntity,
  UserEntity,
} from './database/entities';
import { EmailService } from './email/email.service';
import { InvitationsService } from './invitations/invitations.service';
import { OrganizationsService } from './organizations/organizations.service';
import { AttachmentStorageService } from './tasks/attachment-storage.service';
import { TasksService } from './tasks/tasks.service';
import { UsersService } from './users/users.service';

describe('API integration', () => {
  let dataSource: DataSource;
  let organizationsRepository: Repository<OrganizationEntity>;
  let usersRepository: Repository<UserEntity>;
  let membershipsRepository: Repository<MembershipEntity>;
  let invitationsRepository: Repository<InvitationEntity>;
  let passwordResetTokensRepository: Repository<PasswordResetTokenEntity>;
  let sprintsRepository: Repository<SprintEntity>;
  let tasksRepository: Repository<TaskEntity>;
  let auditRepository: Repository<AuditLogEntity>;
  let taskActivitiesRepository: Repository<TaskActivityEntity>;
  let taskAttachmentsRepository: Repository<TaskAttachmentEntity>;
  let taskEmbeddingsRepository: Repository<TaskEmbeddingEntity>;
  let llmInteractionsRepository: Repository<LlmInteractionEntity>;
  let chatMessagesRepository: Repository<ChatMessageEntity>;
  let chatPendingActionsRepository: Repository<ChatPendingActionEntity>;

  let organizationsService: OrganizationsService;
  let auditService: AuditService;
  let aiService: AiService;
  let authService: AuthService;
  let loginAttemptService: LoginAttemptService;
  let invitationsService: InvitationsService;
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
        MembershipEntity,
        InvitationEntity,
        PasswordResetTokenEntity,
        SprintEntity,
        TaskEntity,
        TaskActivityEntity,
        TaskAttachmentEntity,
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
    membershipsRepository = dataSource.getRepository(MembershipEntity);
    invitationsRepository = dataSource.getRepository(InvitationEntity);
    passwordResetTokensRepository = dataSource.getRepository(
      PasswordResetTokenEntity,
    );
    sprintsRepository = dataSource.getRepository(SprintEntity);
    tasksRepository = dataSource.getRepository(TaskEntity);
    auditRepository = dataSource.getRepository(AuditLogEntity);
    taskActivitiesRepository = dataSource.getRepository(TaskActivityEntity);
    taskAttachmentsRepository = dataSource.getRepository(TaskAttachmentEntity);
    taskEmbeddingsRepository = dataSource.getRepository(TaskEmbeddingEntity);
    llmInteractionsRepository = dataSource.getRepository(LlmInteractionEntity);
    chatMessagesRepository = dataSource.getRepository(ChatMessageEntity);
    chatPendingActionsRepository = dataSource.getRepository(
      ChatPendingActionEntity,
    );

    organizationsService = new OrganizationsService(organizationsRepository);
    auditService = new AuditService(auditRepository);

    const configService = new ConfigService({
      CANARY_TOKEN: '__SYSTEM_BOUNDARY_42__',
      MAX_CHAT_REQUESTS_PER_MINUTE: 20,
    });

    const emailService = new EmailService(
      new ConfigService({
        RESEND_API_KEY: '',
        APP_URL: 'http://localhost:3000',
        FROM_EMAIL: 'noreply@test.com',
      }),
    );

    aiService = new AiService(
      tasksRepository,
      taskActivitiesRepository,
      taskEmbeddingsRepository,
      llmInteractionsRepository,
      organizationsService,
      configService,
    );

    loginAttemptService = new LoginAttemptService(
      new ConfigService({
        LOGIN_MAX_FAILED_ATTEMPTS: 5,
        LOGIN_LOCKOUT_SECONDS: 900,
      }),
    );
    const googleVerifier = {
      verifyIdToken: jest.fn(),
    } as unknown as GoogleVerifierService;

    authService = new AuthService(
      new JwtService({
        secret: 'test-secret',
        signOptions: { expiresIn: '1h' as never },
      }),
      new ConfigService({ JWT_SECRET: 'test-secret', JWT_EXPIRES_IN: '1h' }),
      emailService,
      usersRepository,
      organizationsRepository,
      membershipsRepository,
      invitationsRepository,
      passwordResetTokensRepository,
      loginAttemptService,
      googleVerifier,
      auditService,
    );
    invitationsService = new InvitationsService(
      authService,
      emailService,
      invitationsRepository,
      auditService,
    );

    new UsersService(usersRepository, membershipsRepository);

    tasksService = new TasksService(
      tasksRepository,
      organizationsRepository,
      sprintsRepository,
      usersRepository,
      taskActivitiesRepository,
      taskAttachmentsRepository,
      taskEmbeddingsRepository,
      organizationsService,
      auditService,
      aiService,
      new AttachmentStorageService(
        new ConfigService({
          ATTACHMENT_STORAGE_DIR: '/tmp/turbo-vets-test-attachments',
        }),
      ),
    );
    chatService = new ChatService(
      chatMessagesRepository,
      chatPendingActionsRepository,
      aiService,
      auditService,
      tasksService,
      new ChatRateLimiterService(configService),
    );
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('authenticates seeded credentials and rejects invalid passwords', async () => {
    const { ownerAuthUser } = await seedHierarchy();

    const success = await authService.login(
      ownerAuthUser.email,
      'Password123!',
    );
    expect(success.user.role).toBe(Role.Owner);
    expect(success.accessToken).toEqual(expect.any(String));

    await expect(
      authService.login(ownerAuthUser.email, 'wrong-pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('locks an account out after repeated failed logins and rejects even correct credentials', async () => {
    const { ownerAuthUser } = await seedHierarchy();

    // Five wrong passwords reach the LOGIN_MAX_FAILED_ATTEMPTS threshold.
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(
        authService.login(ownerAuthUser.email, 'wrong-pass'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    // The account is now locked: even the correct password is refused with 429.
    await expect(
      authService.login(ownerAuthUser.email, 'Password123!'),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    await expect(
      authService.login(ownerAuthUser.email, 'Password123!'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('resets the failed-login counter after a successful login', async () => {
    const { ownerAuthUser } = await seedHierarchy();

    // Four failures stay below the threshold of five.
    for (let attempt = 0; attempt < 4; attempt++) {
      await expect(
        authService.login(ownerAuthUser.email, 'wrong-pass'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    // A success clears the counter, so the account never locks out.
    await expect(
      authService.login(ownerAuthUser.email, 'Password123!'),
    ).resolves.toEqual(
      expect.objectContaining({ accessToken: expect.any(String) }),
    );

    for (let attempt = 0; attempt < 4; attempt++) {
      await expect(
        authService.login(ownerAuthUser.email, 'wrong-pass'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      authService.login(ownerAuthUser.email, 'Password123!'),
    ).resolves.toEqual(
      expect.objectContaining({ accessToken: expect.any(String) }),
    );
  });

  it('accepts invitation tokens once and creates the invited membership', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    const token = await authService.createInviteToken(
      ownerAuthUser.organizationId,
      'new-viewer@acme.test',
      Role.Viewer,
      ownerAuthUser.id,
    );

    const response = await authService.acceptInvitation(
      token,
      'New Viewer',
      'Password123!',
    );

    expect(response.user.email).toBe('new-viewer@acme.test');
    expect(response.user.role).toBe(Role.Viewer);
    await expect(
      authService.acceptInvitation(token, 'New Viewer', 'Password123!'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('invalidates all active reset tokens after password reset', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    const owner = await usersRepository.findOneByOrFail({
      id: ownerAuthUser.id,
    });
    const firstToken = 'first-reset-token';
    const secondToken = 'second-reset-token';

    await passwordResetTokensRepository.save([
      passwordResetTokensRepository.create({
        userId: owner.id,
        tokenHash: hashTestToken(firstToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: null,
      }),
      passwordResetTokensRepository.create({
        userId: owner.id,
        tokenHash: hashTestToken(secondToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: null,
      }),
    ]);

    await authService.resetPassword(firstToken, 'NewPassword123!');

    await expect(
      authService.login(owner.email, 'NewPassword123!'),
    ).resolves.toEqual(
      expect.objectContaining({ accessToken: expect.any(String) }),
    );
    await expect(
      authService.resetPassword(secondToken, 'OtherPassword123!'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks admins from inviting owners', async () => {
    const { adminAuthUser } = await seedHierarchy();

    await expect(
      invitationsService.create(
        adminAuthUser,
        'owner-two@acme.test',
        Role.Owner,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an owner see parent and child organization tasks', async () => {
    const { ownerAuthUser, childOrganization } = await seedHierarchy();

    await createTask(
      ownerAuthUser.id,
      ownerAuthUser.organizationId,
      'Parent task',
    );
    await createTask(ownerAuthUser.id, childOrganization.id, 'Child task');

    const tasks = await tasksService.listTasks(ownerAuthUser, {});
    expect(tasks.map((task) => task.title).sort()).toEqual([
      'Child task',
      'Parent task',
    ]);
  });

  it('filters tasks by sprint and backlog assignment', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    const sprint = await sprintsRepository.save(
      sprintsRepository.create({
        capacityPoints: null,
        endDate: null,
        goal: null,
        name: 'Current Sprint',
        organizationId: ownerAuthUser.organizationId,
        startDate: null,
        state: SprintState.Active,
      }),
    );

    await tasksService.createTask(ownerAuthUser, {
      title: 'Sprint task',
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
      sprintId: sprint.id,
    });
    await tasksService.createTask(ownerAuthUser, {
      title: 'Backlog task',
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
    });

    const sprintTasks = await tasksService.listTasks(ownerAuthUser, {
      sprintId: sprint.id,
    });
    const backlogTasks = await tasksService.listTasks(ownerAuthUser, {
      sprintId: 'backlog',
    });

    expect(sprintTasks.map((task) => task.title)).toEqual(['Sprint task']);
    expect(backlogTasks.map((task) => task.title)).toEqual(['Backlog task']);
  });

  it('reorders tasks without refreshing text embeddings', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    const firstTask = await createTask(
      ownerAuthUser.id,
      ownerAuthUser.organizationId,
      'First reorder task',
    );
    const secondTask = await createTask(
      ownerAuthUser.id,
      ownerAuthUser.organizationId,
      'Second reorder task',
    );
    const syncSpy = jest.spyOn(aiService, 'syncTaskEmbedding');

    const reorderedTasks = await tasksService.reorderTasks(ownerAuthUser, {
      tasks: [
        { id: secondTask.id, status: TaskStatus.Todo, position: 0 },
        { id: firstTask.id, status: TaskStatus.InProgress, position: 1 },
      ],
    });

    expect(syncSpy).not.toHaveBeenCalled();
    expect(reorderedTasks.map((task) => task.id)).toEqual([
      secondTask.id,
      firstTask.id,
    ]);
    expect(reorderedTasks.map((task) => task.position)).toEqual([0, 1]);
    expect(
      reorderedTasks.find((task) => task.id === firstTask.id)?.status,
    ).toBe(TaskStatus.InProgress);
  });

  it('stores image-only task attachments in task detail', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    const task = await tasksService.createTask(ownerAuthUser, {
      title: 'Attach screenshot',
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
    });

    const attachment = await tasksService.addAttachment(
      ownerAuthUser,
      task.id,
      {
        originalname: 'screen.png',
        mimetype: 'image/png',
        size: 8,
        buffer: Buffer.from('png-data'),
      },
    );
    const detail = await tasksService.getTaskDetail(ownerAuthUser, task.id);

    expect(attachment.fileName).toBe('screen.png');
    expect(detail.attachments).toEqual([
      expect.objectContaining({
        id: attachment.id,
        contentType: 'image/png',
        byteSize: 8,
      }),
    ]);
  });

  it('rejects non-image task attachments', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    const task = await tasksService.createTask(ownerAuthUser, {
      title: 'Attach document',
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
    });

    await expect(
      tasksService.addAttachment(ownerAuthUser, task.id, {
        originalname: 'notes.pdf',
        mimetype: 'application/pdf',
        size: 8,
        buffer: Buffer.from('pdf-data'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces the free plan open task limit but allows completed history', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    const openTasks = Array.from({ length: 500 }, (_, index) =>
      tasksRepository.create({
        category: TaskCategory.Work,
        createdById: ownerAuthUser.id,
        description: `Open task ${index} description`,
        organizationId: ownerAuthUser.organizationId,
        position: index,
        priority: TaskPriority.Medium,
        status: TaskStatus.Todo,
        title: `Open task ${index}`,
      }),
    );
    await tasksRepository.save(openTasks);

    await expect(
      tasksService.createTask(ownerAuthUser, {
        title: 'Blocked open task',
        category: TaskCategory.Work,
        priority: TaskPriority.Medium,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      tasksService.createTask(ownerAuthUser, {
        title: 'Completed history task',
        category: TaskCategory.Work,
        priority: TaskPriority.Medium,
        status: TaskStatus.Done,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: TaskStatus.Done }));
  });

  it('blocks reopening completed tasks when open task capacity is full', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    const openTasks = Array.from({ length: 500 }, (_, index) =>
      tasksRepository.create({
        category: TaskCategory.Work,
        createdById: ownerAuthUser.id,
        description: `Capacity task ${index} description`,
        organizationId: ownerAuthUser.organizationId,
        position: index,
        priority: TaskPriority.Medium,
        status: TaskStatus.Todo,
        title: `Capacity task ${index}`,
      }),
    );
    await tasksRepository.save(openTasks);
    const completedTask = await tasksRepository.save(
      tasksRepository.create({
        category: TaskCategory.Work,
        createdById: ownerAuthUser.id,
        description: 'Completed task description',
        organizationId: ownerAuthUser.organizationId,
        position: 501,
        priority: TaskPriority.Medium,
        status: TaskStatus.Done,
        title: 'Completed task',
      }),
    );

    await expect(
      tasksService.updateTask(ownerAuthUser, completedTask.id, {
        status: TaskStatus.Todo,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks an admin from creating a task in a child organization outside scope', async () => {
    const { adminAuthUser, childOrganization } = await seedHierarchy();

    await expect(
      tasksService.createTask(adminAuthUser, {
        title: 'Forbidden task',
        category: TaskCategory.Work,
        priority: TaskPriority.High,
        organizationId: childOrganization.id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a viewer from updating tasks and records the denial', async () => {
    const { viewerAuthUser, ownerAuthUser } = await seedHierarchy();
    const task = await tasksService.createTask(ownerAuthUser, {
      title: 'Locked task',
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
      assigneeId: viewerAuthUser.id,
    });

    await expect(
      tasksService.updateTask(viewerAuthUser, task.id, {
        title: 'Edited title',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const auditEntries = await auditService.list(20);
    expect(
      auditEntries.some((entry) => entry.reason === 'viewer_read_only'),
    ).toBe(true);
  });

  it('limits viewer reads to created or assigned tasks within the org', async () => {
    const { viewerAuthUser, ownerAuthUser } = await seedHierarchy();

    await createTask(
      ownerAuthUser.id,
      ownerAuthUser.organizationId,
      'Invisible task',
    );
    await tasksService.createTask(ownerAuthUser, {
      title: 'Assigned task',
      category: TaskCategory.Work,
      priority: TaskPriority.Medium,
      assigneeId: viewerAuthUser.id,
    });

    const visibleTasks = await tasksService.listTasks(viewerAuthUser, {});
    expect(visibleTasks.map((task) => task.title)).toEqual(['Assigned task']);
  });

  it('creates and confirms a pending chat task mutation', async () => {
    const { ownerAuthUser } = await seedHierarchy();

    const askResult = await chatService.ask(
      ownerAuthUser,
      'Create task to review auth logs tomorrow #security',
    );

    expect(askResult.pendingAction?.status).toBe('pending');
    expect(askResult.message.pendingAction?.status).toBe('pending');

    const confirmation = await chatService.confirmPendingAction(
      ownerAuthUser,
      askResult.pendingAction!.id,
    );

    expect(confirmation.pendingAction.status).toBe('confirmed');
    const tasks = await tasksService.listTasks(ownerAuthUser, {});
    expect(tasks.some((task) => task.title.includes('review auth logs'))).toBe(
      true,
    );
  });

  it('respects requested in-progress status on chat-created tasks', async () => {
    const { ownerAuthUser } = await seedHierarchy();

    const askResult = await chatService.ask(
      ownerAuthUser,
      'Create a task to write unit tests for the user module and add it to in progress',
    );

    await chatService.confirmPendingAction(
      ownerAuthUser,
      askResult.pendingAction!.id,
    );

    const tasks = await tasksService.listTasks(ownerAuthUser, {});
    const createdTask = tasks.find(
      (task) => task.title === 'write unit tests for the user module',
    );
    expect(createdTask?.status).toBe(TaskStatus.InProgress);
  });

  it('enforces the daily free plan AI call limit per user', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    await seedLlmInteractions(ownerAuthUser.id, 3, new Date());

    await expect(
      chatService.ask(ownerAuthUser, 'Which tasks need attention?'),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    await expect(
      llmInteractionsRepository.countBy({ userId: ownerAuthUser.id }),
    ).resolves.toBe(3);
  });

  it('does not count previous-day AI calls against today', async () => {
    const { ownerAuthUser } = await seedHierarchy();
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await seedLlmInteractions(ownerAuthUser.id, 3, yesterday);

    await expect(
      chatService.ask(ownerAuthUser, 'Which tasks need attention?'),
    ).resolves.toEqual(
      expect.objectContaining({
        pendingAction: null,
      }),
    );

    await expect(
      llmInteractionsRepository.countBy({ userId: ownerAuthUser.id }),
    ).resolves.toBe(4);
  });

  async function seedHierarchy() {
    const parentOrganization = await organizationsRepository.save(
      organizationsRepository.create({
        level: 1,
        name: 'Acme HQ',
        parentOrganizationId: null,
        slug: 'acme-hq',
      }),
    );
    const childOrganization = await organizationsRepository.save(
      organizationsRepository.create({
        level: 2,
        name: 'Acme Field Ops',
        parentOrganizationId: parentOrganization.id,
        slug: 'acme-field-ops',
      }),
    );

    const passwordHash = await bcrypt.hash('Password123!', 10);
    const [ownerUser, adminUser, viewerUser] = await usersRepository.save([
      usersRepository.create({
        email: 'owner@acme.test',
        fullName: 'Olivia Owner',
        passwordHash,
        googleId: null,
      }),
      usersRepository.create({
        email: 'admin@acme.test',
        fullName: 'Andy Admin',
        passwordHash,
        googleId: null,
      }),
      usersRepository.create({
        email: 'viewer@acme.test',
        fullName: 'Vera Viewer',
        passwordHash,
        googleId: null,
      }),
    ]);

    await membershipsRepository.save([
      membershipsRepository.create({
        userId: ownerUser.id,
        organizationId: parentOrganization.id,
        role: Role.Owner,
      }),
      membershipsRepository.create({
        userId: adminUser.id,
        organizationId: parentOrganization.id,
        role: Role.Admin,
      }),
      membershipsRepository.create({
        userId: viewerUser.id,
        organizationId: parentOrganization.id,
        role: Role.Viewer,
      }),
    ]);

    const toAuth = (user: UserEntity, role: Role, org: OrganizationEntity) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role,
      organizationId: org.id,
      organizationName: org.name,
      memberships: [
        { organizationId: org.id, organizationName: org.name, role },
      ],
    });

    return {
      ownerAuthUser: toAuth(ownerUser, Role.Owner, parentOrganization),
      adminAuthUser: toAuth(adminUser, Role.Admin, parentOrganization),
      viewerAuthUser: toAuth(viewerUser, Role.Viewer, parentOrganization),
      childOrganization,
    } as const;
  }

  async function createTask(
    createdById: string,
    organizationId: string,
    title: string,
  ) {
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
      }),
    );
  }

  function hashTestToken(raw: string) {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async function seedLlmInteractions(
    userId: string,
    count: number,
    createdAt: Date,
  ) {
    const entries = Array.from({ length: count }, (_, index) =>
      llmInteractionsRepository.create({
        userId,
        operation: 'chat.ask',
        provider: 'local',
        model: 'local-grounded',
        inputPreview: `Question ${index}`,
        outputPreview: `Answer ${index}`,
        canaryTriggered: false,
        blockedReason: null,
        metadata: null,
        createdAt,
        updatedAt: createdAt,
      }),
    );

    await llmInteractionsRepository.save(entries);
  }
});
