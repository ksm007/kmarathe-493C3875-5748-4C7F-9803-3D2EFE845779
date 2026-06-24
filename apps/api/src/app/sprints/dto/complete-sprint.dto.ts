import { CompleteSprintRequest } from '@nx-temp/data';
import { IsOptional, IsString } from 'class-validator';

export class CompleteSprintDto implements CompleteSprintRequest {
  @IsOptional()
  @IsString()
  destinationSprintId?: string | null;
}
