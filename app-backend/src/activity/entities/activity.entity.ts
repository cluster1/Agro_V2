import { Entity, Column, PrimaryColumn } from 'typeorm';

/** pact_sts: 0 draf, 1 tersimpan, 2 terverifikasi, 3 ditolak */
export const ACTIVITY_STATUS = { DRAFT: 0, SAVED: 1, VERIFIED: 2, REJECTED: 3 } as const;

@Entity('tm_plant_activity')
export class Activity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  pact_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  plant_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sched_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  actype_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phase_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  dev_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pact_desc: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  pact_value: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  mat_id: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  pact_material: string;

  @Column({ type: 'int', nullable: true })
  pact_worker: number;

  @Column({ type: 'double', nullable: true })
  pact_cost: number;

  @Column({ type: 'double', nullable: true })
  pact_lon: number;

  @Column({ type: 'double', nullable: true })
  pact_lat: number;

  /** WEB | FIELDKIT | API | IMPORT */
  @Column({ type: 'varchar', length: 16, nullable: true })
  pact_source: string;

  @Column({ type: 'datetime', nullable: true })
  pact_date: Date | string;

  @Column({ type: 'int', nullable: true })
  pact_sts: number;

  @Column({ type: 'datetime', nullable: true })
  pact_created: Date;

  @Column({ type: 'datetime', nullable: true })
  pact_update: Date;
}
