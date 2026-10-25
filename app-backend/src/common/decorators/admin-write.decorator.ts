import { applyDecorators, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/**
 * Marks a handler as a tenant-admin (or global admin) write. Must be applied on
 * each @Post/@Patch/@Delete handler: a class-level JwtAuthGuard does not imply it,
 * so a handler without this decorator is open to every authenticated user.
 */
export const AdminWrite = () => applyDecorators(UseGuards(RolesGuard), Roles('admin', 'tenant_admin'));
