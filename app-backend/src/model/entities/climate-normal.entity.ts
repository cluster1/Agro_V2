import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tm_climate_normal')
export class ClimateNormal {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  cn_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  /** NORMAL | KERING | BASAH */
  @Column({ type: 'varchar', length: 16, nullable: true })
  cn_scenario: string;

  /** hari ke-n dalam tahun (1-366) */
  @Column({ type: 'int', nullable: true })
  cn_doy: number;

  @Column({ type: 'float', nullable: true })
  cn_tmin: number;

  @Column({ type: 'float', nullable: true })
  cn_tmax: number;

  @Column({ type: 'float', nullable: true })
  cn_rh_mean: number;

  @Column({ type: 'float', nullable: true })
  cn_rain: number;

  @Column({ type: 'float', nullable: true })
  cn_radiation: number;

  @Column({ type: 'float', nullable: true })
  cn_et0: number;

  @Column({ type: 'int', nullable: true })
  cn_year_from: number;

  @Column({ type: 'int', nullable: true })
  cn_year_to: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  cn_source: string;

  @Column({ type: 'datetime', nullable: true })
  cn_update: Date;
}
