import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { OrganizationEntity, SprintEntity, TaskEntity } from '../database/entities';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SprintEntity, TaskEntity, OrganizationEntity]),
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [SprintsController],
  providers: [SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
