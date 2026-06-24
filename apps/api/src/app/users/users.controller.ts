import { CurrentUser, RequirePermissions } from '@nx-temp/auth';
import { Permission } from '@nx-temp/data';
import { Body, Controller, Delete, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(Permission.TaskRead)
  list(@CurrentUser() user: never) {
    return this.usersService.listScopedUsers(user);
  }

  @Delete(':id')
  @RequirePermissions(Permission.UserManage)
  async remove(@CurrentUser() user: never, @Param('id') id: string) {
    await this.usersService.removeTeamMember(user, id);
    return { success: true };
  }
}
