import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ModelRun } from '../common/decorators/model-run.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { ModelService } from './model.service';
import { SimulateDto } from './dto/simulate.dto';

@ApiTags('simulations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class ModelController {
  constructor(private readonly modelService: ModelService) {}

  @Post('plants/:id/simulate')
  @ModelRun()
  @ApiOperation({ summary: 'Jalankan simulasi AGRO-PADI (skenario BASE/KERING/BASAH/CUSTOM)' })
  @ApiResponse({ status: 201, description: 'Hasil run: fase, indeks pertumbuhan, defisit N/P/K, prediksi hasil' })
  simulate(
    @CurrentUser() user: { user_id: string },
    @TenantScope() scope: string | undefined,
    @Param('id') id: string,
    @Body() dto: SimulateDto,
  ) {
    return this.modelService.simulate(id, scope, user.user_id, dto.scenario ?? 'BASE');
  }

  @Get('plants/:id/simulations')
  @ApiOperation({ summary: 'Riwayat run simulasi tanaman (filter: scenario)' })
  history(@TenantScope() scope: string | undefined, @Param('id') id: string, @Query('scenario') scenario?: string) {
    return this.modelService.history(id, scope, scenario);
  }

  @Get('simulations/:id')
  @ApiOperation({ summary: 'Satu run simulasi beserta fasenya' })
  findOne(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.modelService.findOne(id, scope);
  }
}
