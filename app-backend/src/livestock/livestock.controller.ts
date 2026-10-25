import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { LivestockService } from './livestock.service';
import { CreateLivestockDto } from './dto/create-livestock.dto';
import { UpdateLivestockDto } from './dto/update-livestock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';

@ApiTags('livestock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/livestock')
export class LivestockController {
  constructor(private readonly livestockService: LivestockService) {}

  @Post()
  @AdminWrite()
  @ApiOperation({ summary: 'Create new livestock entry' })
  @ApiResponse({ status: 201, description: 'Livestock created successfully' })
  create(
    @Param('tenantId') tenantId: string,
    @Body() createLivestockDto: CreateLivestockDto,
  ) {
    return this.livestockService.create(tenantId, createLivestockDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all livestock in tenant' })
  @ApiResponse({ status: 200, description: 'List of livestock' })
  findAll(
    @Param('tenantId') tenantId: string,
    @Query('clusterId') clusterId?: string,
  ) {
    return this.livestockService.findAll(tenantId, clusterId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get livestock by ID' })
  @ApiResponse({ status: 200, description: 'Livestock details' })
  findOne(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.livestockService.findOne(id, tenantId);
  }

  @Patch(':id')
  @AdminWrite()
  @ApiOperation({ summary: 'Update livestock' })
  @ApiResponse({ status: 200, description: 'Livestock updated successfully' })
  update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() updateLivestockDto: UpdateLivestockDto,
  ) {
    return this.livestockService.update(id, updateLivestockDto, tenantId);
  }

  @Delete(':id')
  @AdminWrite()
  @ApiOperation({ summary: 'Delete livestock' })
  @ApiResponse({ status: 200, description: 'Livestock deleted successfully' })
  remove(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.livestockService.remove(id, tenantId);
  }
}
