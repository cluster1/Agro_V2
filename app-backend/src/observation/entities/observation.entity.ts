import { Entity, Column, PrimaryColumn } from 'typeorm';

/** obs_sts: 0 draf, 1 tersimpan, 2 terverifikasi, 3 ditolak */
export const OBSERVATION_STATUS = { DRAFT: 0, SAVED: 1, VERIFIED: 2, REJECTED: 3 } as const;

@Entity('tm_plant_observation')
export class Observation {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  obs_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  plant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phase_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  dev_id: string;

  @Column({ type: 'datetime', nullable: true })
  obs_date: Date | string;

  /** HST saat observasi */
  @Column({ type: 'int', nullable: true })
  obs_age: number;

  /** % populasi yang mencapai fase */
  @Column({ type: 'float', nullable: true })
  obs_phase_pct: number;

  @Column({ type: 'int', nullable: true })
  obs_sample_n: number;

  @Column({ type: 'float', nullable: true })
  obs_height: number;

  @Column({ type: 'float', nullable: true })
  obs_tiller: number;

  @Column({ type: 'float', nullable: true })
  obs_bwd: number;

  @Column({ type: 'float', nullable: true })
  obs_panicle: number;

  @Column({ type: 'float', nullable: true })
  obs_grain: number;

  @Column({ type: 'float', nullable: true })
  obs_filled_pct: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  obs_pest_name: string;

  @Column({ type: 'float', nullable: true })
  obs_pest_pct: number;

  /** Kode dipisah koma: N_KUNING, P_GELAP, K_TEPI, KERDIL, ZN_BERCAK, S_PUCAT */
  @Column({ type: 'varchar', length: 64, nullable: true })
  obs_symptom: string;

  @Column({ type: 'double', nullable: true })
  obs_lon: number;

  @Column({ type: 'double', nullable: true })
  obs_lat: number;

  /** WEB | FIELDKIT | API | AI | IMPORT */
  @Column({ type: 'varchar', length: 16, nullable: true })
  obs_source: string;

  @Column({ type: 'float', nullable: true })
  obs_confidence: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  obs_desc: string;

  @Column({ type: 'int', nullable: true })
  obs_sts: number;

  @Column({ type: 'datetime', nullable: true })
  obs_created: Date;

  @Column({ type: 'datetime', nullable: true })
  obs_update: Date;
}
