import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { FieldWrite } from '../common/decorators/field-write.decorator';
import { VerifyWrite } from '../common/decorators/verify-write.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { ObservationService } from './observation.service';
import { CreateObservationDto } from './dto/create-observation.dto';
import { UpdateObservationDto } from './dto/update-observation.dto';
import { ObservationFilterDto } from './dto/observation-filter.dto';
import { RejectObservationDto } from './dto/reject-observation.dto';

@ApiTags('observations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('observations')
export class ObservationController {
  constructor(private readonly observationService: ObservationService) {}

  @Post()
  @FieldWrite()
  @ApiOperation({ summary: 'Catat observasi padi (draf atau tersimpan)' })
  @ApiResponse({ status: 201, description: 'Observasi dicatat' })
  create(
    @CurrentUser() user: { user_id: string },
    @TenantId() tenantId: string,
    @Body() dto: CreateObservationDto,
  ) {
    return this.observationService.create(tenantId, user.user_id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar observasi; antrean verifikasi = status 1' })
  findAll(@TenantScope() scope: string | undefined, @Query() filters: ObservationFilterDto) {
    return this.observationService.findAll(scope, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail observasi' })
  findOne(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.observationService.findOne(id, scope);
  }

  @Patch(':id')
  @FieldWrite()
  @ApiOperation({ summary: 'Ubah observasi (draf, tersimpan, atau ditolak)' })
  update(@TenantScope() scope: string | undefined, @Param('id') id: string, @Body() dto: UpdateObservationDto) {
    return this.observationService.update(id, scope, dto);
  }

  @Post(':id/verify')
  @VerifyWrite()
  @ApiOperation({ summary: 'Verifikasi observasi tersimpan' })
  verify(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.observationService.verify(id, scope);
  }

  @Post(':id/reject')
  @VerifyWrite()
  @ApiOperation({ summary: 'Tolak observasi tersimpan dengan alasan' })
  reject(@TenantScope() scope: string | undefined, @Param('id') id: string, @Body() dto: RejectObservationDto) {
    return this.observationService.reject(id, scope, dto.reason);
  }

  @Delete(':id')
  @FieldWrite()
  @ApiOperation({ summary: 'Hapus observasi (bukan yang terverifikasi)' })
  remove(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.observationService.remove(id, scope);
  }
}
