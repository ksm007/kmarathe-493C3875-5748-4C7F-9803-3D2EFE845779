import { TaskCategory, TaskQuery, TaskStatus } from '@nx-temp/data';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class TaskQueryDto implements TaskQuery {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'title', 'priority', 'position'])
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'priority' | 'position';

  @IsOptional()
  @Transform(({ value }) => String(value).toLowerCase())
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;
}
