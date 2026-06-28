import { CurrentUser, Public, RequirePermissions } from '@nx-temp/auth';
import { AuthenticatedUser } from '@nx-temp/auth';
import { InvitationResponse, LoginResponse, Permission } from '@nx-temp/data';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from '../auth/auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly authService: AuthService
  ) {}

  @RequirePermissions(Permission.UserManage)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ auth: true })
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateInvitationDto): Promise<void> {
    return this.invitationsService.create(user, body.email, body.role);
  }

  @RequirePermissions(Permission.UserManage)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<InvitationResponse[]> {
    return this.invitationsService.list(user);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ invite: true })
  @Post('accept')
  accept(@Body() body: AcceptInvitationDto): Promise<LoginResponse> {
    return this.authService.acceptInvitation(body.token, body.fullName, body.password);
  }
}
