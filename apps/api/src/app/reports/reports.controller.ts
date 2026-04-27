import { CurrentUser, RequirePermissions } from '@nx-temp/auth';
import { Permission } from '@nx-temp/data';
import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('standup')
  @RequirePermissions(Permission.TaskRead)
  async standup(@CurrentUser() user: never) {
    const report = await this.reportsService.generateStandupReport(user);
    return { report };
  }
}
