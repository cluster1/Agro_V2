import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Device } from '../../device/entities/device.entity';
import { DeviceSensor } from '../../device-sensor/entities/device-sensor.entity';

@Entity('td_sensor')
export class Sensor {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  sens_id: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  dev_id: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  tenant_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sens_name: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  sens_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sens_url: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sens_location: string;

  @Column({ type: 'double', nullable: true })
  sens_lat: number;

  @Column({ type: 'double', nullable: true })
  sens_lon: number;

  @Column({ type: 'double', nullable: true })
  sens_alt: number;

  @Column({ type: 'int', nullable: true, default: 0 })
  sens_seq: number;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Device, device => device.sensors)
  @JoinColumn({ name: 'dev_id' })
  device: Device;

  @OneToMany(() => DeviceSensor, deviceSensor => deviceSensor.sensor)
  parameters: DeviceSensor[];
}
