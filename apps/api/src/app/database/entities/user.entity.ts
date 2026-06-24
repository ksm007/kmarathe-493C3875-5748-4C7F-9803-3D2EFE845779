import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { MembershipEntity } from './membership.entity';
import { TaskActivityEntity } from './task-activity.entity';
import { TaskEntity } from './task.entity';

@Entity({ name: 'users' })
export class UserEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 160 })
  fullName!: string;

  @Column({ type: 'varchar', length: 255, select: false, nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  googleId!: string | null;

  @OneToMany(() => MembershipEntity, (membership) => membership.user)
  memberships!: MembershipEntity[];

  @OneToMany(() => TaskEntity, (task) => task.createdBy)
  createdTasks!: TaskEntity[];

  @OneToMany(() => TaskEntity, (task) => task.assignee)
  assignedTasks!: TaskEntity[];

  @OneToMany(() => TaskActivityEntity, (activity) => activity.actor)
  taskActivities!: TaskActivityEntity[];

  @OneToMany(() => AuditLogEntity, (log) => log.actor)
  auditLogs!: AuditLogEntity[];
}
