import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RefService } from './ref.service';
import { RefQueryDto } from './dto/ref-query.dto';

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
}
