import {
  CreateTaskRequest,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaskDto implements CreateTaskRequest {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(TaskCategory)
  category!: TaskCategory;

  @IsEnum(TaskPriority)
  priority!: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  organizationId?: string;
}
