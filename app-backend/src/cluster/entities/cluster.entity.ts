import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Site } from '../../site/entities/site.entity';
import { Device } from '../../device/entities/device.entity';

@Entity('tm_cluster')
export class Cluster {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 64 })
  cluster_name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_type: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ptype_id: string;

  @Column({ type: 'int', nullable: true })
  cluster_capacity: number;

  @Column({ type: 'int', nullable: true })
  cluster_current: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cluster_desc: string;

  @CreateDateColumn({ type: 'datetime', nullable: true })
  cluster_created: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  cluster_update: Date;

  @ManyToOne(() => Tenant, tenant => tenant.clusters)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Site, site => site.clusters)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @OneToMany(() => Device, device => device.cluster)
  devices: Device[];
}
