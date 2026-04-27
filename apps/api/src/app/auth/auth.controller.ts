import { CurrentUser, Public } from '@nx-temp/auth';
import { LoginResponse } from '@nx-temp/data';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('register')
  register(@Body() body: RegisterDto): Promise<LoginResponse> {
    return this.authService.register(body.email, body.fullName, body.password, body.organizationName);
  }

  @Get('me')
  me(@CurrentUser() user: LoginResponse['user']) {
    return user;
  }
}
