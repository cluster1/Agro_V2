import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AlertService } from './alert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AlertFilterDto } from './dto/alert-filter.dto';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateAlertDto } from './dto/update-alert.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  @ApiOperation({ summary: 'Get all alerts in tenant with filters' })
  @ApiResponse({ status: 200, description: 'List of alerts with detailed information' })
  findAll(
    @TenantId() tenantId: string,
    @Query() filters: AlertFilterDto,
  ) {
    return this.alertService.findAll(tenantId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert by ID' })
  @ApiResponse({ status: 200, description: 'Alert details' })
  findOne(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.alertService.findOne(id, scope);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'tenant_admin', 'operator')
  @ApiOperation({ summary: 'Tandai alert dilihat (1) atau selesai (2), dengan catatan' })
  @ApiResponse({ status: 200, description: 'Alert diperbarui' })
  @ApiResponse({ status: 400, description: 'Transisi status tidak valid' })
  acknowledge(
    @CurrentUser() user: { user_id: string },
    @TenantScope() scope: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alertService.acknowledge(id, scope, user.user_id, dto);
  }
}
