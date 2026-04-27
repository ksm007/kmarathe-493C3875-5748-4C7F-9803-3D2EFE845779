import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'task_embeddings' })
@Index(['organizationId'])
@Index(['taskId'], { unique: true })
export class TaskEmbeddingEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  taskId!: string;

  @Column({ type: 'varchar', length: 36 })
  organizationId!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  assigneeId!: string | null;

  @Column({ type: 'varchar', length: 36 })
  createdById!: string;

  @Column({ type: 'text' })
  document!: string;

  @Column({ type: 'jsonb' })
  embedding!: number[];

  @Column({ type: 'timestamptz' })
  syncedAt!: Date;
}
