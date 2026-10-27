import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tr_plant_phase')
export class PlantPhase {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  phase_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ptype_id: string;

  @Column({ type: 'varchar', length: 64 })
  phase_name: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  phase_code: string;

  @Column({ type: 'int', nullable: true })
  phase_seq: number;

  @Column({ type: 'int', nullable: true })
  phase_start_age: number;

  @Column({ type: 'int', nullable: true })
  phase_end_age: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  phase_color: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phase_desc: string;

  @Column({ type: 'int', nullable: true })
  phase_sts: number;

  @Column({ type: 'datetime', nullable: true })
  phase_update: Date;
}
