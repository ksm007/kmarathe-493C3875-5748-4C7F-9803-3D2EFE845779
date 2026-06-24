import { CurrentUser, Public } from '@nx-temp/auth';
import { LoginResponse } from '@nx-temp/data';
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';

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

  @Post('switch-org')
  switchOrg(
    @CurrentUser() user: LoginResponse['user'],
    @Body() body: SwitchOrgDto
  ): Promise<LoginResponse> {
    return this.authService.switchOrg(user.id, body.organizationId);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    return this.authService.forgotPassword(body.email);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Get('me')
  me(@CurrentUser() user: LoginResponse['user']) {
    return user;
  }
}
