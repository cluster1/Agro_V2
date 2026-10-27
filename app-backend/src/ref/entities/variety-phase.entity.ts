import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('td_variety_phase')
export class VarietyPhase {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  vp_id: string;

  @Column({ type: 'varchar', length: 32 })
  var_id: string;

  @Column({ type: 'varchar', length: 32 })
  phase_id: string;

  @Column({ type: 'int', nullable: true })
  vp_start_age: number;

  @Column({ type: 'int', nullable: true })
  vp_end_age: number;

  @Column({ type: 'float', nullable: true })
  vp_gdd_start: number;

  @Column({ type: 'float', nullable: true })
  vp_gdd_end: number;

  @Column({ type: 'float', nullable: true })
  vp_height_ref: number;

  @Column({ type: 'float', nullable: true })
  vp_tiller_ref: number;

  @Column({ type: 'float', nullable: true })
  vp_bwd_min: number;

  /** ESTIMASI | LITERATUR | KALIBRASI */
  @Column({ type: 'varchar', length: 16, nullable: true })
  vp_source: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vp_note: string;

  @Column({ type: 'int', nullable: true })
  vp_sts: number;

  @Column({ type: 'datetime', nullable: true })
  vp_update: Date;
}
