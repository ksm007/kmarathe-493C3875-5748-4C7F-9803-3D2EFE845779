import { Role } from '@nx-temp/data';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { OrganizationEntity } from './organization.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'invitations' })
export class InvitationEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 36 })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  organization!: OrganizationEntity;

  @Column({ type: 'varchar', length: 36 })
  invitedById!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  invitedBy!: UserEntity;

  @Column({ type: 'varchar', length: 24 })
  role!: Role;

  @Column({ type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;
}
