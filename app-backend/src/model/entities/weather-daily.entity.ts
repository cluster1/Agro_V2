import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tm_weather_daily')
export class WeatherDailyRow {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  wd_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  dev_id: string;

  @Column({ type: 'date', nullable: true })
  wd_date: string;

  /** ACTUAL | FORECAST */
  @Column({ type: 'varchar', length: 16, nullable: true })
  wd_type: string;

  @Column({ type: 'float', nullable: true })
  wd_tmin: number;

  @Column({ type: 'float', nullable: true })
  wd_tmax: number;

  @Column({ type: 'float', nullable: true })
  wd_tmean: number;

  @Column({ type: 'float', nullable: true })
  wd_rh_mean: number;

  @Column({ type: 'float', nullable: true })
  wd_rain: number;

  @Column({ type: 'float', nullable: true })
  wd_wind_mean: number;

  @Column({ type: 'float', nullable: true })
  wd_radiation: number;

  @Column({ type: 'float', nullable: true })
  wd_lux_mean: number;

  @Column({ type: 'float', nullable: true })
  wd_et0: number;

  @Column({ type: 'float', nullable: true })
  wd_gdd: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  wd_source: string;

  @Column({ type: 'int', nullable: true })
  wd_sample: number;

  @Column({ type: 'float', nullable: true })
  wd_complete: number;

  @Column({ type: 'datetime', nullable: true })
  wd_issued: Date;

  @Column({ type: 'datetime', nullable: true })
  wd_created: Date;

  @Column({ type: 'datetime', nullable: true })
  wd_update: Date;
}
