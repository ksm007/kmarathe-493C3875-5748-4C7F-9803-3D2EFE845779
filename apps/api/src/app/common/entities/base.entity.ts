import { BeforeInsert, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { randomUUID } from 'node:crypto';

export abstract class BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @BeforeInsert()
  assignId() {
    this.id ??= randomUUID();
  }
}
