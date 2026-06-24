import { Role } from '@nx-temp/data';
import { IsEmail, IsEnum } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;
}
