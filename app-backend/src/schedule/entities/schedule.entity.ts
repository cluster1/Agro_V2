import { Entity, Column, PrimaryColumn } from 'typeorm';

/** sched_sts: 0 rencana, 2 selesai, 3 batal, 4 terlambat */
export const SCHEDULE_STATUS = { PLANNED: 0, DONE: 2, CANCELLED: 3, OVERDUE: 4 } as const;

@Entity('tm_plant_schedule')
export class Schedule {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  sched_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  plant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  actype_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phase_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sched_parent_id: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sched_title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sched_desc: string;

  @Column({ type: 'datetime', nullable: true })
  sched_start_date: Date | string;

  @Column({ type: 'datetime', nullable: true })
  sched_end_date: Date | string;

  /** NONE | DAILY | WEEKLY | MONTHLY */
  @Column({ type: 'varchar', length: 16, nullable: true, default: 'NONE' })
  sched_repeat: string;

  @Column({ type: 'int', nullable: true })
  sched_interval: number;

  @Column({ type: 'date', nullable: true })
  sched_repeat_until: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sched_plan_value: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit_id: string;

  /** Jam sebelum mulai untuk pengingat */
  @Column({ type: 'int', nullable: true })
  sched_remind: number;

  /** MANUAL | TEMPLATE | MODEL */
  @Column({ type: 'varchar', length: 16, nullable: true, default: 'MANUAL' })
  sched_source: string;

  @Column({ type: 'int', nullable: true })
  sched_sts: number;

  @Column({ type: 'datetime', nullable: true })
  sched_created: Date;

  @Column({ type: 'datetime', nullable: true })
  sched_update: Date;
}
