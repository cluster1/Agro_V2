import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { FieldWrite } from '../common/decorators/field-write.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { ActivityService } from './activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityFilterDto } from './dto/activity-filter.dto';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('activities')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  @FieldWrite()
  @ApiOperation({ summary: 'Catat realisasi kegiatan; menutup jadwal bila sched_id diisi' })
  @ApiResponse({ status: 201, description: 'Kegiatan dicatat; memuat nutrient_input untuk pemupukan' })
  create(
    @CurrentUser() user: { user_id: string },
    @TenantId() tenantId: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activityService.create(tenantId, user.user_id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar kegiatan (filter: plantId, clusterId, actypeId, from, to)' })
  findAll(@TenantScope() scope: string | undefined, @Query() filters: ActivityFilterDto) {
    return this.activityService.findAll(scope, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail kegiatan' })
  findOne(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.activityService.findOne(id, scope);
  }

  @Patch(':id')
  @FieldWrite()
  @ApiOperation({ summary: 'Ubah kegiatan (bukan tanaman, jenis, atau jadwal)' })
  update(@TenantScope() scope: string | undefined, @Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activityService.update(id, scope, dto);
  }

  @Delete(':id')
  @FieldWrite()
  @ApiOperation({ summary: 'Hapus kegiatan; jadwal terkait dibuka kembali' })
  remove(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.activityService.remove(id, scope);
  }
}
