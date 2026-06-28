import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitationsController } from '../invitations/invitations.controller';
import { InvitationsService } from '../invitations/invitations.service';

/**
 * HTTP-level coverage proving the ThrottlerGuard is actually wired onto the
 * abuse-prone auth/invite routes and returns 429 past the per-IP limit.
 */
describe('Auth/invite rate limiting (HTTP)', () => {
  const AUTH_LIMIT = 3;
  const INVITE_LIMIT = 6;
  let app: INestApplication;

  const authServiceMock = {
    login: jest.fn().mockResolvedValue({ accessToken: 'token', user: { id: 'u1' } }),
    register: jest.fn().mockResolvedValue({ accessToken: 'token', user: { id: 'u1' } }),
    googleSignIn: jest.fn().mockResolvedValue({ kind: 'session', accessToken: 'token', user: { id: 'u1' } }),
    forgotPassword: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn().mockResolvedValue(undefined),
    acceptInvitation: jest.fn().mockResolvedValue({ accessToken: 'token', user: { id: 'u1' } }),
  };
  const invitationsServiceMock = {
    create: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'auth', ttl: 60_000, limit: AUTH_LIMIT },
            { name: 'invite', ttl: 60_000, limit: INVITE_LIMIT },
          ],
        }),
      ],
      controllers: [AuthController, InvitationsController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: InvitationsService, useValue: invitationsServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function flood(path: string, body: object, okStatus: number, limit: number) {
    for (let i = 0; i < limit; i++) {
      await request(app.getHttpServer()).post(path).send(body).expect(okStatus);
    }
    return request(app.getHttpServer()).post(path).send(body);
  }

  it('returns 429 once POST /auth/login exceeds the per-IP limit', async () => {
    const blocked = await flood('/auth/login', { email: 'a@b.com', password: 'x' }, 201, AUTH_LIMIT);
    expect(blocked.status).toBe(429);
  });

  it('returns 429 once POST /auth/register exceeds the per-IP limit', async () => {
    const blocked = await flood(
      '/auth/register',
      { email: 'a@b.com', fullName: 'A', password: 'x', organizationName: 'Org' },
      201,
      AUTH_LIMIT
    );
    expect(blocked.status).toBe(429);
  });

  it('returns 429 once POST /auth/forgot-password exceeds the per-IP limit', async () => {
    const blocked = await flood('/auth/forgot-password', { email: 'a@b.com' }, 204, AUTH_LIMIT);
    expect(blocked.status).toBe(429);
  });

  it('returns 429 once POST /auth/google exceeds the per-IP limit', async () => {
    const blocked = await flood('/auth/google', { idToken: 'fake.google.token' }, 201, AUTH_LIMIT);
    expect(blocked.status).toBe(429);
  });

  it('returns 429 once POST /invitations/accept exceeds the per-IP limit', async () => {
    const blocked = await flood(
      '/invitations/accept',
      { token: 't', fullName: 'A', password: 'x' },
      201,
      AUTH_LIMIT
    );
    expect(blocked.status).toBe(429);
  });

  it('governs POST /invitations create by the separate, higher invite limit', async () => {
    const body = { email: 'a@b.com', role: 'member' };

    // Sails past the tighter 'auth' limit because create skips it...
    for (let i = 0; i < AUTH_LIMIT + 1; i++) {
      await request(app.getHttpServer()).post('/invitations').send(body).expect(204);
    }

    // ...and only trips 429 once the higher 'invite' limit is exceeded.
    const blocked = await flood('/invitations', body, 204, INVITE_LIMIT - (AUTH_LIMIT + 1));
    expect(blocked.status).toBe(429);
  });
});
