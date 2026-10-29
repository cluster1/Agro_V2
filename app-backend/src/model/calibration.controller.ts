import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CalibrationAccess } from '../common/decorators/calibration.decorator';
import { ModelRun } from '../common/decorators/model-run.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { CalibrationService } from './calibration.service';
import { AccuracyService } from './accuracy.service';
import { AccuracyQueryDto, ApplyCalibrationDto } from './dto/calibration.dto';

@ApiTags('calibration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class CalibrationController {
  constructor(
    private readonly calibration: CalibrationService,
    private readonly accuracy: AccuracyService,
  ) {}

  @Get('calibration/varieties/:id')
  @CalibrationAccess()
  @ApiOperation({ summary: 'Estimasi vs fase teramati per varietas, dengan usulan kalibrasi (min. 3 petak)' })
  report(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.calibration.report(id, scope);
  }

  @Post('calibration/varieties/:id/apply')
  @CalibrationAccess()
  @ApiOperation({ summary: 'Terapkan usulan ke fase varietas dan tetapkan vp_source = KALIBRASI' })
  apply(
    @CurrentUser() user: { user_id: string; user_role: string },
    @TenantScope() scope: string | undefined,
    @Param('id') id: string,
    @Body() dto: ApplyCalibrationDto,
  ) {
    return this.calibration.apply(user, id, scope, dto.phase_ids);
  }

  @Get('reports/accuracy')
  @ModelRun()
  @ApiOperation({ summary: 'Laporan akurasi model: selisih fase (hari) dan hasil (%) per petak; format=xlsx untuk unduhan' })
  async accuracyReport(@TenantScope() scope: string | undefined, @Query() q: AccuracyQueryDto, @Res() res: Response) {
    const data = await this.accuracy.report(scope, { varId: q.varId, season: q.season });
    if (q.format === 'xlsx') {
      const buffer = await this.accuracy.toXlsx(data.rows, data.summary);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="akurasi-model.xlsx"');
      return res.send(buffer);
    }
    return res.json(data);
  }
}
