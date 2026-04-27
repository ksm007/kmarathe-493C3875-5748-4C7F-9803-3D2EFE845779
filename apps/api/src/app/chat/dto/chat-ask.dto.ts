import { ChatAskRequest } from '@nx-temp/data';
import { IsString, MaxLength } from 'class-validator';

export class ChatAskDto implements ChatAskRequest {
  @IsString()
  @MaxLength(4000)
  message!: string;
}
