import { CurrentUser, RequirePermissions } from '@nx-temp/auth';
import { Permission, UserQuery } from '@nx-temp/data';
import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(Permission.TaskRead)
  list(@CurrentUser() user: never, @Query() query: UserQuery) {
    return this.usersService.listScopedUsers(user, query.organizationId);
  }
}
