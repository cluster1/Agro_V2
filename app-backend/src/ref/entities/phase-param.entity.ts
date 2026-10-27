import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('td_plant_phase_param')
export class PhaseParam {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  ppp_id: string;

  @Column({ type: 'varchar', length: 32 })
  phase_id: string;

  @Column({ type: 'varchar', length: 64 })
  kt_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit_id: string;

  @Column({ type: 'float', nullable: true })
  ppp_norm_value: number;

  @Column({ type: 'float', nullable: true })
  ppp_min_norm_value: number;

  @Column({ type: 'float', nullable: true })
  ppp_max_norm_value: number;

  @Column({ type: 'float', nullable: true })
  ppp_min_val_warn: number;

  @Column({ type: 'float', nullable: true })
  ppp_max_val_warn: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ppp_note: string;

  @Column({ type: 'int', nullable: true })
  ppp_sts: number;

  @Column({ type: 'datetime', nullable: true })
  ppp_update: Date;
}
