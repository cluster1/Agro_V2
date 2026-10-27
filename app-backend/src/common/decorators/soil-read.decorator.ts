import { applyDecorators, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Soil profiles are hidden from operators entirely (BRD menu matrix); agronom may view. */
export const SoilRead = () => applyDecorators(UseGuards(RolesGuard), Roles('admin', 'tenant_admin', 'agronom'));
