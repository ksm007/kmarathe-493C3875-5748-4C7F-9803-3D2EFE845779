import { Role } from '@nx-temp/data';
import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { OrganizationEntity } from './organization.entity';
import { TaskActivityEntity } from './task-activity.entity';
import { TaskEntity } from './task.entity';

@Entity({ name: 'users' })
export class UserEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 160 })
  fullName!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 24 })
  role!: Role;

  @Column({ type: 'varchar', length: 36 })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.users, {
    onDelete: 'CASCADE',
  })
  organization!: OrganizationEntity;

  @OneToMany(() => TaskEntity, (task) => task.createdBy)
  createdTasks!: TaskEntity[];

  @OneToMany(() => TaskEntity, (task) => task.assignee)
  assignedTasks!: TaskEntity[];

  @OneToMany(() => TaskActivityEntity, (activity) => activity.actor)
  taskActivities!: TaskActivityEntity[];

  @OneToMany(() => AuditLogEntity, (log) => log.actor)
  auditLogs!: AuditLogEntity[];
}
