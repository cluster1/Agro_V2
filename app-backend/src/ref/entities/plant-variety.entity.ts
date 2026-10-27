import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tr_plant_variety')
export class PlantVariety {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  var_id: string;

  @Column({ type: 'varchar', length: 32 })
  ptype_id: string;

  @Column({ type: 'varchar', length: 64 })
  var_name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  var_code: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  var_origin: string;

  @Column({ type: 'int', nullable: true })
  var_release_year: number;

  /** Umur panen (HSS) */
  @Column({ type: 'int', nullable: true })
  var_maturity: number;

  /** Umur bibit (hari) */
  @Column({ type: 'int', nullable: true })
  var_nursery_age: number;

  @Column({ type: 'float', nullable: true })
  var_tbase: number;

  @Column({ type: 'float', nullable: true })
  var_topt: number;

  @Column({ type: 'float', nullable: true })
  var_tmax: number;

  @Column({ type: 'float', nullable: true })
  var_height: number;

  @Column({ type: 'float', nullable: true })
  var_tiller: number;

  @Column({ type: 'float', nullable: true })
  var_grain_weight: number;

  @Column({ type: 'float', nullable: true })
  var_yield_potential: number;

  @Column({ type: 'float', nullable: true })
  var_yield_avg: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  var_resistance: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  var_desc: string;

  @Column({ type: 'int', nullable: true })
  var_sts: number;

  @Column({ type: 'datetime', nullable: true })
  var_update: Date;
}
