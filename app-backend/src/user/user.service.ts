import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import {
  BCRYPT_COST,
  GLOBAL_ADMIN_LEVEL,
  GLOBAL_ADMIN_ROLE,
  TENANT_ADMIN_FORBIDDEN_ROLES,
  isGlobalAdmin,
} from '../common/constants/roles';

export interface Caller {
  user_id: string;
  tenant_id: string;
  user_role: string;
  user_level: number;
}

// Columns safe to return to clients (never the password hash).
const PUBLIC_USER_FIELDS: (keyof User)[] = [
  'user_id',
  'tenant_id',
  'user_name',
  'user_email',
  'user_phone',
  'user_role',
  'user_level',
  'user_sts',
  'user_created',
  'user_update',
];

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  // Non-global callers may not mint or modify global-admin privileges.
  private assertCanAssignPrivileges(
    caller: Caller,
    dto: { user_role?: string; user_level?: number },
    currentRole?: string,
  ): void {
    if (isGlobalAdmin(caller)) return;
    if (dto.user_level === GLOBAL_ADMIN_LEVEL || dto.user_role === GLOBAL_ADMIN_ROLE) {
      throw new ForbiddenException('Cannot assign global admin privileges');
    }
    // tenant_admin may only create/assign operators; re-sending an unchanged role is not an assignment.
    if (
      dto.user_role !== undefined &&
      dto.user_role !== currentRole &&
      TENANT_ADMIN_FORBIDDEN_ROLES.includes(dto.user_role)
    ) {
      throw new ForbiddenException(`Cannot assign role '${dto.user_role}'`);
    }
  }

  // Role "admin" and level 0 only make sense together (see isGlobalAdmin); refuse half-admins.
  private assertConsistentPrivileges(role?: string, level?: number): void {
    const adminRole = role === GLOBAL_ADMIN_ROLE;
    const adminLevel = level === GLOBAL_ADMIN_LEVEL;
    // An omitted level is fine for non-admin roles (DB default applies).
    if (adminRole !== adminLevel) {
      throw new BadRequestException(
        `user_role '${GLOBAL_ADMIN_ROLE}' and user_level ${GLOBAL_ADMIN_LEVEL} must be set together`,
      );
    }
  }

  private async revokeSessions(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
  }

  async create(caller: Caller, tenantId: string, createUserDto: CreateUserDto): Promise<User> {
    this.assertCanAssignPrivileges(caller, createUserDto);
    this.assertConsistentPrivileges(createUserDto.user_role, createUserDto.user_level);

    const existingUser = await this.userRepository.findOne({
      where: { user_email: createUserDto.user_email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.user_pass, BCRYPT_COST);

    const user = this.userRepository.create({
      user_id: uuidv4(),
      tenant_id: tenantId,
      ...createUserDto,
      user_pass: hashedPassword,
      user_created: new Date(),
      user_update: new Date(),
    });

    const savedUser = await this.userRepository.save(user);

    const { user_pass, ...result } = savedUser;
    return result as User;
  }

  async findAll(tenantId: string): Promise<User[]> {
    return await this.userRepository.find({
      where: { tenant_id: tenantId },
      relations: ['tenant'],
      select: PUBLIC_USER_FIELDS,
    });
  }

  async findAllGlobal(): Promise<User[]> {
    return await this.userRepository.find({
      relations: ['tenant'],
      select: PUBLIC_USER_FIELDS,
      order: { user_created: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { user_id: id, tenant_id: tenantId },
      relations: ['tenant'],
      select: PUBLIC_USER_FIELDS,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { user_id: id },
      relations: ['tenant'],
      select: PUBLIC_USER_FIELDS,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(caller: Caller, tenantId: string, id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Global admin may update by ID across tenants; everyone else is tenant-scoped.
    const user = isGlobalAdmin(caller)
      ? await this.findById(id)
      : await this.findOne(tenantId, id);

    if (!isGlobalAdmin(caller)) {
      this.assertCanAssignPrivileges(caller, updateUserDto, user.user_role);
      if (isGlobalAdmin(user)) {
        throw new ForbiddenException('Cannot modify a global admin');
      }
    }

    const touchesPrivileges = updateUserDto.user_role !== undefined || updateUserDto.user_level !== undefined;
    if (touchesPrivileges) {
      this.assertConsistentPrivileges(
        updateUserDto.user_role ?? user.user_role,
        updateUserDto.user_level ?? user.user_level,
      );
    }
    if (
      caller.user_id === id &&
      ((updateUserDto.user_role !== undefined && updateUserDto.user_role !== user.user_role) ||
        (updateUserDto.user_level !== undefined && updateUserDto.user_level !== user.user_level))
    ) {
      throw new ForbiddenException('Cannot change your own role or level');
    }

    // An empty/absent password means "leave unchanged".
    const passwordReset = !!updateUserDto.user_pass;
    if (passwordReset) {
      updateUserDto.user_pass = await bcrypt.hash(updateUserDto.user_pass, BCRYPT_COST);
    } else {
      delete updateUserDto.user_pass;
    }

    const deactivated = updateUserDto.user_sts !== undefined && updateUserDto.user_sts !== 'active';

    Object.assign(user, updateUserDto);
    user.user_update = new Date();

    const savedUser = await this.userRepository.save(user);

    // A reset password or a deactivated account must not keep working through existing sessions.
    if (passwordReset || deactivated) {
      await this.revokeSessions(id);
    }

    const { user_pass, ...result } = savedUser;
    return result as User;
  }

  async remove(caller: Caller, tenantId: string, id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: isGlobalAdmin(caller)
        ? { user_id: id }
        : { user_id: id, tenant_id: tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!isGlobalAdmin(caller) && isGlobalAdmin(user)) {
      throw new ForbiddenException('Cannot delete a global admin');
    }
    if (caller.user_id === id) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    await this.userRepository.remove(user);
    await this.revokeSessions(id);
  }
}
