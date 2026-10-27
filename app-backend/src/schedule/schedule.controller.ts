import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ScheduleWrite } from '../common/decorators/schedule-write.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleFilterDto } from './dto/schedule-filter.dto';

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @ScheduleWrite()
  @ApiOperation({ summary: 'Buat jadwal kegiatan manual untuk tanaman aktif' })
  @ApiResponse({ status: 201, description: 'Jadwal dibuat' })
  create(
    @CurrentUser() user: { user_id: string },
    @TenantId() tenantId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.scheduleService.create(tenantId, user.user_id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar jadwal (filter: plantId, clusterId, status, from, to); status terlambat dihitung otomatis' })
  findAll(@TenantScope() scope: string | undefined, @Query() filters: ScheduleFilterDto) {
    return this.scheduleService.findAll(scope, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail jadwal' })
  findOne(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.scheduleService.findOne(id, scope);
  }

  @Patch(':id')
  @ScheduleWrite()
  @ApiOperation({ summary: 'Ubah jadwal, atau batalkan dengan sched_sts = 3' })
  update(@TenantScope() scope: string | undefined, @Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.scheduleService.update(id, scope, dto);
  }

  @Delete(':id')
  @ScheduleWrite()
  @ApiOperation({ summary: 'Hapus jadwal (tidak bisa bila sudah selesai)' })
  remove(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.scheduleService.remove(id, scope);
  }
}
