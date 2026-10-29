import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ModelRun } from '../common/decorators/model-run.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { daysBetween } from '../plant/plant-rules';
import { FarmDashboardService } from './farm-dashboard.service';
import { ProductionReportService } from './production-report.service';
import { CostReportService } from './cost-report.service';
import { CostQueryDto, DashboardQueryDto, ProductionQueryDto } from './dto/report-query.dto';
import { MAX_RANGE_DAYS, XLSX_MIME } from './report-utils';

@ApiTags('reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('reports')
export class ReportingController {
  constructor(
    private readonly dashboard: FarmDashboardService,
    private readonly production: ProductionReportService,
    private readonly costs: CostReportService,
  ) {}

  // every tenant role sees the dashboard, so no role restriction here (unlike the reports below)
  @Get('farm-dashboard')
  @ApiOperation({ summary: 'Kartu dashboard: luas, petak per fase dan kesehatan, panen terdekat, jadwal 7 hari, alert terbuka' })
  farmDashboard(@TenantScope() scope: string | undefined, @Query() q: DashboardQueryDto) {
    return this.dashboard.summary(scope, q.siteId);
  }

  @Get('production')
  @ModelRun()
  @ApiOperation({ summary: 'Laporan produksi per petak per musim; format=xlsx atau pdf untuk unduhan' })
  async productionReport(@TenantScope() scope: string | undefined, @Query() q: ProductionQueryDto, @Res() res: Response) {
    const filter = { siteId: q.siteId, season: q.season, varId: q.varId };
    const data = await this.production.report(scope, filter);
    if (q.format === 'xlsx') {
      res.setHeader('Content-Type', XLSX_MIME);
      res.setHeader('Content-Disposition', 'attachment; filename="produksi.xlsx"');
      return res.send(await this.production.toXlsx(data.rows, data.summary));
    }
    if (q.format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="produksi.pdf"');
      return res.send(await this.production.toPdf(data.rows, data.summary, filter));
    }
    return res.json(data);
  }

  @Get('costs')
  @ModelRun()
  @ApiOperation({ summary: 'Laporan kegiatan dan biaya, rencana vs realisasi; format=xlsx untuk unduhan' })
  async costReport(@TenantScope() scope: string | undefined, @Query() q: CostQueryDto, @Res() res: Response) {
    if (q.from && q.to) {
      const span = daysBetween(q.from, q.to);
      if (span < 0) throw new BadRequestException('from tidak boleh setelah to');
      if (span > MAX_RANGE_DAYS) throw new BadRequestException(`Rentang maksimal ${MAX_RANGE_DAYS} hari`);
    }
    const data = await this.costs.report(scope, { siteId: q.siteId, plantId: q.plantId, from: q.from, to: q.to });
    if (q.format === 'xlsx') {
      res.setHeader('Content-Type', XLSX_MIME);
      res.setHeader('Content-Disposition', 'attachment; filename="kegiatan-biaya.xlsx"');
      return res.send(await this.costs.toXlsx(data));
    }
    return res.json(data);
  }
}
