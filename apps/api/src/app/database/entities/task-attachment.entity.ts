import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { OrganizationEntity } from './organization.entity';
import { TaskEntity } from './task.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'task_attachments' })
@Index(['organizationId', 'taskId'])
export class TaskAttachmentEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  taskId!: string;

  @ManyToOne(() => TaskEntity, (task) => task.attachments, {
    onDelete: 'CASCADE',
  })
  task!: TaskEntity;

  @Column({ type: 'varchar', length: 36 })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, {
    onDelete: 'CASCADE',
  })
  organization!: OrganizationEntity;

  @Column({ type: 'varchar', length: 36 })
  uploadedById!: string;

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  uploadedBy!: UserEntity;

  @Column({ type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ type: 'varchar', length: 80 })
  contentType!: string;

  @Column({ type: 'int' })
  byteSize!: number;

  @Column({ type: 'varchar', length: 500 })
  storageKey!: string;
}
