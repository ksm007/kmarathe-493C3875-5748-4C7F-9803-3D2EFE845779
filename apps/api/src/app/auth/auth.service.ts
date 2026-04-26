import { LoginResponse, Role } from '@nx-temp/data';
import { AuthenticatedUser } from '@nx-temp/auth';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../database/entities';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    });

    return {
      accessToken,
      user: this.toCurrentUser(user),
    };
  }

  async validateJwtUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }

    return this.toCurrentUser(user);
  }

  getJwtConfig() {
    return {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      signOptions: {
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '8h'),
      },
    };
  }

  private toCurrentUser(user: UserEntity): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as Role,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
    };
  }
}
