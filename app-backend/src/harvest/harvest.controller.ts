import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { FieldWrite } from '../common/decorators/field-write.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { HarvestService } from './harvest.service';
import { CreateHarvestDto } from './dto/create-harvest.dto';
import { UpdateHarvestDto } from './dto/update-harvest.dto';
import { HarvestFilterDto } from './dto/harvest-filter.dto';

@ApiTags('harvests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('harvests')
export class HarvestController {
  constructor(private readonly harvestService: HarvestService) {}

  @Post()
  @FieldWrite()
  @ApiOperation({ summary: 'Catat panen; GKG (kadar air 14%) dan t/ha dihitung otomatis' })
  @ApiResponse({ status: 201, description: 'Panen dicatat' })
  create(
    @CurrentUser() user: { user_id: string },
    @TenantId() tenantId: string,
    @Body() dto: CreateHarvestDto,
  ) {
    return this.harvestService.create(tenantId, user.user_id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar panen (filter: plantId, clusterId, season, from, to)' })
  findAll(@TenantScope() scope: string | undefined, @Query() filters: HarvestFilterDto) {
    return this.harvestService.findAll(scope, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail panen' })
  findOne(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.harvestService.findOne(id, scope);
  }

  @Patch(':id')
  @FieldWrite()
  @ApiOperation({ summary: 'Koreksi panen; GKG dan t/ha dihitung ulang' })
  update(@TenantScope() scope: string | undefined, @Param('id') id: string, @Body() dto: UpdateHarvestDto) {
    return this.harvestService.update(id, scope, dto);
  }

  @Delete(':id')
  @FieldWrite()
  @ApiOperation({ summary: 'Hapus panen' })
  remove(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.harvestService.remove(id, scope);
  }
}
