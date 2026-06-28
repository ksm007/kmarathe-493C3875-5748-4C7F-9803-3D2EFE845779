import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleVerifierService } from './google-verifier.service';

jest.mock('google-auth-library');

const MockOAuth2Client = OAuth2Client as jest.MockedClass<typeof OAuth2Client>;

describe('GoogleVerifierService.verifyIdToken', () => {
  let service: GoogleVerifierService;
  let mockVerifyIdToken: jest.Mock;

  beforeEach(() => {
    mockVerifyIdToken = jest.fn();
    MockOAuth2Client.mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    }) as unknown as OAuth2Client);

    service = new GoogleVerifierService(
      new ConfigService({ GOOGLE_CLIENT_ID: 'test-client-id' })
    );
  });

  const makeTicket = (partial: Record<string, unknown>) => ({
    getPayload: () => partial,
  });

  it('returns a GoogleProfile for a valid verified-email token', async () => {
    mockVerifyIdToken.mockResolvedValue(
      makeTicket({ sub: 'uid-1', email: 'alice@example.com', email_verified: true, name: 'Alice' })
    );

    const profile = await service.verifyIdToken('good-token');
    expect(profile).toEqual({ googleId: 'uid-1', email: 'alice@example.com', fullName: 'Alice' });
  });

  it('throws 401 when email_verified is false', async () => {
    mockVerifyIdToken.mockResolvedValue(
      makeTicket({ sub: 'uid-1', email: 'alice@example.com', email_verified: false })
    );

    await expect(service.verifyIdToken('unverified-token')).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when email_verified is missing', async () => {
    mockVerifyIdToken.mockResolvedValue(
      makeTicket({ sub: 'uid-1', email: 'alice@example.com' })
    );

    await expect(service.verifyIdToken('no-verified-field-token')).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when the underlying verifyIdToken call throws', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('token expired'));

    await expect(service.verifyIdToken('bad-token')).rejects.toThrow(UnauthorizedException);
  });
});
