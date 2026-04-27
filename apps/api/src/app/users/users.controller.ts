import { CurrentUser, RequirePermissions } from '@nx-temp/auth';
import { Permission, UserQuery } from '@nx-temp/data';
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(Permission.TaskRead)
  list(@CurrentUser() user: never, @Query() query: UserQuery) {
    return this.usersService.listScopedUsers(user, query.organizationId);
  }

  @Post()
  @RequirePermissions(Permission.UserManage)
  create(@CurrentUser() user: never, @Body() body: CreateTeamMemberDto) {
    return this.usersService.createTeamMember(user, body);
  }

  @Delete(':id')
  @RequirePermissions(Permission.UserManage)
  async remove(@CurrentUser() user: never, @Param('id') id: string) {
    await this.usersService.removeTeamMember(user, id);
    return { success: true };
  }
}
