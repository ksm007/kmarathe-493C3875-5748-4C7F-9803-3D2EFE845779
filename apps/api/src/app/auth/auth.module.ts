import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleVerifierService } from './google-verifier.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LoginAttemptService } from './login-attempt.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import {
  InvitationEntity,
  MembershipEntity,
  OrganizationEntity,
  PasswordResetTokenEntity,
  UserEntity,
} from '../database/entities';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    AuditModule,
    EmailModule,
    TypeOrmModule.forFeature([
      UserEntity,
      OrganizationEntity,
      MembershipEntity,
      InvitationEntity,
      PasswordResetTokenEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '8h') as never,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleVerifierService,
    JwtStrategy,
    LoginAttemptService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
