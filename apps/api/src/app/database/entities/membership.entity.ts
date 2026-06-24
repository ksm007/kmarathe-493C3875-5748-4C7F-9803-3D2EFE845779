import { Role } from '@nx-temp/data';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { OrganizationEntity } from './organization.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'memberships' })
@Index(['userId', 'organizationId'], { unique: true })
export class MembershipEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  userId!: string;

  @ManyToOne(() => UserEntity, (user) => user.memberships, { onDelete: 'CASCADE' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 36 })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, (org) => org.memberships, { onDelete: 'CASCADE' })
  organization!: OrganizationEntity;

  @Column({ type: 'varchar', length: 24 })
  role!: Role;
}
