import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, ManyToOne } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'audit_logs' })
export class AuditLogEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId!: string | null;

  @ManyToOne(() => UserEntity, (user) => user.auditLogs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  actor!: UserEntity | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actorEmail!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId!: string | null;

  @Column({ type: 'varchar', length: 120 })
  action!: string;

  @Column({ type: 'varchar', length: 80 })
  resource!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'boolean', default: true })
  allowed!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
