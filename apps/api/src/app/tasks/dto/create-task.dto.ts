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
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AcceptanceCriteriaItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(240)
  text!: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

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
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AcceptanceCriteriaItemDto)
  acceptanceCriteria?: AcceptanceCriteriaItemDto[];

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
