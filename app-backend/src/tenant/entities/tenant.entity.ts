import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Site } from '../../site/entities/site.entity';
import { Cluster } from '../../cluster/entities/cluster.entity';
import { Device } from '../../device/entities/device.entity';

@Entity('tm_tenant')
export class Tenant {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  tenant_id: string;

  @Column({ type: 'varchar', length: 128 })
  tenant_name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tenant_address: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tenant_contact: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  tenant_pic: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tenant_logo: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  tenant_sts: string;

  @CreateDateColumn({ type: 'datetime', nullable: true })
  tenant_created: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  tenant_update: Date;

  @OneToMany(() => User, user => user.tenant)
  users: User[];

  @OneToMany(() => Site, site => site.tenant)
  sites: Site[];

  @OneToMany(() => Cluster, cluster => cluster.tenant)
  clusters: Cluster[];

  @OneToMany(() => Device, device => device.tenant)
  devices: Device[];
}
