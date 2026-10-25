import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tr_alarm_code')
export class AlarmCode {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  alcode_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  alcode_note: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alcode_desc: string;
}
