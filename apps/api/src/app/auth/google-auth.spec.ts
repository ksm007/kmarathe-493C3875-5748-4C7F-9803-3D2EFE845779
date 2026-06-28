import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { newDb } from 'pg-mem';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@nx-temp/data';
import { AuthService } from './auth.service';
import {
  GoogleProfile,
  GoogleVerifierService,
} from './google-verifier.service';
import { LoginAttemptService } from './login-attempt.service';
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
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';

describe('Google sign-in', () => {
  let dataSource: DataSource;
  let usersRepository: Repository<UserEntity>;
  let orgsRepository: Repository<OrganizationEntity>;
  let membershipsRepository: Repository<MembershipEntity>;
  let invitationsRepository: Repository<InvitationEntity>;
  let resetTokensRepository: Repository<PasswordResetTokenEntity>;
  let authService: AuthService;
  let googleVerifier: jest.Mocked<Pick<GoogleVerifierService, 'verifyIdToken'>>;

  const googleProfile: GoogleProfile = {
    googleId: 'google-sub-123',
    email: 'alice@example.com',
    fullName: 'Alice Example',
  };

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

    googleVerifier = { verifyIdToken: jest.fn() } as unknown as jest.Mocked<
      Pick<GoogleVerifierService, 'verifyIdToken'>
    >;

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
      googleVerifier as unknown as GoogleVerifierService,
      { log: jest.fn() } as unknown as AuditService,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  // ── Token verification ────────────────────────────────────────────────────

  it('throws 401 when the Google token is invalid', async () => {
    googleVerifier.verifyIdToken.mockRejectedValue(
      new UnauthorizedException('Invalid Google ID token'),
    );
    await expect(authService.googleSignIn('bad-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('delegates to verifyIdToken and returns a session for a known user', async () => {
    googleVerifier.verifyIdToken.mockResolvedValue(googleProfile);

    const org = await orgsRepository.save(
      orgsRepository.create({
        name: 'Acme',
        slug: 'acme',
        parentOrganizationId: null,
        level: 1,
      }),
    );
    const user = await usersRepository.save(
      usersRepository.create({
        email: 'alice@example.com',
        fullName: 'Alice',
        passwordHash: null,
        googleId: 'google-sub-123',
      }),
    );
    await membershipsRepository.save(
      membershipsRepository.create({
        userId: user.id,
        organizationId: org.id,
        role: Role.Viewer,
      }),
    );

    const result = await authService.googleSignIn('valid-token');
    expect(result.kind).toBe('session');
    expect(googleVerifier.verifyIdToken).toHaveBeenCalledWith('valid-token');
  });

  // ── Account linking ───────────────────────────────────────────────────────

  it('links googleId to an existing email-only account on first Google sign-in', async () => {
    const passwordHash = await bcrypt.hash('hunter2', 10);
    const org = await orgsRepository.save(
      orgsRepository.create({
        name: 'Corp',
        slug: 'corp',
        parentOrganizationId: null,
        level: 1,
      }),
    );
    const user = await usersRepository.save(
      usersRepository.create({
        email: 'alice@example.com',
        fullName: 'Alice',
        passwordHash,
        googleId: null,
      }),
    );
    await membershipsRepository.save(
      membershipsRepository.create({
        userId: user.id,
        organizationId: org.id,
        role: Role.Owner,
      }),
    );

    const result = await authService.googleSignInWithProfile(googleProfile);

    expect(result.kind).toBe('session');
    if (result.kind !== 'session') return;
    expect(result.user.email).toBe('alice@example.com');

    const updated = await usersRepository.findOne({ where: { id: user.id } });
    expect(updated?.googleId).toBe('google-sub-123');
  });

  it('password sign-in still works for a linked account', async () => {
    const passwordHash = await bcrypt.hash('hunter2', 10);
    const org = await orgsRepository.save(
      orgsRepository.create({
        name: 'Corp2',
        slug: 'corp2',
        parentOrganizationId: null,
        level: 1,
      }),
    );
    const user = await usersRepository.save(
      usersRepository.create({
        email: 'alice@example.com',
        fullName: 'Alice',
        passwordHash,
        googleId: 'google-sub-123',
      }),
    );
    await membershipsRepository.save(
      membershipsRepository.create({
        userId: user.id,
        organizationId: org.id,
        role: Role.Owner,
      }),
    );

    const result = await authService.login('alice@example.com', 'hunter2');
    expect(result.accessToken).toBeDefined();
  });

  it('does not duplicate membership on repeated Google sign-ins', async () => {
    const org = await orgsRepository.save(
      orgsRepository.create({
        name: 'Acme2',
        slug: 'acme2',
        parentOrganizationId: null,
        level: 1,
      }),
    );
    const user = await usersRepository.save(
      usersRepository.create({
        email: 'alice@example.com',
        fullName: 'Alice',
        passwordHash: null,
        googleId: 'google-sub-123',
      }),
    );
    await membershipsRepository.save(
      membershipsRepository.create({
        userId: user.id,
        organizationId: org.id,
        role: Role.Viewer,
      }),
    );

    await authService.googleSignInWithProfile(googleProfile);
    await authService.googleSignInWithProfile(googleProfile);

    const count = await membershipsRepository.count({
      where: { userId: user.id },
    });
    expect(count).toBe(1);
  });

  // ── ADR 0005: no silent org creation ──────────────────────────────────────

  it('returns needs-org for a brand-new Google identity with no account', async () => {
    const result = await authService.googleSignInWithProfile(googleProfile);

    expect(result.kind).toBe('needs-org');
    if (result.kind !== 'needs-org') return;
    expect(result.email).toBe('alice@example.com');
    expect(result.hasPendingInvitations).toBe(false);

    const userCount = await usersRepository.count();
    expect(userCount).toBe(0);

    const orgCount = await orgsRepository.count();
    expect(orgCount).toBe(0);
  });

  it('returns needs-org for an existing user who has no org membership', async () => {
    await usersRepository.save(
      usersRepository.create({
        email: 'alice@example.com',
        fullName: 'Alice',
        passwordHash: null,
        googleId: null,
      }),
    );

    const result = await authService.googleSignInWithProfile(googleProfile);

    expect(result.kind).toBe('needs-org');
    if (result.kind !== 'needs-org') return;
    expect(result.hasPendingInvitations).toBe(false);

    const orgCount = await orgsRepository.count();
    expect(orgCount).toBe(0);
  });

  it('sets hasPendingInvitations=true when a pending invite exists for the email', async () => {
    const inviter = await usersRepository.save(
      usersRepository.create({
        email: 'boss@example.com',
        fullName: 'Boss',
        passwordHash: null,
        googleId: null,
      }),
    );
    const org = await orgsRepository.save(
      orgsRepository.create({
        name: 'Team',
        slug: 'team',
        parentOrganizationId: null,
        level: 1,
      }),
    );
    await invitationsRepository.save(
      invitationsRepository.create({
        email: 'alice@example.com',
        organizationId: org.id,
        invitedById: inviter.id,
        role: Role.Viewer,
        tokenHash: 'abc123hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
      }),
    );

    const result = await authService.googleSignInWithProfile(googleProfile);

    expect(result.kind).toBe('needs-org');
    if (result.kind !== 'needs-org') return;
    expect(result.hasPendingInvitations).toBe(true);
  });

  it('sets hasPendingInvitations=false when the only invite is already accepted', async () => {
    const inviter = await usersRepository.save(
      usersRepository.create({
        email: 'boss2@example.com',
        fullName: 'Boss2',
        passwordHash: null,
        googleId: null,
      }),
    );
    const org = await orgsRepository.save(
      orgsRepository.create({
        name: 'OldTeam',
        slug: 'oldteam',
        parentOrganizationId: null,
        level: 1,
      }),
    );
    await invitationsRepository.save(
      invitationsRepository.create({
        email: 'alice@example.com',
        organizationId: org.id,
        invitedById: inviter.id,
        role: Role.Viewer,
        tokenHash: 'deadbeefhash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(),
      }),
    );

    const result = await authService.googleSignInWithProfile(googleProfile);

    expect(result.kind).toBe('needs-org');
    if (result.kind !== 'needs-org') return;
    expect(result.hasPendingInvitations).toBe(false);
  });
});
