import { RegisterRequest } from '@nx-temp/data';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  organizationName!: string;
}
