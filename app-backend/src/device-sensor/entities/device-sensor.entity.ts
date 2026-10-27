import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Sensor } from '../../sensor/entities/sensor.entity';
import { Device } from '../../device/entities/device.entity';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Unit } from '../../unit/entities/unit.entity';

@Entity('td_device_sensor')
export class DeviceSensor {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  ds_id: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  dev_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  sens_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  plant_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  kt_id: string;

  @Column({ type: 'float', nullable: true })
  dc_normal_value: number;

  @Column({ type: 'float', nullable: true })
  ds_min_norm_value: number;

  @Column({ type: 'float', nullable: true })
  ds_max_norm_value: number;

  @Column({ type: 'float', nullable: true })
  ds_min_value: number;

  @Column({ type: 'float', nullable: true })
  ds_max_value: number;

  @Column({ type: 'float', nullable: true })
  ds_min_val_warn: number;

  @Column({ type: 'float', nullable: true })
  ds_max_val_warn: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ds_name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ds_address: string;

  @Column({ type: 'int', nullable: true })
  ds_seq: number;

  @Column({ type: 'int', nullable: true })
  ds_sts: number;

  @CreateDateColumn({ type: 'datetime', nullable: true })
  ds_created: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  ds_update: Date;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Device)
  @JoinColumn({ name: 'dev_id' })
  device: Device;

  @ManyToOne(() => Sensor, sensor => sensor.parameters)
  @JoinColumn([
    { name: 'sens_id', referencedColumnName: 'sens_id' },
    { name: 'dev_id', referencedColumnName: 'dev_id' }
  ])
  sensor: Sensor;

  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;
}
