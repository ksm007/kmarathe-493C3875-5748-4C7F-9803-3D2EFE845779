import { CreateSprintRequest } from '@nx-temp/data';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSprintDto implements CreateSprintRequest {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  goal?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  capacityPoints?: number | null;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  organizationId?: string;
}
