import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import {
  OrganizationEntity,
  SprintEntity,
  TaskActivityEntity,
  TaskEmbeddingEntity,
  TaskEntity,
  UserEntity,
} from '../database/entities';
import { OrganizationsModule } from '../organizations/organizations.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      OrganizationEntity,
      SprintEntity,
      UserEntity,
      TaskActivityEntity,
      TaskEmbeddingEntity,
    ]),
    AiModule,
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
