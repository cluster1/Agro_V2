import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('td_plant_sim_phase')
export class SimPhase {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  sp_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sim_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phase_id: string;

  @Column({ type: 'int', nullable: true })
  sp_seq: number;

  @Column({ type: 'date', nullable: true })
  sp_start_date: string;

  @Column({ type: 'date', nullable: true })
  sp_end_date: string;

  @Column({ type: 'int', nullable: true })
  sp_start_age: number;

  @Column({ type: 'float', nullable: true })
  sp_gdd_start: number;

  /** ACTUAL | FORECAST | NORMAL */
  @Column({ type: 'varchar', length: 16, nullable: true })
  sp_data_type: string;

  @Column({ type: 'date', nullable: true })
  sp_actual_date: string;

  /** sp_start_date - sp_actual_date (hari) */
  @Column({ type: 'int', nullable: true })
  sp_error_day: number;
}
