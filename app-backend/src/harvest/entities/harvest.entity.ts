import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tm_plant_harvest')
export class Harvest {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  hv_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tenant_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  site_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cluster_id: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  plant_id: string;

  /** Kegiatan terkait (mis. ubinan) */
  @Column({ type: 'varchar', length: 64, nullable: true })
  pact_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_id: string;

  @Column({ type: 'date', nullable: true })
  hv_date: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  hv_season: string;

  @Column({ type: 'int', nullable: true })
  hv_rotation: number;

  /** Luas dipanen (ha) */
  @Column({ type: 'double', nullable: true })
  hv_area: number;

  /** Berat GKP (kg) */
  @Column({ type: 'double', nullable: true })
  hv_weight: number;

  /** Kadar air GKP (%) */
  @Column({ type: 'float', nullable: true })
  hv_moisture: number;

  /** Berat setara GKG pada kadar air 14% (kg) */
  @Column({ type: 'double', nullable: true })
  hv_weight_dry: number;

  /** Produktivitas GKG (t/ha) */
  @Column({ type: 'float', nullable: true })
  hv_yield: number;

  @Column({ type: 'float', nullable: true })
  hv_loss_pct: number;

  /** Harga (Rp/kg) */
  @Column({ type: 'double', nullable: true })
  hv_price: number;

  /** WEB | FIELDKIT | API | IMPORT */
  @Column({ type: 'varchar', length: 16, nullable: true })
  hv_source: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  hv_desc: string;

  @Column({ type: 'int', nullable: true })
  hv_sts: number;

  @Column({ type: 'datetime', nullable: true })
  hv_created: Date;

  @Column({ type: 'datetime', nullable: true })
  hv_update: Date;
}
