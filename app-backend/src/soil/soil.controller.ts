import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';
import { SoilRead } from '../common/decorators/soil-read.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';
import { SoilService } from './soil.service';
import { CreateSoilProfileDto, UpdateSoilProfileDto } from './dto/soil-profile.dto';
import { SoilFilterDto } from './dto/soil-filter.dto';

@ApiTags('soil-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('soil-profiles')
export class SoilController {
  constructor(private readonly soilService: SoilService) {}

  @Post()
  @AdminWrite()
  @ApiOperation({ summary: 'Catat hasil uji tanah; status hara P dan K diturunkan otomatis' })
  @ApiResponse({ status: 201, description: 'Profil tanah dicatat' })
  create(
    @CurrentUser() user: { user_id: string },
    @TenantId() tenantId: string,
    @Body() dto: CreateSoilProfileDto,
  ) {
    return this.soilService.create(tenantId, user.user_id, dto);
  }

  @Get()
  @SoilRead()
  @ApiOperation({ summary: 'Daftar profil tanah (filter: clusterId, plantId); operator tidak boleh' })
  findAll(@TenantScope() scope: string | undefined, @Query() filters: SoilFilterDto) {
    return this.soilService.findAll(scope, filters);
  }

  @Get(':id')
  @SoilRead()
  @ApiOperation({ summary: 'Detail profil tanah' })
  findOne(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.soilService.findOne(id, scope);
  }

  @Patch(':id')
  @AdminWrite()
  @ApiOperation({ summary: 'Koreksi profil tanah' })
  update(@TenantScope() scope: string | undefined, @Param('id') id: string, @Body() dto: UpdateSoilProfileDto) {
    return this.soilService.update(id, scope, dto);
  }

  @Delete(':id')
  @AdminWrite()
  @ApiOperation({ summary: 'Hapus profil tanah' })
  remove(@TenantScope() scope: string | undefined, @Param('id') id: string) {
    return this.soilService.remove(id, scope);
  }
}
