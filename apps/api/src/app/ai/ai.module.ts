import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  LlmInteractionEntity,
  OrganizationEntity,
  TaskActivityEntity,
  TaskEmbeddingEntity,
  TaskEntity,
  UserEntity,
} from '../database/entities';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AiService } from './ai.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      TaskEntity,
      TaskActivityEntity,
      TaskEmbeddingEntity,
      LlmInteractionEntity,
      UserEntity,
      OrganizationEntity,
    ]),
    OrganizationsModule,
  ],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
