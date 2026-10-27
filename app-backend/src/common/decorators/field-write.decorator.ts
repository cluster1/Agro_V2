import { applyDecorators, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Field data entry (kegiatan, foto): operators input alongside tenant admins (BRD menu matrix). */
export const FieldWrite = () => applyDecorators(UseGuards(RolesGuard), Roles('admin', 'tenant_admin', 'operator'));
