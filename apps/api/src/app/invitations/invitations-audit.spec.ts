import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { newDb } from 'pg-mem';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@nx-temp/data';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { GoogleVerifierService } from '../auth/google-verifier.service';
import { LoginAttemptService } from '../auth/login-attempt.service';
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
} from '../database/entities';
import { EmailService } from '../email/email.service';
import { InvitationsService } from './invitations.service';

const OWNER_AUTH = {
  id: 'owner-id',
  email: 'owner@acme.test',
  fullName: 'Owner User',
  role: Role.Owner,
  organizationId: 'org-1',
  organizationName: 'Acme',
  memberships: [
    { organizationId: 'org-1', organizationName: 'Acme', role: Role.Owner },
  ],
};

describe('invitation audit logging', () => {
  let dataSource: DataSource;
  let usersRepository: Repository<UserEntity>;
  let orgsRepository: Repository<OrganizationEntity>;
  let membershipsRepository: Repository<MembershipEntity>;
  let invitationsRepository: Repository<InvitationEntity>;
  let resetTokensRepository: Repository<PasswordResetTokenEntity>;
  let auditRepository: Repository<AuditLogEntity>;
  let auditService: AuditService;
  let authService: AuthService;
  let invitationsService: InvitationsService;

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

    usersRepository = dataSource.getRepository(UserEntity);
    orgsRepository = dataSource.getRepository(OrganizationEntity);
    membershipsRepository = dataSource.getRepository(MembershipEntity);
    invitationsRepository = dataSource.getRepository(InvitationEntity);
    resetTokensRepository = dataSource.getRepository(PasswordResetTokenEntity);
    auditRepository = dataSource.getRepository(AuditLogEntity);

    const emailService = new EmailService(
      new ConfigService({
        RESEND_API_KEY: '',
        APP_URL: 'http://localhost:3000',
        FROM_EMAIL: 'noreply@test.com',
      }),
    );
    const loginAttemptService = new LoginAttemptService(
      new ConfigService({
        LOGIN_MAX_FAILED_ATTEMPTS: 5,
        LOGIN_LOCKOUT_SECONDS: 900,
      }),
    );
    const googleVerifier = {
      verifyIdToken: jest.fn(),
    } as unknown as GoogleVerifierService;

    auditService = new AuditService(auditRepository);

    authService = new AuthService(
      new JwtService({
        secret: 'test-secret',
        signOptions: { expiresIn: '1h' as never },
      }),
      new ConfigService({ JWT_SECRET: 'test-secret', JWT_EXPIRES_IN: '1h' }),
      emailService,
      usersRepository,
      orgsRepository,
      membershipsRepository,
      invitationsRepository,
      resetTokensRepository,
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
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  async function seedOrg() {
    const org = await orgsRepository.save(
      orgsRepository.create({
        name: 'Acme',
        slug: 'acme',
        parentOrganizationId: null,
        level: 1,
      }),
    );
    const ownerUser = await usersRepository.save(
      usersRepository.create({
        id: OWNER_AUTH.id,
        email: OWNER_AUTH.email,
        fullName: OWNER_AUTH.fullName,
        passwordHash: null,
        googleId: null,
      }),
    );
    await membershipsRepository.save(
      membershipsRepository.create({
        userId: ownerUser.id,
        organizationId: org.id,
        role: Role.Owner,
      }),
    );
    return { org, ownerUser };
  }

  it('creates an allowed audit entry when an invitation is sent', async () => {
    const { org } = await seedOrg();
    const actor = { ...OWNER_AUTH, organizationId: org.id };

    await invitationsService.create(actor, 'invitee@acme.test', Role.Viewer);

    const entries = await auditRepository.find({
      where: { action: 'invitations.create' },
    });
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.allowed).toBe(true);
    expect(entry.actorId).toBe(actor.id);
    expect(entry.actorEmail).toBe(actor.email);
    expect(entry.organizationId).toBe(org.id);
    expect(entry.resource).toBe('invitation');
    expect(entry.resourceId).toBeNull();
    expect(entry.metadata).toMatchObject({
      role: Role.Viewer,
      targetEmail: 'invitee@acme.test',
    });
  });

  it('creates an allowed audit entry when an invitation is accepted', async () => {
    const { org } = await seedOrg();
    const rawToken = await authService.createInviteToken(
      org.id,
      'newmember@acme.test',
      Role.Admin,
      OWNER_AUTH.id,
    );

    await authService.acceptInvitation(rawToken, 'New Member', 'Password123!');

    const entries = await auditRepository.find({
      where: { action: 'invitations.accept' },
    });
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.allowed).toBe(true);
    expect(entry.actorEmail).toBe('newmember@acme.test');
    expect(entry.organizationId).toBe(org.id);
    expect(entry.resource).toBe('invitation');
    expect(entry.metadata).toMatchObject({
      invitedEmail: 'newmember@acme.test',
      role: Role.Admin,
    });
  });

  it('creates a denied audit entry when an expired token is used', async () => {
    const expiredToken = 'expired-raw-token-value';
    const tokenHash = require('crypto')
      .createHash('sha256')
      .update(expiredToken)
      .digest('hex');
    const { org } = await seedOrg();
    await invitationsRepository.save(
      invitationsRepository.create({
        email: 'someone@acme.test',
        organizationId: org.id,
        invitedById: OWNER_AUTH.id,
        role: Role.Viewer,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000),
        acceptedAt: null,
      }),
    );

    await expect(
      authService.acceptInvitation(expiredToken, 'Someone', 'Password123!'),
    ).rejects.toThrow('Invite link is invalid or has expired');

    const entries = await auditRepository.find({
      where: { action: 'invitations.accept' },
    });
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.allowed).toBe(false);
    expect(entry.reason).toBe('Invite link is invalid or has expired');
  });

  it('creates a denied audit entry when a completely invalid token is used', async () => {
    await expect(
      authService.acceptInvitation('no-such-token', 'Someone', 'Password123!'),
    ).rejects.toThrow('Invite link is invalid or has expired');

    const entries = await auditRepository.find({
      where: { action: 'invitations.accept' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].allowed).toBe(false);
    expect(entries[0].reason).toBe('Invite link is invalid or has expired');
  });

  it('creates a denied audit entry when a used (already-accepted) token is replayed', async () => {
    const { org } = await seedOrg();
    const rawToken = await authService.createInviteToken(
      org.id,
      'replay@acme.test',
      Role.Viewer,
      OWNER_AUTH.id,
    );

    await authService.acceptInvitation(rawToken, 'Replay User', 'Password123!');

    await expect(
      authService.acceptInvitation(rawToken, 'Replay User', 'Password123!'),
    ).rejects.toThrow('Invite link is invalid or has expired');

    const entries = await auditRepository.find({
      where: { action: 'invitations.accept' },
      order: { createdAt: 'ASC' },
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].allowed).toBe(true);
    expect(entries[1].allowed).toBe(false);
    expect(entries[1].reason).toBe('Invite link is invalid or has expired');
  });
});
