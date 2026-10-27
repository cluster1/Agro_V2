import { applyDecorators, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Calibration is for admin and agronom only (BRD menu matrix: tenant admin "-", operator "-"). */
export const CalibrationAccess = () => applyDecorators(UseGuards(RolesGuard), Roles('admin', 'agronom'));
