import { CurrentUser, Public } from '@nx-temp/auth';
import { GoogleAuthResponse, LoginResponse } from '@nx-temp/data';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ invite: true })
  @Post('login')
  login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ invite: true })
  @Post('register')
  register(@Body() body: RegisterDto): Promise<LoginResponse> {
    return this.authService.register(
      body.email,
      body.fullName,
      body.password,
      body.organizationName,
    );
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ invite: true })
  @Post('google')
  googleSignIn(@Body() body: GoogleSignInDto): Promise<GoogleAuthResponse> {
    return this.authService.googleSignIn(body.idToken);
  }

  @Post('switch-org')
  switchOrg(
    @CurrentUser() user: LoginResponse['user'],
    @Body() body: SwitchOrgDto,
  ): Promise<LoginResponse> {
    return this.authService.switchOrg(user.id, body.organizationId);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ invite: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    return this.authService.forgotPassword(body.email);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ invite: true })
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
