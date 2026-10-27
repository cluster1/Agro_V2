import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { parseBoundedInt } from '../common/utils/parse-bounded-int';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('monitoring/devices')
  @ApiOperation({ summary: 'Get all devices with sensors and latest readings' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'clusterId', required: false })
  @ApiResponse({ status: 200, description: 'List of devices with sensor data' })
  async getDevicesWithSensors(
    @TenantId() tenantId: string,
    @Query('siteId') siteId?: string,
    @Query('clusterId') clusterId?: string,
  ) {
    return this.monitoringService.getDevicesWithSensors(tenantId, siteId, clusterId);
  }

  @Get('monitoring/devices/:devId/history')
  @ApiOperation({ summary: 'Get device sensor history for last N hours' })
  @ApiQuery({ name: 'hours', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Device sensor history data' })
  async getDeviceHistory(
    @TenantScope() scope: string | undefined,
    @Param('devId') devId: string,
    @Query('hours') hours?: number,
  ) {
    return this.monitoringService.getDeviceHistory(devId, parseBoundedInt('hours', hours, 24, 1, 720), scope);
  }

  @Get('monitoring/sensors/:sensId/parameters/:dsId/history')
  @ApiOperation({ summary: 'Get specific parameter history' })
  @ApiQuery({ name: 'devId', required: true })
  @ApiQuery({ name: 'hours', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Parameter history data' })
  async getSensorHistory(
    @TenantScope() scope: string | undefined,
    @Param('sensId') sensId: string,
    @Param('dsId') dsId: string,
    @Query('devId') devId: string,
    @Query('hours') hours?: number,
  ) {
    return this.monitoringService.getSensorHistory(devId, sensId, dsId, parseBoundedInt('hours', hours, 24, 1, 720), scope);
  }

  @Get('monitoring/last-readings')
  @ApiOperation({ summary: 'Get last N sensor readings for a tenant' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Last sensor readings' })
  async getLastReadings(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    return this.monitoringService.getLastReadings(tenantId, parseBoundedInt('limit', limit, 10, 1, 500));
  }

  @Get('monitoring/alerts')
  @ApiOperation({ summary: 'Get alerts for a tenant in last N hours' })
  @ApiQuery({ name: 'hours', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Alert data' })
  async getAlerts(
    @TenantId() tenantId: string,
    @Query('hours') hours?: number,
  ) {
    return this.monitoringService.getAlerts(tenantId, parseBoundedInt('hours', hours, 24, 1, 720));
  }

  @Get('monitoring/sensor-summary')
  @ApiOperation({ summary: 'Get sensor parameter summary' })
  @ApiResponse({ status: 200, description: 'Sensor parameter summary' })
  async getSensorSummary(
    @TenantId() tenantId: string,
  ) {
    return this.monitoringService.getSensorSummary(tenantId);
  }
}
