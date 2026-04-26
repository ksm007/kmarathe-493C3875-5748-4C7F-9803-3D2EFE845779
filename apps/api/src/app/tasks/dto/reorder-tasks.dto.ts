import { ReorderTasksRequest, TaskStatus } from '@nx-temp/data';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReorderTaskItemDto {
  @IsString()
  id!: string;

  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsInt()
  @Min(0)
  position!: number;
}

export class ReorderTasksDto implements ReorderTasksRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderTaskItemDto)
  tasks!: ReorderTaskItemDto[];
}
