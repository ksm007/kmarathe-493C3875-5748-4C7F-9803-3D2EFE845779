import { CurrentUser, RequirePermissions } from '@nx-temp/auth';
import { Permission } from '@nx-temp/data';
import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CompleteSprintDto } from './dto/complete-sprint.dto';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { SprintQueryDto } from './dto/sprint-query.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { SprintsService } from './sprints.service';

@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get()
  @RequirePermissions(Permission.TaskRead)
  list(@CurrentUser() user: never, @Query() query: SprintQueryDto) {
    return this.sprintsService.listSprints(user, query);
  }

  @Post()
  @RequirePermissions(Permission.SprintManage)
  create(@CurrentUser() user: never, @Body() body: CreateSprintDto) {
    return this.sprintsService.createSprint(user, body);
  }

  @Put(':id')
  @RequirePermissions(Permission.SprintManage)
  update(
    @CurrentUser() user: never,
    @Param('id') id: string,
    @Body() body: UpdateSprintDto,
  ) {
    return this.sprintsService.updateSprint(user, id, body);
  }

  @Patch(':id/start')
  @RequirePermissions(Permission.SprintManage)
  start(@CurrentUser() user: never, @Param('id') id: string) {
    return this.sprintsService.startSprint(user, id);
  }

  @Patch(':id/complete')
  @RequirePermissions(Permission.SprintManage)
  complete(
    @CurrentUser() user: never,
    @Param('id') id: string,
    @Body() body: CompleteSprintDto,
  ) {
    return this.sprintsService.completeSprint(user, id, body);
  }
}
