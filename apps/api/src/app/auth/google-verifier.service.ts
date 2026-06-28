import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

export interface GoogleProfile {
  googleId: string;
  email: string;
  fullName: string;
}

@Injectable()
export class GoogleVerifierService {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.client = new OAuth2Client(this.clientId);
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      fullName: payload.name ?? payload.email,
    };
  }
}
