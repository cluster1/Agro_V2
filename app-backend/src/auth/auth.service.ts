import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { BCRYPT_COST, isGlobalAdmin } from '../common/constants/roles';
import { durationToMs } from './refresh-cookie';
import { RefreshRaceException } from './refresh-race.exception';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// A refresh token consumed less than this long ago is treated as a benign race, not theft.
const REUSE_GRACE_MS = 10_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash?: string;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private isAccountActive(user: User): boolean {
    if (user.user_sts && user.user_sts !== 'active') return false;
    // Global admins are not bound to a tenant's status; everyone else needs an active tenant
    // (a missing tenant row fails closed).
    if (!isGlobalAdmin(user) && Number(user.tenant?.tenant_sts) !== 1) return false;
    return true;
  }

  private buildPayload(user: User) {
    return {
      email: user.user_email,
      sub: user.user_id,
      tenant_id: user.tenant_id,
      user_role: user.user_role,
      user_level: user.user_level,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { user_email: email },
      relations: ['tenant'],
    });

    if (!user) {
      // Spend the same time as a real check so response time does not reveal which emails exist.
      this.dummyHash ??= await bcrypt.hash('timing-equalizer', BCRYPT_COST);
      await bcrypt.compare(password, this.dummyHash);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.user_pass);
    if (!isPasswordValid || !this.isAccountActive(user)) {
      return null;
    }

    const { user_pass, ...result } = user;
    return result;
  }

  /** Signs a refresh JWT with a unique jti and records its hash so it can be rotated/revoked. */
  private async issueRefreshToken(user: User): Promise<string> {
    const jti = randomUUID();
    // Parse the lifetime once so JWT exp, DB expires_at and cookie maxAge always agree.
    const ttlMs = durationToMs(this.configService.get<string>('JWT_REFRESH_EXPIRATION'));
    const token = this.jwtService.sign(this.buildPayload(user), {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: Math.floor(ttlMs / 1000),
      jwtid: jti,
    });

    await this.refreshTokenRepository.insert({
      rt_id: jti,
      user_id: user.user_id,
      token_hash: sha256(token),
      expires_at: new Date(Date.now() + ttlMs),
      revoked_at: null,
    });

    return token;
  }

  async login(user: any) {
    // Opportunistic cleanup of expired rows keeps the table small.
    await this.refreshTokenRepository.delete({ expires_at: LessThan(new Date()) });

    const accessToken = this.jwtService.sign(this.buildPayload(user));
    const refreshToken = await this.issueRefreshToken(user);

    return {
      accessToken,
      refreshToken, // controller moves this into an httpOnly cookie; never sent in the body
      user: {
        user_id: user.user_id,
        user_name: user.user_name,
        user_email: user.user_email,
        user_role: user.user_role,
        user_level: user.user_level,
        tenant_id: user.tenant_id,
        tenant: user.tenant,
      },
    };
  }

  /**
   * Rotates the refresh token: the presented one is revoked and a new one issued.
   * Presenting an already-revoked token signals theft, so every session of that user is revoked.
   */
  async refreshToken(rawToken: string | undefined) {
    const invalid = () => new UnauthorizedException('Invalid refresh token');
    if (!rawToken) throw invalid();

    let payload: any;
    try {
      payload = this.jwtService.verify(rawToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
      });
    } catch {
      throw invalid();
    }

    const record = await this.refreshTokenRepository.findOne({ where: { rt_id: payload.jti } });
    if (!record || record.token_hash !== sha256(rawToken) || record.user_id !== payload.sub) {
      throw invalid();
    }

    if (record.revoked_at) {
      if (Date.now() - record.revoked_at.getTime() < REUSE_GRACE_MS) {
        // Two tabs or a retried request raced for the same token; refuse without treating it as theft.
        this.logger.warn(`Refresh token ${record.rt_id} re-presented inside the grace window`);
        throw new RefreshRaceException();
      }
      await this.revokeAllForUser(record.user_id);
      throw invalid();
    }
    if (record.expires_at.getTime() < Date.now()) {
      throw invalid();
    }

    const user = await this.userRepository.findOne({
      where: { user_id: payload.sub },
      relations: ['tenant'],
    });
    if (!user || !this.isAccountActive(user)) {
      await this.revokeAllForUser(payload.sub);
      throw invalid();
    }

    // Atomic claim: only one concurrent request may consume this token.
    const claim = await this.refreshTokenRepository.update(
      { rt_id: record.rt_id, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
    if (!claim.affected) throw new RefreshRaceException();

    return {
      accessToken: this.jwtService.sign(this.buildPayload(user)),
      refreshToken: await this.issueRefreshToken(user),
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const decoded: any = this.jwtService.decode(rawToken);
    if (!decoded?.jti) return;
    const record = await this.refreshTokenRepository.findOne({ where: { rt_id: decoded.jti } });
    // Only revoke if the presented token really matches, so forged cookies can't revoke others.
    if (record && record.token_hash === sha256(rawToken) && !record.revoked_at) {
      await this.refreshTokenRepository.update({ rt_id: record.rt_id }, { revoked_at: new Date() });
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.user_pass);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password lama tidak valid');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST);
    user.user_pass = hashedPassword;
    user.user_update = new Date();

    await this.userRepository.save(user);
    // Password change ends all sessions, including this browser's (it must log in again once the access token expires).
    await this.revokeAllForUser(userId);
  }
}
