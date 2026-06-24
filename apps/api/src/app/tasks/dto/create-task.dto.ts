import {
  CreateTaskRequest,
  IssueType,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

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
  @IsEnum(IssueType)
  issueType?: IssueType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  storyPoints?: number | null;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
}
