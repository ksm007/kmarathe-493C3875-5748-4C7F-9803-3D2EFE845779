import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import {
  OrganizationEntity,
  SprintEntity,
  TaskActivityEntity,
  TaskAttachmentEntity,
  TaskEmbeddingEntity,
  TaskEntity,
  UserEntity,
} from '../database/entities';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AttachmentStorageService } from './attachment-storage.service';
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
      TaskAttachmentEntity,
      TaskEmbeddingEntity,
    ]),
    AiModule,
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, AttachmentStorageService],
  exports: [TasksService],
})
export class TasksModule {}
