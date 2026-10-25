import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AlertService } from './alert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AlertFilterDto } from './dto/alert-filter.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  @ApiOperation({ summary: 'Get all alerts in tenant with filters' })
  @ApiResponse({ status: 200, description: 'List of alerts with detailed information' })
  findAll(
    @Param('tenantId') tenantId: string,
    @Query() filters: AlertFilterDto,
  ) {
    return this.alertService.findAll(tenantId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert by ID' })
  @ApiResponse({ status: 200, description: 'Alert details' })
  findOne(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.alertService.findOne(id, tenantId);
  }
}
