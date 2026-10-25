import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SiteService } from './site.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';

@ApiTags('sites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/sites')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Post()
  @AdminWrite()
  @ApiOperation({ summary: 'Create new site' })
  @ApiResponse({ status: 201, description: 'Site created successfully' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createSiteDto: CreateSiteDto,
  ) {
    return this.siteService.create(tenantId, createSiteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sites in tenant' })
  @ApiResponse({ status: 200, description: 'List of sites' })
  findAll(@Param('tenantId') tenantId: string) {
    return this.siteService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get site by ID' })
  @ApiResponse({ status: 200, description: 'Site details' })
  findOne(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.siteService.findOne(tenantId, id);
  }

  @Patch(':id')
  @AdminWrite()
  @ApiOperation({ summary: 'Update site' })
  @ApiResponse({ status: 200, description: 'Site updated successfully' })
  update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() updateSiteDto: UpdateSiteDto,
  ) {
    return this.siteService.update(tenantId, id, updateSiteDto);
  }

  @Delete(':id')
  @AdminWrite()
  @ApiOperation({ summary: 'Delete site' })
  @ApiResponse({ status: 200, description: 'Site deleted successfully' })
  remove(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.siteService.remove(tenantId, id);
  }
}
