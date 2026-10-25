import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Site } from '../../site/entities/site.entity';
import { Cluster } from '../../cluster/entities/cluster.entity';
import { User } from '../../user/entities/user.entity';

@Entity('tm_site_media')
export class Media {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  media_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  media_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  media_path: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  media_desc: string;

  @Column({ type: 'datetime', nullable: true })
  media_date: Date;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @ManyToOne(() => Cluster)
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
