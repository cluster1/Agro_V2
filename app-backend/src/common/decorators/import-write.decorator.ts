import { applyDecorators, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Data import: admin, tenant admin and agronom; operators have no access (BRD menu matrix). */
export const ImportWrite = () => applyDecorators(UseGuards(RolesGuard), Roles('admin', 'tenant_admin', 'agronom'));
