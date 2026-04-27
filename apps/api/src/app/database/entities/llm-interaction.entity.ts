import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'llm_interactions' })
@Index(['userId', 'createdAt'])
export class LlmInteractionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 80 })
  operation!: string;

  @Column({ type: 'varchar', length: 48 })
  provider!: string;

  @Column({ type: 'varchar', length: 120 })
  model!: string;

  @Column({ type: 'text' })
  inputPreview!: string;

  @Column({ type: 'text' })
  outputPreview!: string;

  @Column({ type: 'boolean', default: false })
  canaryTriggered!: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  blockedReason!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
