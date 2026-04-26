import { TaskCategory, TaskPriority, TaskStatus } from '@nx-temp/data';
import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'tasks' })
@Index(['organizationId', 'status', 'position'])
export class TaskEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 32, default: TaskStatus.Todo })
  status!: TaskStatus;

  @Column({ type: 'varchar', length: 32 })
  category!: TaskCategory;

  @Column({ type: 'varchar', length: 32, default: TaskPriority.Medium })
  priority!: TaskPriority;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'varchar', length: 36 })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.tasks, {
    onDelete: 'CASCADE',
  })
  organization!: OrganizationEntity;

  @Column({ type: 'varchar', length: 36 })
  createdById!: string;

  @ManyToOne(() => UserEntity, (user) => user.createdTasks, {
    onDelete: 'CASCADE',
  })
  createdBy!: UserEntity;
}
