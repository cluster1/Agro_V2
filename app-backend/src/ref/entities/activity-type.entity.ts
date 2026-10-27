import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tr_activity_type')
export class ActivityType {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  actype_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ptype_id: string;

  @Column({ type: 'varchar', length: 64 })
  actype_name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  actype_category: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit_id: string;

  @Column({ type: 'int', nullable: true, default: 0 })
  actype_need_photo: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actype_desc: string;

  @Column({ type: 'int', nullable: true })
  actype_sts: number;

  @Column({ type: 'datetime', nullable: true })
  actype_update: Date;
}
