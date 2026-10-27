import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Site } from '../../site/entities/site.entity';
import { Cluster } from '../../cluster/entities/cluster.entity';
import { User } from '../../user/entities/user.entity';
import { Sensor } from '../../sensor/entities/sensor.entity';

@Entity('tm_device')
export class Device {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  dev_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 64 })
  dev_name: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  dev_token: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  dev_location: string;

  @Column({ type: 'double', nullable: true })
  dev_lon: number;

  @Column({ type: 'double', nullable: true })
  dev_lat: number;

  @Column({ type: 'double', nullable: true })
  dev_alt: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  dev_number_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  dev_ip: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  dev_port: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  dev_img: string;

  @Column({ type: 'int', nullable: true })
  dev_sts: number;

  @CreateDateColumn({ type: 'datetime', nullable: true })
  dev_created: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  dev_update: Date;

  @ManyToOne(() => Tenant, tenant => tenant.devices)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @ManyToOne(() => Cluster, cluster => cluster.devices)
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Sensor, sensor => sensor.device)
  sensors: Sensor[];
}
