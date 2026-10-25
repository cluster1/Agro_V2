import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Site } from '../../site/entities/site.entity';
import { Cluster } from '../../cluster/entities/cluster.entity';

@Entity('tm_livestock')
export class Livestock {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  animal_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  animal_tag: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  animal_species: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  animal_breed: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  animal_gender: string;

  @Column({ type: 'date', nullable: true })
  animal_birthdate: Date;

  @Column({ type: 'varchar', length: 16, nullable: true })
  animal_status: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @ManyToOne(() => Cluster)
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster;
}
