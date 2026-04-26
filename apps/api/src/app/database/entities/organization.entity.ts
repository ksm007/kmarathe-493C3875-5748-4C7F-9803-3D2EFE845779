import { BaseEntity } from '../../common/entities/base.entity';
import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { TaskEntity } from './task.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'organizations' })
export class OrganizationEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  parentOrganizationId!: string | null;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.children, {
    nullable: true,
  })
  parentOrganization!: OrganizationEntity | null;

  @OneToMany(() => OrganizationEntity, (organization) => organization.parentOrganization)
  children!: OrganizationEntity[];

  @Column({ type: 'int', default: 1 })
  level!: number;

  @OneToMany(() => UserEntity, (user) => user.organization)
  users!: UserEntity[];

  @OneToMany(() => TaskEntity, (task) => task.organization)
  tasks!: TaskEntity[];
}
