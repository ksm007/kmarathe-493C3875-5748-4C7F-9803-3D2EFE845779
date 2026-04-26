import { AuditLogEntry } from '@nx-temp/data';
import { AuthenticatedUser } from '@nx-temp/auth';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../database/entities';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>
  ) {}

  async log(params: {
    actor?: AuthenticatedUser | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    allowed: boolean;
    reason?: string | null;
    metadata?: Record<string, unknown>;
    organizationId?: string | null;
  }) {
    const entry = this.auditRepository.create({
      actorId: params.actor?.id ?? null,
      actorEmail: params.actor?.email ?? null,
      organizationId: params.organizationId ?? params.actor?.organizationId ?? null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId ?? null,
      allowed: params.allowed,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
    });

    const saved = await this.auditRepository.save(entry);
    this.logger.log(
      `[${saved.allowed ? 'ALLOW' : 'DENY'}] ${saved.action} ${saved.resource} ${saved.resourceId ?? ''}`.trim()
    );
  }

  async list(limit = 50): Promise<AuditLogEntry[]> {
    const logs = await this.auditRepository.find({
      take: Math.min(limit, 100),
      order: { createdAt: 'DESC' },
    });

    return logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorEmail: log.actorEmail,
      organizationId: log.organizationId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      allowed: log.allowed,
      reason: log.reason,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}
