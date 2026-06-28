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
  const LIMIT = 3;
  let app: INestApplication;

  const authServiceMock = {
    login: jest.fn().mockResolvedValue({ accessToken: 'token', user: { id: 'u1' } }),
    register: jest.fn().mockResolvedValue({ accessToken: 'token', user: { id: 'u1' } }),
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
      imports: [ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: LIMIT }] })],
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

  async function flood(path: string, body: object, okStatus: number) {
    for (let i = 0; i < LIMIT; i++) {
      await request(app.getHttpServer()).post(path).send(body).expect(okStatus);
    }
    return request(app.getHttpServer()).post(path).send(body);
  }

  it('returns 429 once POST /auth/login exceeds the per-IP limit', async () => {
    const blocked = await flood('/auth/login', { email: 'a@b.com', password: 'x' }, 201);
    expect(blocked.status).toBe(429);
  });

  it('returns 429 once POST /auth/register exceeds the per-IP limit', async () => {
    const blocked = await flood(
      '/auth/register',
      { email: 'a@b.com', fullName: 'A', password: 'x', organizationName: 'Org' },
      201
    );
    expect(blocked.status).toBe(429);
  });

  it('returns 429 once POST /auth/forgot-password exceeds the per-IP limit', async () => {
    const blocked = await flood('/auth/forgot-password', { email: 'a@b.com' }, 204);
    expect(blocked.status).toBe(429);
  });

  it('returns 429 once POST /invitations/accept exceeds the per-IP limit', async () => {
    const blocked = await flood(
      '/invitations/accept',
      { token: 't', fullName: 'A', password: 'x' },
      201
    );
    expect(blocked.status).toBe(429);
  });
});
