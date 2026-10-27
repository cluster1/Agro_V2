import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tr_kode_telemetri')
export class TelemetryCode {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  kt_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  kt_name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  kt_norm_value: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  kt_min_value: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  kt_max_value: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  kt_min_value_warn: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  kt_max_value_warn: string;

  @Column({ type: 'int', nullable: true })
  kt_sts: number;
}
