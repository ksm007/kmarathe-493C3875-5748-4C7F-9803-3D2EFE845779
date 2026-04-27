import { AddTaskCommentRequest } from '@nx-temp/data';
import { IsString, MaxLength } from 'class-validator';

export class AddTaskCommentDto implements AddTaskCommentRequest {
  @IsString()
  @MaxLength(2000)
  message!: string;
}
