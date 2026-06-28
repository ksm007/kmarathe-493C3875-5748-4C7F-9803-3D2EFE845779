import { AiModule } from './ai/ai.module';
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { InvitationsModule } from './invitations/invitations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ReportsModule } from './reports/reports.module';
import { SprintsModule } from './sprints/sprints.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Per-IP rate limiting. ThrottlerModule is @Global, so the ThrottlerGuard
    // is opt-in per route via @UseGuards(ThrottlerGuard) on the abuse-prone
    // auth/invite endpoints - it is intentionally NOT registered as an APP_GUARD,
    // so normal authenticated app traffic is never throttled.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'auth',
            ttl: configService.get<number>('AUTH_RATE_LIMIT_TTL_SECONDS', 60) * 1000,
            limit: configService.get<number>('AUTH_RATE_LIMIT_MAX', 10),
          },
          {
            name: 'invite',
            ttl: configService.get<number>('INVITE_RATE_LIMIT_TTL_SECONDS', 60) * 1000,
            limit: configService.get<number>('INVITE_RATE_LIMIT_MAX', 50),
          },
        ],
      }),
    }),
    DatabaseModule,
    EmailModule,
    AiModule,
    UsersModule,
    OrganizationsModule,
    AuditModule,
    AuthModule,
    InvitationsModule,
    SprintsModule,
    TasksModule,
    ChatModule,
    ReportsModule,
  ],
})
export class AppModule {}
