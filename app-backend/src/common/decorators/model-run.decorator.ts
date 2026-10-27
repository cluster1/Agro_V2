import { applyDecorators, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Running the model: admin, tenant admin and agronom (BRD menu matrix: Simulasi & Skenario). */
export const ModelRun = () => applyDecorators(UseGuards(RolesGuard), Roles('admin', 'tenant_admin', 'agronom'));
