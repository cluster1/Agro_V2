import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tr_material')
export class Material {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  mat_id: string;

  @Column({ type: 'varchar', length: 64 })
  mat_name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  mat_category: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  mat_brand: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mat_active: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  mat_conc: string;

  /** Kandungan hara (%) */
  @Column({ type: 'float', nullable: true })
  mat_n: number;

  @Column({ type: 'float', nullable: true })
  mat_p2o5: number;

  @Column({ type: 'float', nullable: true })
  mat_k2o: number;

  @Column({ type: 'float', nullable: true })
  mat_mgo: number;

  @Column({ type: 'float', nullable: true })
  mat_cao: number;

  @Column({ type: 'float', nullable: true })
  mat_s: number;

  @Column({ type: 'float', nullable: true })
  mat_b: number;

  @Column({ type: 'float', nullable: true })
  mat_c_org: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mat_desc: string;

  @Column({ type: 'int', nullable: true })
  mat_sts: number;

  @Column({ type: 'datetime', nullable: true })
  mat_update: Date;
}
