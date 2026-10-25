import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Cluster } from '../../cluster/entities/cluster.entity';

@Entity('tm_site')
export class Site {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  site_id: string;

  @Column({ type: 'varchar', length: 32 })
  tenant_id: string;

  @Column({ type: 'varchar', length: 64 })
  site_name: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  site_type: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  site_address: string;

  @Column({ type: 'double', nullable: true })
  site_lon: number;

  @Column({ type: 'double', nullable: true })
  site_lat: number;

  @Column({ type: 'double', nullable: true })
  site_alt: number;

  @Column({ type: 'int', nullable: true })
  site_sts: number;

  @CreateDateColumn({ type: 'datetime', nullable: true })
  site_created: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  site_update: Date;

  @ManyToOne(() => Tenant, tenant => tenant.sites)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => Cluster, cluster => cluster.site)
  clusters: Cluster[];
}
