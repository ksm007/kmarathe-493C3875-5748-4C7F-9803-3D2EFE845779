import { SprintQuery, SprintState } from '@nx-temp/data';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SprintQueryDto implements SprintQuery {
  @IsOptional()
  @IsEnum(SprintState)
  state?: SprintState;

  @IsOptional()
  @IsString()
  organizationId?: string;
}
