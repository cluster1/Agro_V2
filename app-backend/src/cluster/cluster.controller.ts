import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ClusterService } from './cluster.service';
import { CreateClusterDto } from './dto/create-cluster.dto';
import { UpdateClusterDto } from './dto/update-cluster.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AdminWrite } from '../common/decorators/admin-write.decorator';
import { TenantScope } from '../common/decorators/tenant-scope.decorator';

@ApiTags('clusters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class ClusterController {
  constructor(private readonly clusterService: ClusterService) {}

  @Post('tenants/:tenantId/clusters')
  @AdminWrite()
  @ApiOperation({ summary: 'Create new cluster' })
  @ApiResponse({ status: 201, description: 'Cluster created successfully' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createClusterDto: CreateClusterDto,
  ) {
    return this.clusterService.create(tenantId, createClusterDto);
  }

  @Get('tenants/:tenantId/sites/:siteId/clusters')
  @ApiOperation({ summary: 'Get all clusters in site' })
  @ApiResponse({ status: 200, description: 'List of clusters' })
  findAll(
    @Param('tenantId') tenantId: string,
    @Param('siteId') siteId: string,
  ) {
    return this.clusterService.findAll(siteId, tenantId);
  }

  @Get('sites/:siteId/clusters')
  @ApiOperation({ summary: 'Get all clusters in site (legacy)' })
  @ApiResponse({ status: 200, description: 'List of clusters' })
  findAllLegacy(
    @Param('siteId') siteId: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.clusterService.findAll(siteId, scope);
  }

  @Get('tenants/:tenantId/clusters')
  @ApiOperation({ summary: 'Get all clusters in tenant' })
  @ApiResponse({ status: 200, description: 'List of all clusters in tenant' })
  findAllByTenant(@Param('tenantId') tenantId: string) {
    return this.clusterService.findAllByTenant(tenantId);
  }

  @Get('sites/:siteId/clusters/:id')
  @ApiOperation({ summary: 'Get cluster by ID with site validation' })
  @ApiResponse({ status: 200, description: 'Cluster details' })
  findOneWithSite(
    @Param('siteId') siteId: string,
    @Param('id') id: string,
    @TenantScope() scope: string | undefined,
  ) {
    return this.clusterService.findOne(id, siteId, scope);
  }

  @Get('clusters/:id')
  @ApiOperation({ summary: 'Get cluster by ID' })
  @ApiResponse({ status: 200, description: 'Cluster details' })
  findOne(@Param('id') id: string, @TenantScope() scope: string | undefined) {
    return this.clusterService.findOne(id, undefined, scope);
  }

  @Patch('clusters/:id')
  @AdminWrite()
  @ApiOperation({ summary: 'Update cluster' })
  @ApiResponse({ status: 200, description: 'Cluster updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateClusterDto: UpdateClusterDto,
    @TenantScope() scope: string | undefined,
  ) {
    return this.clusterService.update(id, updateClusterDto, scope);
  }

  @Delete('clusters/:id')
  @AdminWrite()
  @ApiOperation({ summary: 'Delete cluster' })
  @ApiResponse({ status: 200, description: 'Cluster deleted successfully' })
  remove(@Param('id') id: string, @TenantScope() scope: string | undefined) {
    return this.clusterService.remove(id, scope);
  }
}
