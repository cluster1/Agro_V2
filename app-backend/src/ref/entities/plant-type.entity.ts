import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tr_plant_type')
export class PlantType {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  ptype_id: string;

  @Column({ type: 'varchar', length: 64 })
  ptype_name: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ptype_latin: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ptype_category: string;

  @Column({ type: 'int', nullable: true })
  ptype_lifespan: number;

  @Column({ type: 'varchar', length: 8, nullable: true, default: 'MONTH' })
  ptype_age_unit: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ptype_spacing: string;

  @Column({ type: 'int', nullable: true })
  ptype_density: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ptype_icon: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ptype_desc: string;

  @Column({ type: 'int', nullable: true })
  ptype_sts: number;

  @Column({ type: 'datetime', nullable: true })
  ptype_update: Date;
}
