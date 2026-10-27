import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RefService } from './ref.service';
import { RefQueryDto } from './dto/ref-query.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('ref')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ref')
export class RefController {
  constructor(private readonly refService: RefService) {}

  @Get(':resource')
  @ApiOperation({
    summary:
      'Master data (baca): plant-types, phases, varieties, variety-phases, phase-params, activity-types, materials, telemetry, units',
  })
  @ApiResponse({ status: 200, description: 'Daftar data referensi' })
  findAll(@Param('resource') resource: string, @Query() query: RefQueryDto) {
    return this.refService.findAll(resource, query);
  }

  @Get(':resource/:id')
  @ApiOperation({ summary: 'Satu data referensi' })
  @ApiResponse({ status: 404, description: 'Tidak ditemukan' })
  findOne(@Param('resource') resource: string, @Param('id') id: string) {
    return this.refService.findOne(resource, id);
  }

  // Writes: admin for everything; agronom only for commodity and threshold tables (checked per resource in the service).
  @Post(':resource')
  @UseGuards(RolesGuard)
  @Roles('admin', 'agronom')
  @ApiOperation({ summary: 'Tambah data referensi (id wajib, kecuali variety-phases dan phase-params)' })
  @ApiResponse({ status: 201, description: 'Data dibuat' })
  @ApiResponse({ status: 403, description: 'Role tidak boleh mengubah resource ini' })
  create(
    @CurrentUser() user: { user_id: string; user_role: string },
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.refService.create(user, resource, body);
  }

  @Patch(':resource/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'agronom')
  @ApiOperation({ summary: 'Ubah data referensi' })
  update(
    @CurrentUser() user: { user_id: string; user_role: string },
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.refService.update(user, resource, id, body);
  }

  @Delete(':resource/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'agronom')
  @ApiOperation({ summary: 'Hapus data referensi yang belum dipakai' })
  remove(
    @CurrentUser() user: { user_id: string; user_role: string },
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return this.refService.remove(user, resource, id);
  }
}
