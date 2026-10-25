import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('tm_refresh_token')
export class RefreshToken {
  // JWT "jti" claim
  @PrimaryColumn({ type: 'varchar', length: 36 })
  rt_id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  user_id: string;

  // sha256(hex) of the refresh JWT; the raw token is never stored
  @Column({ type: 'char', length: 64 })
  token_hash: string;

  @Column({ type: 'datetime' })
  expires_at: Date;

  @Column({ type: 'datetime', nullable: true })
  revoked_at: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
