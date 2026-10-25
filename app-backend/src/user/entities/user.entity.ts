import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Exclude } from 'class-transformer';

@Entity('tm_user')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  user_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  user_name: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  @Exclude()
  user_pass: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  user_email: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  user_phone: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  user_role: string;

  @Column({ type: 'int', nullable: true })
  user_level: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  user_sts: string;

  @CreateDateColumn({ type: 'datetime', nullable: true })
  user_created: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  user_update: Date;

  @ManyToOne(() => Tenant, tenant => tenant.users)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
