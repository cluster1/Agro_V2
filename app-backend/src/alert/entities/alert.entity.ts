import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Cluster } from '../../cluster/entities/cluster.entity';
import { AlarmCode } from './alarm-code.entity';
import { SensorRead } from '../../monitoring/entities/sensor-read.entity';

@Entity('tm_alarm')
export class Alert {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  alm_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  alcode_id: string;

  @Column({ type: 'int', nullable: true })
  read_id: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'datetime', nullable: true })
  alm_date: Date;

  @ManyToOne(() => Cluster)
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster;

  @ManyToOne(() => AlarmCode)
  @JoinColumn({ name: 'alcode_id' })
  alarmCode: AlarmCode;

  @ManyToOne(() => SensorRead)
  @JoinColumn({ name: 'read_id' })
  sensorRead: SensorRead;
}
