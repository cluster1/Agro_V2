import { applyDecorators, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Observation verification: agronom verifies; admins hold full access (BRD menu matrix). */
export const VerifyWrite = () => applyDecorators(UseGuards(RolesGuard), Roles('admin', 'tenant_admin', 'agronom'));
