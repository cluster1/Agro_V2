import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tr_alarm_code')
export class AlarmCode {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  alcode_id: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  alcode_note: string;

  @Column({ type: 'int', nullable: true })
  alcode_sts: number;

  @Column({ type: 'datetime', nullable: true })
  alcode_update: Date;
}
