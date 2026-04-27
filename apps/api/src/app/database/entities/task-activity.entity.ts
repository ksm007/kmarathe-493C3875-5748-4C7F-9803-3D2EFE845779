import { TaskActivityType } from '@nx-temp/data';
import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { TaskEntity } from './task.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'task_activities' })
@Index(['taskId', 'createdAt'])
export class TaskActivityEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  taskId!: string;

  @ManyToOne(() => TaskEntity, (task) => task.activities, {
    onDelete: 'CASCADE',
  })
  task!: TaskEntity;

  @Column({ type: 'varchar', length: 36 })
  organizationId!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId!: string | null;

  @ManyToOne(() => UserEntity, (user) => user.taskActivities, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  actor!: UserEntity | null;

  @Column({ type: 'varchar', length: 48 })
  type!: TaskActivityType;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
