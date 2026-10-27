import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { AlarmCode } from './alarm-code.entity';
import { SensorRead } from '../../monitoring/entities/sensor-read.entity';

@Entity('tm_alarm')
export class Alert {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  alm_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  alcode_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  read_id: string;

  @Column({ type: 'datetime', nullable: true })
  alm_date: Date;

  /** 0 baru, 1 dilihat, 2 selesai */
  @Column({ type: 'int', nullable: true, default: 0 })
  alm_sts: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  alm_ack_user: string;

  @Column({ type: 'datetime', nullable: true })
  alm_ack_date: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alm_note: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => AlarmCode)
  @JoinColumn({ name: 'alcode_id' })
  alarmCode: AlarmCode;

  @ManyToOne(() => SensorRead)
  @JoinColumn({ name: 'read_id' })
  sensorRead: SensorRead;
}
