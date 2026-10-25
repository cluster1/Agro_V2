import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { DeviceSensor } from '../../device-sensor/entities/device-sensor.entity';

@Entity('tm_sensor_read_update')
export class SensorReadUpdate {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  dev_id: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  ds_id: string;

  @Column({ type: 'float', nullable: true })
  read_update_value: number;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  read_update_date: Date;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @ManyToOne(() => DeviceSensor)
  @JoinColumn([
    { name: 'ds_id', referencedColumnName: 'ds_id' },
    { name: 'dev_id', referencedColumnName: 'dev_id' }
  ])
  deviceSensor: DeviceSensor;
}
