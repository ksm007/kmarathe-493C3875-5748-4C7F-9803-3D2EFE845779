import { AiModule } from './ai/ai.module';
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { InvitationsModule } from './invitations/invitations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ReportsModule } from './reports/reports.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    EmailModule,
    AiModule,
    UsersModule,
    OrganizationsModule,
    AuditModule,
    AuthModule,
    InvitationsModule,
    TasksModule,
    ChatModule,
    ReportsModule,
  ],
})
export class AppModule {}
