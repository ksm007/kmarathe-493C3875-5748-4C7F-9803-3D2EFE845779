import { ChatHistoryQuery } from '@nx-temp/data';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Max, Min } from 'class-validator';

export class ChatHistoryQueryDto implements ChatHistoryQuery {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  before?: string;
}
