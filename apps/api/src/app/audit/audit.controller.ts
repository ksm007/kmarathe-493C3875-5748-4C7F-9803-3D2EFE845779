import { RequirePermissions } from '@nx-temp/auth';
import { Permission } from '@nx-temp/data';
import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit-log')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AuditRead)
  list(@Query('limit') limit?: string) {
    return this.auditService.list(limit ? Number(limit) : 50);
  }
}
