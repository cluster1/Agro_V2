import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DeviceSensor } from '../../device-sensor/entities/device-sensor.entity';

@Entity('tm_sensor_read')
export class SensorRead {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  read_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ds_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  dev_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  log_rx_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'datetime', nullable: true })
  read_date: Date;

  @Column({ type: 'varchar', length: 128, nullable: true })
  read_value: string;

  @Column({ type: 'int', nullable: true, default: 1 })
  read_sts: number;

  @ManyToOne(() => DeviceSensor)
  @JoinColumn([
    { name: 'ds_id', referencedColumnName: 'ds_id' },
    { name: 'dev_id', referencedColumnName: 'dev_id' }
  ])
  deviceSensor: DeviceSensor;
}
