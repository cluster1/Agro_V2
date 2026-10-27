import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { PlantService } from './plant.service';
import { CreatePlantDto } from './dto/create-plant.dto';
import { UpdatePlantDto } from './dto/update-plant.dto';
import { ClosePlantDto } from './dto/close-plant.dto';
import { PlantFilterDto } from './dto/plant-filter.dto';

@ApiTags('plants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('plants')
export class PlantController {
  constructor(private readonly plantService: PlantService) {}

  @Post()
  @AdminWrite()
  @ApiOperation({ summary: 'Buat tanaman (petak per musim) beserta jadwal templat padi' })
  @ApiResponse({ status: 201, description: 'Tanaman dibuat; memuat warnings dan schedules_created' })
  @ApiResponse({ status: 409, description: 'Petak sudah punya tanaman aktif untuk musim itu' })
  create(
    @CurrentUser() user: { user_id: string },
    @TenantId() tenantId: string,
    @Body() dto: CreatePlantDto,
  ) {
    return this.plantService.create(tenantId, user.user_id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar tanaman di tenant (filter: clusterId, siteId, season, status)' })
  findAll(@TenantScope() scope: string | undefined, @Query() filters: PlantFilterDto) {
    return this.plantService.findAll(scope, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail tanaman' })
  findOne(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.plantService.findOne(id, scope);
  }

  @Patch(':id')
  @AdminWrite()
  @ApiOperation({ summary: 'Ubah data tanaman (bukan petak, varietas, musim, atau tanggal)' })
  update(@TenantScope() scope: string | undefined, @Param('id') id: string, @Body() dto: UpdatePlantDto) {
    return this.plantService.update(id, scope, dto);
  }

  @Post(':id/close')
  @AdminWrite()
  @ApiOperation({ summary: 'Tutup musim: isi tanggal panen, plant_sts=0, batalkan jadwal belum selesai' })
  close(@TenantScope() scope: string | undefined, @Param('id') id: string, @Body() dto: ClosePlantDto) {
    return this.plantService.close(id, scope, dto);
  }
}
