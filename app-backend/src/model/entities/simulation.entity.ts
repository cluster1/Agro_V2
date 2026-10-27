import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tm_plant_simulation')
export class Simulation {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  sim_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  plant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  var_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phase_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_id: string;

  @Column({ type: 'datetime', nullable: true })
  sim_date: Date;

  @Column({ type: 'varchar', length: 16, nullable: true })
  sim_model: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  sim_model_ver: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  sim_scenario: string;

  /** JSON seluruh parameter dan faktor yang dipakai run */
  @Column({ type: 'text', nullable: true })
  sim_param: string;

  @Column({ type: 'date', nullable: true })
  sim_cutoff_date: string;

  @Column({ type: 'date', nullable: true })
  sim_forecast_until: string;

  @Column({ type: 'int', nullable: true })
  sim_age_now: number;

  @Column({ type: 'float', nullable: true })
  sim_gdd_now: number;

  @Column({ type: 'float', nullable: true })
  sim_growth_idx: number;

  @Column({ type: 'float', nullable: true })
  sim_n_def: number;

  @Column({ type: 'float', nullable: true })
  sim_p2o5_def: number;

  @Column({ type: 'float', nullable: true })
  sim_k2o_def: number;

  @Column({ type: 'date', nullable: true })
  sim_harvest_date: string;

  @Column({ type: 'float', nullable: true })
  sim_yield: number;

  @Column({ type: 'float', nullable: true })
  sim_yield_low: number;

  @Column({ type: 'float', nullable: true })
  sim_yield_high: number;

  @Column({ type: 'float', nullable: true })
  sim_confidence: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sim_note: string;

  /** 1 untuk run terbaru per tanaman dan skenario */
  @Column({ type: 'int', nullable: true })
  sim_is_latest: number;

  @Column({ type: 'int', nullable: true })
  sim_sts: number;

  @Column({ type: 'datetime', nullable: true })
  sim_created: Date;
}
