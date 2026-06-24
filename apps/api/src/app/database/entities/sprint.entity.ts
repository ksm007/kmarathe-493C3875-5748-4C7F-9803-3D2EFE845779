import { SprintState } from '@nx-temp/data';
import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { TaskEntity } from './task.entity';

@Entity({ name: 'sprints' })
@Index(['organizationId', 'state'])
export class SprintEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  goal!: string | null;

  @Column({ type: 'varchar', length: 24, default: SprintState.Planned })
  state!: SprintState;

  @Column({ type: 'int', nullable: true })
  capacityPoints!: number | null;

  @Column({ type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'varchar', length: 36 })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  organization!: OrganizationEntity;

  @OneToMany(() => TaskEntity, (task) => task.sprint)
  tasks!: TaskEntity[];
}
