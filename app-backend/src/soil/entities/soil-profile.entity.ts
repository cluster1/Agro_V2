import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tm_soil_profile')
export class SoilProfile {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  soil_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  plant_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  soil_sample_code: string;

  @Column({ type: 'date', nullable: true })
  soil_sample_date: string;

  @Column({ type: 'int', nullable: true })
  soil_depth_top: number;

  @Column({ type: 'int', nullable: true })
  soil_depth_bottom: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  soil_lab: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  soil_type: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  soil_texture: string;

  @Column({ type: 'float', nullable: true })
  soil_sand: number;

  @Column({ type: 'float', nullable: true })
  soil_silt: number;

  @Column({ type: 'float', nullable: true })
  soil_clay: number;

  @Column({ type: 'float', nullable: true })
  soil_ph_h2o: number;

  @Column({ type: 'float', nullable: true })
  soil_ph_kcl: number;

  @Column({ type: 'float', nullable: true })
  soil_c_org: number;

  @Column({ type: 'float', nullable: true })
  soil_n_total: number;

  @Column({ type: 'float', nullable: true })
  soil_p_avail: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  soil_p_method: string;

  @Column({ type: 'float', nullable: true })
  soil_k_exch: number;

  @Column({ type: 'float', nullable: true })
  soil_ca_exch: number;

  @Column({ type: 'float', nullable: true })
  soil_mg_exch: number;

  @Column({ type: 'float', nullable: true })
  soil_cec: number;

  @Column({ type: 'float', nullable: true })
  soil_base_sat: number;

  @Column({ type: 'float', nullable: true })
  soil_ec: number;

  @Column({ type: 'float', nullable: true })
  soil_bulk_density: number;

  @Column({ type: 'float', nullable: true })
  soil_fc: number;

  @Column({ type: 'float', nullable: true })
  soil_wp: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  soil_drainage: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  soil_land_class: string;

  @Column({ type: 'double', nullable: true })
  soil_lon: number;

  @Column({ type: 'double', nullable: true })
  soil_lat: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  soil_doc: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  soil_desc: string;

  @Column({ type: 'int', nullable: true })
  soil_sts: number;

  @Column({ type: 'datetime', nullable: true })
  soil_created: Date;

  @Column({ type: 'datetime', nullable: true })
  soil_update: Date;
}
