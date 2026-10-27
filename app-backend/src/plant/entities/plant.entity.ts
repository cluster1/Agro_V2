import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tm_plant')
export class Plant {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  plant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ptype_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  var_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phase_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  plant_tag: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  plant_name: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  plant_level: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  plant_variety: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  plant_seed_source: string;

  @Column({ type: 'date', nullable: true })
  plant_sow_date: string;

  @Column({ type: 'date', nullable: true })
  plant_date: string;

  /** Format MT{1-3}-{tahun}, mis. MT2-2026 */
  @Column({ type: 'varchar', length: 16, nullable: true })
  plant_season: string;

  @Column({ type: 'date', nullable: true })
  plant_harvest_date: string;

  /** Populasi (rumpun) */
  @Column({ type: 'int', nullable: true })
  plant_count: number;

  /** Luas (ha) */
  @Column({ type: 'double', nullable: true })
  plant_area: number;

  @Column({ type: 'double', nullable: true })
  plant_lon: number;

  @Column({ type: 'double', nullable: true })
  plant_lat: number;

  @Column({ type: 'double', nullable: true })
  plant_alt: number;

  /** GeoJSON Polygon (string) */
  @Column({ type: 'mediumtext', nullable: true })
  plant_geom: string;

  /** AUTO | MANUAL */
  @Column({ type: 'varchar', length: 8, nullable: true, default: 'AUTO' })
  plant_phase_mode: string;

  @Column({ type: 'date', nullable: true })
  plant_phase_date: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  plant_health: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  plant_desc: string;

  /** 1 aktif, 0 ditutup */
  @Column({ type: 'int', nullable: true })
  plant_sts: number;

  @Column({ type: 'datetime', nullable: true })
  plant_created: Date;

  @Column({ type: 'datetime', nullable: true })
  plant_update: Date;
}
