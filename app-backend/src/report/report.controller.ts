import { Controller, Get, Param, UseGuards, Query, Res, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Response } from 'express';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

function parseDate(name: string, value: string): number {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new BadRequestException(`${name} must be a valid date (YYYY-MM-DD)`);
  }
  const t = Date.parse(`${value}T00:00:00Z`);
  if (isNaN(t) || new Date(t).toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${name} must be a valid date (YYYY-MM-DD)`);
  }
  return t;
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('global/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get global dashboard summary (all tenants) - Global Admin only' })
  @ApiResponse({ status: 200, description: 'Global dashboard summary with all tenants data' })
  getGlobalDashboard() {
    return this.reportService.getGlobalDashboard();
  }

  @Get('tenants/:tenantId/dashboard')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get dashboard summary for specific tenant' })
  @ApiResponse({ status: 200, description: 'Dashboard summary data' })
  getDashboardSummary(@Param('tenantId') tenantId: string) {
    return this.reportService.getDashboardSummary(tenantId);
  }

  @Get('cluster/:clusterId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get cluster report' })
  @ApiResponse({ status: 200, description: 'Cluster report data' })
  getClusterReport(
    @TenantScope() scope: string | undefined,
    @Param('clusterId') clusterId: string,
  ) {
    return this.reportService.getClusterReport(clusterId, scope);
  }

  @Get('tenants/:tenantId/latest-readings')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get latest 10 sensor readings for tenant' })
  @ApiResponse({ status: 200, description: 'Latest sensor readings' })
  getLatestReadings(@Param('tenantId') tenantId: string) {
    return this.reportService.getLatestReadings(tenantId);
  }

  @Get('tenants/:tenantId/timeline')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get combined timeline with readings and alerts' })
  @ApiResponse({ status: 200, description: 'Combined timeline data' })
  getCombinedTimeline(@Param('tenantId') tenantId: string) {
    return this.reportService.getCombinedTimeline(tenantId);
  }

  @Get('tenants/:tenantId/sites-map')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get sites with coordinates for map display' })
  @ApiResponse({ status: 200, description: 'Sites with location data' })
  getSitesForMap(@Param('tenantId') tenantId: string) {
    return this.reportService.getSitesForMap(tenantId);
  }

  @Get('tenants/:tenantId/map-data')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Get sites, devices, and sensors with coordinates and connections for enhanced map' })
  @ApiResponse({ status: 200, description: 'Complete map data with sites, devices, sensors, and their relationships' })
  getSitesWithDevicesAndSensors(@Param('tenantId') tenantId: string) {
    return this.reportService.getSitesWithDevicesAndSensors(tenantId);
  }

  @Get('tenants/:tenantId/sensor-readings/excel')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Download sensor readings report in Excel format' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async downloadSensorReadingsExcel(
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const start = parseDate('startDate', startDate);
    const end = parseDate('endDate', endDate);
    if (end < start) {
      throw new BadRequestException('endDate must not be before startDate');
    }
    if ((end - start) / 86400000 > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Date range must not exceed ${MAX_RANGE_DAYS} days`);
    }

    const buffer = await this.reportService.generateSensorReadingsExcel(
      tenantId,
      startDate,
      endDate,
    );

    const filename = `sensor-readings-${startDate}-to-${endDate}.xlsx`;
    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
