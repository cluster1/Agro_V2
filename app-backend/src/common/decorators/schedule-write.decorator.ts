import { applyDecorators, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Jadwal is the one cultivation write agronom may do (BRD menu matrix: agronom "Penuh", operator "Lihat"). */
export const ScheduleWrite = () => applyDecorators(UseGuards(RolesGuard), Roles('admin', 'tenant_admin', 'agronom'));
