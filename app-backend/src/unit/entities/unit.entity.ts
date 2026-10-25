import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tr_unit')
export class Unit {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  unit_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  unit_name: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  unit_symbol: string;
}
