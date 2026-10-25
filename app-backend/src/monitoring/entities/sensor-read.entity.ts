import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { DeviceSensor } from '../../device-sensor/entities/device-sensor.entity';

@Entity('tm_sensor_read')
export class SensorRead {
  @PrimaryGeneratedColumn()
  read_id: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  dev_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ds_id: string;

  @Column({ type: 'float', nullable: true })
  read_value: number;

  @CreateDateColumn({ type: 'datetime', nullable: true })
  read_date: Date;

  @Column({ type: 'tinyint', nullable: true, default: 1 })
  read_sts: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @ManyToOne(() => DeviceSensor)
  @JoinColumn([
    { name: 'ds_id', referencedColumnName: 'ds_id' },
    { name: 'dev_id', referencedColumnName: 'dev_id' }
  ])
  deviceSensor: DeviceSensor;
}
