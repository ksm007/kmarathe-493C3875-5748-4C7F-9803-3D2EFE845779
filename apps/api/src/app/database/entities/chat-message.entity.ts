import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'chat_messages' })
@Index(['userId', 'createdAt'])
export class ChatMessageEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 16 })
  role!: 'user' | 'assistant';

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  sources!: Array<{ taskId: string; title: string; similarity: number }>;

  @Column({ type: 'varchar', length: 36, nullable: true })
  pendingActionId!: string | null;
}
