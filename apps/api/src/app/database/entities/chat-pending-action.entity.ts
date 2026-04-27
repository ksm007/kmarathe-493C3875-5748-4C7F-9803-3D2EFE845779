import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'chat_pending_actions' })
@Index(['userId', 'status', 'createdAt'])
export class ChatPendingActionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 24 })
  actionType!: 'create_task' | 'update_task' | 'delete_task';

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status!: 'pending' | 'confirmed' | 'cancelled';

  @Column({ type: 'varchar', length: 255 })
  summary!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 36, nullable: true })
  taskId!: string | null;
}
